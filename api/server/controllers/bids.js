import {
  ensureWebModels,
  getBidProfileModel,
  getJobBidModel,
  getProfileShareRequestModel,
  getScrapedJobModel,
  getSequelize,
  getTailoredResumeModel,
  getWebUserModel,
  repositories,
} from '../../db.js';
import axios from 'axios';
import { Readable } from 'node:stream';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../../env.js';
import {
  bidAttributesFromBody,
  buildBidTabQuery,
  buildZip,
  formatBid,
  formatTailoredResume,
  tailoredResumesForJobs,
} from '../services/bids.js';
import { buildJobQuery, formatJob } from '../services/jobs.js';
import {
  accessibleProfile,
  currentDbUser,
  formatProfile,
  ownedProfile,
  profileAttributesFromBody,
  profilesManagedByUser,
  profileStatusAttributesFromBody,
  profilesVisibleToUser,
} from '../services/profiles.js';
import { enqueueTailoredResumeRequest } from '../services/tailoringQueue.js';
import { clean } from '../utils/index.js';
import { handleInputError, NotFoundError } from '../utils/errors.js';

export async function listProfiles(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profiles =
      clean(req.query?.scope) === 'manage' && user.role === 'admin'
        ? await profilesManagedByUser(user)
        : await profilesVisibleToUser(user);
    res.json({ profiles: profiles.map(formatProfile) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listProfileShareRequests(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const ProfileShareRequest = getProfileShareRequestModel();
    const BidProfile = getBidProfileModel();
    const WebUser = getWebUserModel();

    const [incoming, outgoing] = await Promise.all([
      ProfileShareRequest.findAll({
        where: { recipientUserId: user.id, status: 'pending' },
        include: [
          { model: BidProfile, as: 'profile', required: true },
          { model: WebUser, as: 'owner', required: true },
        ],
        order: [['createdAt', 'DESC']],
      }),
      ProfileShareRequest.findAll({
        where: { ownerUserId: user.id },
        include: [
          { model: BidProfile, as: 'profile', required: true },
          { model: WebUser, as: 'recipient', required: true },
        ],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    res.json({
      incoming: incoming.map(formatProfileShareRequest),
      outgoing: outgoing.map(formatProfileShareRequest),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function shareProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const profile = await manageableProfile(req, req.params.id);
    const recipientUsername = clean(req.body?.username || req.body?.recipient || req.body?.email).toLowerCase();
    if (!recipientUsername) {
      res.status(400).json({ error: 'Choose a user to share with' });
      return;
    }

    const recipient = await repositories.findUserByUsernameCaseInsensitive(recipientUsername);
    if (!recipient) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (String(recipient.id) === String(profile.userId)) {
      res.status(400).json({ error: 'You cannot share a profile with its owner' });
      return;
    }

    const ProfileShareRequest = getProfileShareRequestModel();
    const existing = await ProfileShareRequest.findOne({
      where: { profileId: profile.id, recipientUserId: recipient.id },
    });
    const attrs = {
      profileId: profile.id,
      ownerUserId: profile.userId,
      recipientUserId: recipient.id,
      status: 'pending',
      respondedAt: null,
    };
    const share = existing ? await existing.update(attrs) : await ProfileShareRequest.create(attrs);
    share.setDataValue('profile', profile);
    share.setDataValue('recipient', recipient);

    res.status(existing ? 200 : 201).json({ share: formatProfileShareRequest(share) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function respondToProfileShare(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const status = clean(req.body?.status).toLowerCase();
    if (!['accepted', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Choose accept or reject' });
      return;
    }

    const share = await getProfileShareRequestModel().findOne({
      where: { id: req.params.id, recipientUserId: user.id, status: 'pending' },
      include: [
        { model: getBidProfileModel(), as: 'profile', required: true },
        { model: getWebUserModel(), as: 'owner', required: true },
      ],
    });
    if (!share) {
      res.status(404).json({ error: 'Share request not found' });
      return;
    }

    await share.update({ status, respondedAt: new Date() });
    res.json({ share: formatProfileShareRequest(share) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const user = await currentDbUser(req);
    const attrs = profileAttributesFromBody(req.body);
    const profile = await getBidProfileModel().create({
      ...attrs,
      userId: user.id,
      profileStatus: 'active',
    });
    res.status(201).json({ profile: formatProfile(profile) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const profile = await manageableProfile(req, req.params.id);
    await profile.update(profileAttributesFromBody(req.body));
    res.json({ profile: formatProfile(profile) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateProfileStatus(req, res, next) {
  try {
    await ensureWebModels();
    const attrs = profileStatusAttributesFromBody(req.body);
    if (!canUpdateProfileStatus(req, res, attrs.profileStatus)) return;
    const profile = attrs.profileStatus === 'active' ? await adminManagedProfile(req, req.params.id) : await manageableProfile(req, req.params.id);
    await profile.update(attrs);
    res.json({ profile: formatProfile(profile) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const profile = await manageableProfile(req, req.params.id);
    await getJobBidModel().destroy({ where: { profileId: profile.id } });
    await getProfileShareRequestModel().destroy({ where: { profileId: profile.id } });
    await profile.destroy();
    res.json({ ok: true });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

function canManageProfiles(req, res) {
  if (!['bidder', 'readonly_bidder', 'editable_bidder'].includes(req.user?.role)) return true;
  res.status(403).json({ error: 'Bidders cannot add, edit, share, or remove profiles' });
  return false;
}

function canUpdateProfileStatus(req, res, status) {
  if (status === 'active') {
    if (req.user?.role === 'admin') return true;
    res.status(403).json({ error: 'Only admins can restore closed profiles' });
    return false;
  }

  if (['admin', 'user'].includes(req.user?.role)) return true;
  res.status(403).json({ error: 'Only user and admin roles can close profiles' });
  return false;
}

async function manageableProfile(req, profileId) {
  if (req.user?.role === 'admin') return adminManagedProfile(req, profileId);
  return ownedProfile(req, profileId);
}

async function adminManagedProfile(req, profileId) {
  if (req.user?.role !== 'admin') return ownedProfile(req, profileId);
  const id = clean(profileId);
  if (!id) throw new NotFoundError('Profile not found');
  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  return profile;
}

export async function listBidJobs(req, res, next) {
  try {
    await ensureWebModels();
    const profile = await accessibleProfile(req, req.query.profileId);
    const ScrapedJob = getScrapedJobModel();
    const JobBid = getJobBidModel();
    const TailoredResume = getTailoredResumeModel();
    const sequelize = getSequelize();
    const { where, order, limit, offset } = buildJobQuery({ ...req.query, limit: req.query.limit || 10 });
    const bidTab = clean(req.query.bidTab || 'todo');
    const activeTabQuery = buildBidTabQuery({ where, tab: bidTab, profileId: profile.id, JobBid, sequelize });

    const countBidTab = (tab) => {
      const countQuery = buildBidTabQuery({ where, tab, profileId: profile.id, JobBid, sequelize });
      return ScrapedJob.count({
        where: countQuery.where,
        distinct: true,
        col: 'id',
        subQuery: false,
        include: countQuery.include,
      });
    };

    const [rows, count, todoCount, tailoredCount, doneCount] = await Promise.all([
      ScrapedJob.findAll({
        where: activeTabQuery.where,
        order,
        limit,
        offset,
        subQuery: false,
        include: activeTabQuery.include,
      }),
      countBidTab(bidTab),
      countBidTab('todo'),
      countBidTab('tailored'),
      countBidTab('done'),
    ]);

    const tailoredResumesByUrl = await tailoredResumesForJobs({
      TailoredResume,
      jobs: rows,
      profileId: profile.id,
    });

    res.json({
      jobs: rows.map((job) => ({
        ...formatJob(job),
        bid: job.bids?.[0] ? formatBid(job.bids[0]) : null,
        tailoredResume: tailoredResumesByUrl.get(job.url) || null,
      })),
      total: count,
      tabCounts: {
        todo: todoCount,
        tailored: tailoredCount,
        done: doneCount,
      },
      limit,
      offset,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    const job = await getScrapedJobModel().findByPk(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const TailoredResume = getTailoredResumeModel();
    const existing = await TailoredResume.findOne({
      where: { profileId: profile.id, jobUrl: job.url },
      order: [['updatedAt', 'DESC']],
    });

    const attrs = {
      userId: user.id,
      profileId: profile.id,
      jobUrl: job.url,
      status: 'requested',
      filePath: null,
      readyAt: null,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      deadLetterAt: null,
    };
    const tailoredResume = existing ? await existing.update(attrs) : await TailoredResume.create(attrs);
    await enqueueTailoredResumeRequest({ tailoredResumeId: tailoredResume.id });

    res.status(202).json({
      tailoredResume: formatTailoredResume(tailoredResume),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function downloadTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const tailoredResume = await readyTailoredResumeForUser(req, req.params.id);
    const file = await fetchTailoredResumeFile(tailoredResume);

    res.setHeader('content-type', file.contentType);
    res.setHeader('content-disposition', `attachment; filename="${escapeHeaderValue(file.filename)}"`);
    res.send(file.data);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function downloadTailoredResumesZip(req, res, next) {
  try {
    await ensureWebModels();
    const ids = clean(req.query.ids)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (!ids.length) {
      res.status(400).json({ error: 'Choose at least one resume to download' });
      return;
    }

    const files = [];
    for (const id of ids) {
      const tailoredResume = await readyTailoredResumeForUser(req, id);
      const file = await fetchTailoredResumeFile(tailoredResume);
      files.push(file);
    }

    if (!files.length) {
      res.status(404).json({ error: 'No ready resumes found' });
      return;
    }

    const nameCounts = new Map();
    const zip = buildZip(files.map((file) => ({ name: uniqueZipName(file.filename, nameCounts), data: file.data })));
    res.setHeader('content-type', 'application/zip');
    res.setHeader('content-disposition', 'attachment; filename="tailored-resumes.zip"');
    res.send(zip);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createJobBid(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    const job = await getScrapedJobModel().findByPk(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const bid = await getJobBidModel().create({
      ...bidAttributesFromBody(req.body),
      userId: user.id,
      profileId: profile.id,
      jobId: job.id,
      bidAt: new Date(),
    });
    res.status(201).json({ bid: formatBid(bid) });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'This profile already has a bid for this job' });
      return;
    }
    handleInputError(error, res, next);
  }
}

async function readyTailoredResumeForUser(req, id) {
  const tailoredResume = await getTailoredResumeModel().findOne({
    where: { id, status: 'ready' },
  });

  if (!tailoredResume || !tailoredResume.filePath) {
    throw new NotFoundError('Ready resume not found');
  }
  await accessibleProfile(req, tailoredResume.profileId);

  return tailoredResume;
}

async function fetchTailoredResumeFile(tailoredResume) {
  const filePath = String(tailoredResume.filePath);

  const s3Details = getS3Details(filePath);
  if (s3Details) {
    return fetchTailoredResumeFromS3(s3Details.bucket, s3Details.key, tailoredResume);
  }

  if (isHttpUrl(filePath)) {
    return fetchTailoredResumeFromHttp(filePath, tailoredResume);
  }

  return fetchTailoredResumeFromTailorService(tailoredResume);
}

function getS3Details(filePath) {
  if (!filePath) return null;

  if (filePath.startsWith('s3://')) {
    try {
      const url = new URL(filePath);
      const bucket = url.hostname;
      const key = url.pathname.replace(/^\//, '');
      return bucket && key ? { bucket, key } : null;
    } catch {
      return null;
    }
  }

  if (ENV.AWS_S3_BUCKET) {
    return { bucket: ENV.AWS_S3_BUCKET, key: filePath.replace(/^\//, '') };
  }

  return null;
}

async function fetchTailoredResumeFromS3(bucket, key, tailoredResume) {
  const response = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = response.Body;
  if (!body) {
    throw new NotFoundError('Resume file not found');
  }

  const data = await streamToBuffer(body);
  return {
    filename: filenameFromPath(key),
    contentType: response.ContentType || 'application/pdf',
    data,
  };
}

async function fetchTailoredResumeFromHttp(path, tailoredResume) {
  const response = await axios.get(path, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  return {
    filename: filenameFromContentDisposition(response.headers['content-disposition']) || filenameFromPath(tailoredResume.filePath),
    contentType: response.headers['content-type'] || 'application/pdf',
    data: Buffer.from(response.data),
  };
}

async function fetchTailoredResumeFromTailorService(tailoredResume) {
  const encodedKey = String(tailoredResume.filePath).split('/').map(encodeURIComponent).join('/');
  let response;
  try {
    response = await axios.get(`${ENV.TAILOR_SERVICE_URL.replace(/\/+$/, '')}/download/${encodedKey}`, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });
  } catch (error) {
    if (error.response?.status === 404) throw new NotFoundError('Resume file not found');
    throw error;
  }

  return {
    filename: filenameFromContentDisposition(response.headers['content-disposition']) || filenameFromPath(tailoredResume.filePath),
    contentType: response.headers['content-type'] || 'application/pdf',
    data: Buffer.from(response.data),
  };
}

async function streamToBuffer(body) {
  if (body instanceof Buffer) return body;
  if (body instanceof Readable) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

let s3Client;
function getS3Client() {
  if (s3Client) return s3Client;
  s3Client = new S3Client({ region: ENV.AWS_REGION });
  return s3Client;
}

function filenameFromPath(filePath) {
  return sanitizeFilename(String(filePath).split('/').pop() || 'resume.pdf');
}

function filenameFromContentDisposition(value) {
  const match = String(value || '').match(/filename="?([^";]+)"?/i);
  return match ? sanitizeFilename(match[1]) : '';
}

function sanitizeFilename(value) {
  return String(value || 'resume.pdf').replace(/[/\\?%*:|"<>]/g, '_') || 'resume.pdf';
}

function escapeHeaderValue(value) {
  return sanitizeFilename(value).replace(/"/g, '\\"');
}

function uniqueZipName(filename, nameCounts) {
  const index = (nameCounts.get(filename) || 0) + 1;
  nameCounts.set(filename, index);
  if (index === 1) return filename;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return `${filename}-${index}`;
  return `${filename.slice(0, dotIndex)}-${index}${filename.slice(dotIndex)}`;
}

function formatProfileShareRequest(row) {
  return {
    id: row.id,
    profileId: row.profileId,
    ownerUserId: row.ownerUserId,
    recipientUserId: row.recipientUserId,
    status: row.status,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    profile: row.profile ? formatProfile(row.profile) : null,
    owner: row.owner ? { id: row.owner.id, username: row.owner.username } : null,
    recipient: row.recipient ? { id: row.recipient.id, username: row.recipient.username } : null,
  };
}

export async function updateJobBid(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const bid = await getJobBidModel().findOne({ where: { id: req.params.id, userId: user.id } });
    if (!bid) {
      res.status(404).json({ error: 'Bid not found' });
      return;
    }
    await bid.update(bidAttributesFromBody(req.body));
    res.json({ bid: formatBid(bid) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}
