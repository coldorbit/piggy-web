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
import { Readable } from 'node:stream';
import { Op } from 'sequelize';
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
  profilesWithProgress,
  profilesWithSharing,
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
    res.json({ profiles: (await profilesWithSharing(await profilesWithProgress(profiles))).map(formatProfile) });
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

export async function listProfileShareRecipients(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const users = await repositories.listUsers();
    res.json({
      users: users
        .filter((row) => String(row.id) !== String(user.id))
        .map((row) => ({
          id: row.id,
          username: row.username,
          role: row.role,
        })),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listCallers(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireInternalUser(user, res);
    if (res.headersSent) return;
    const WebUser = getWebUserModel();
    const JobBid = getJobBidModel();
    const ScrapedJob = getScrapedJobModel();
    const BidProfile = getBidProfileModel();
    const callers = await WebUser.findAll({
      where: { role: 'caller' },
      order: [['username', 'ASC']],
    });
    const callerIds = callers.map((caller) => caller.id);
    const assignments = callerIds.length
      ? await JobBid.findAll({
          where: {
            callerUserId: { [Op.in]: callerIds },
            status: 'interviewing',
          },
          include: [
            { model: ScrapedJob, as: 'job', required: true },
            { model: BidProfile, as: 'profile', required: true },
          ],
          order: [
            ['callerUserId', 'ASC'],
            ['interviewNextAt', 'ASC'],
            ['updatedAt', 'DESC'],
          ],
        })
      : [];

    const assignmentsByCallerId = new Map(callerIds.map((callerId) => [String(callerId), []]));
    for (const assignment of assignments) {
      const callerAssignments = assignmentsByCallerId.get(String(assignment.callerUserId));
      if (!callerAssignments) continue;
      callerAssignments.push(formatCallerAssignment(assignment));
    }

    res.json({
      callers: callers.map((caller) => {
        const callerAssignments = assignmentsByCallerId.get(String(caller.id)) || [];
        return {
          id: caller.id,
          username: caller.username,
          role: caller.role,
          activeInterviews: callerAssignments.length,
          upcomingInterviews: callerAssignments.filter((assignment) => Boolean(assignment.interviewNextAt)).length,
          assignments: callerAssignments,
        };
      }),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listBidders(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const sequelize = getSequelize();
    const [bidderRows] = await sequelize.query(`
      SELECT DISTINCT web_users.id, web_users.username, web_users.role
      FROM web_users
      WHERE web_users.role IN ('bidder', 'readonly_bidder', 'editable_bidder')
         OR EXISTS (
           SELECT 1
           FROM job_bids
           WHERE job_bids.user_id = web_users.id
         )
      ORDER BY web_users.username ASC
    `);
    const visibleBidders = user.role === 'admin'
      ? bidderRows
      : bidderRows.filter((bidder) => String(bidder.id) === String(user.id));
    const bidderIds = visibleBidders.map((bidder) => Number(bidder.id)).filter((id) => Number.isFinite(id));

    if (!bidderIds.length) {
      res.json({ bidders: [] });
      return;
    }

    const bidderIdSql = bidderIds.join(',');
    const [summaryRows, dailyRows, interviewRows] = await Promise.all([
      sequelize.query(`
        SELECT
          user_id,
          COUNT(*)::int AS total_applications,
          COUNT(*) FILTER (WHERE bid_at >= now() - interval '7 days')::int AS weekly_applications,
          COUNT(*) FILTER (WHERE bid_at >= now() - interval '30 days')::int AS monthly_applications,
          COUNT(*) FILTER (WHERE status IN ('interviewing', 'won', 'lost'))::int AS interview_pass_through,
          COUNT(*) FILTER (WHERE status = 'won')::int AS won,
          COUNT(*) FILTER (WHERE status = 'lost')::int AS lost
        FROM job_bids
        WHERE user_id IN (${bidderIdSql})
        GROUP BY user_id
      `),
      sequelize.query(`
        SELECT
          job_bids.user_id,
          to_char(job_bids.bid_at::date, 'YYYY-MM-DD') AS day,
          COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown') AS source,
          COUNT(*)::int AS applications
        FROM job_bids
        JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
        WHERE job_bids.user_id IN (${bidderIdSql})
          AND job_bids.bid_at >= current_date - interval '13 days'
        GROUP BY job_bids.user_id, job_bids.bid_at::date, COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown')
        ORDER BY job_bids.bid_at::date ASC, source ASC
      `),
      sequelize.query(`
        SELECT
          job_bids.id,
          job_bids.user_id,
          job_bids.status,
          job_bids.interview_stage,
          job_bids.interview_next_at,
          job_bids.updated_at,
          scraped_jobs.id AS job_id,
          scraped_jobs.title,
          scraped_jobs.company,
          scraped_jobs.location,
          scraped_jobs.url,
          bid_profiles.id AS profile_id,
          bid_profiles.name AS profile_name
        FROM job_bids
        JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
        JOIN bid_profiles ON bid_profiles.id = job_bids.profile_id
        WHERE job_bids.user_id IN (${bidderIdSql})
          AND job_bids.status IN ('interviewing', 'won', 'lost')
        ORDER BY job_bids.updated_at DESC
        LIMIT 200
      `),
    ]);

    const summaryByUserId = new Map(summaryRows[0].map((row) => [String(row.user_id), row]));
    const dailyByUserId = buildDailyApplications(dailyRows[0]);
    const interviewsByUserId = new Map(bidderIds.map((id) => [String(id), []]));
    for (const row of interviewRows[0]) {
      const interviews = interviewsByUserId.get(String(row.user_id));
      if (!interviews) continue;
      interviews.push({
        id: row.id,
        status: row.status,
        interviewStage: row.interview_stage,
        interviewNextAt: row.interview_next_at,
        updatedAt: row.updated_at,
        job: {
          id: row.job_id,
          title: row.title,
          company: row.company,
          location: row.location,
          url: row.url,
        },
        profile: {
          id: row.profile_id,
          name: row.profile_name,
        },
      });
    }

    res.json({
      bidders: visibleBidders.map((bidder) => {
        const summary = summaryByUserId.get(String(bidder.id)) || {};
        return {
          id: bidder.id,
          username: bidder.username,
          role: bidder.role,
          totalApplications: Number(summary.total_applications || 0),
          weeklyApplications: Number(summary.weekly_applications || 0),
          monthlyApplications: Number(summary.monthly_applications || 0),
          interviewPassThrough: Number(summary.interview_pass_through || 0),
          won: Number(summary.won || 0),
          lost: Number(summary.lost || 0),
          dailyApplications: dailyByUserId.get(String(bidder.id)) || buildEmptyDailyApplications(),
          interviews: interviewsByUserId.get(String(bidder.id)) || [],
        };
      }),
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
    const hasRecipientList = Array.isArray(req.body?.usernames) || Array.isArray(req.body?.recipients) || Array.isArray(req.body?.users);
    const recipientUsernames = recipientUsernamesFromBody(req.body);
    if (!hasRecipientList && !recipientUsernames.length) {
      res.status(400).json({ error: 'Choose a user to share with' });
      return;
    }

    const users = await repositories.listUsers();
    const usersByUsername = new Map(users.map((row) => [String(row.username || '').toLowerCase(), row]));
    const recipients = recipientUsernames.map((username) => usersByUsername.get(username.toLowerCase())).filter(Boolean);
    const foundUsernames = new Set(recipients.map((recipient) => String(recipient.username || '').toLowerCase()));
    const missingUsername = recipientUsernames.find((username) => !foundUsernames.has(username.toLowerCase()));
    if (missingUsername) return res.status(404).json({ error: `User not found: ${missingUsername}` });
    if (recipients.some((recipient) => String(recipient.id) === String(profile.userId))) {
      return res.status(400).json({ error: 'You cannot share a profile with its owner' });
    }

    const ProfileShareRequest = getProfileShareRequestModel();
    const existingShares = await ProfileShareRequest.findAll({
      where: { profileId: profile.id },
      include: [{ model: getWebUserModel(), as: 'recipient', required: false }],
    });
    const existingByRecipientId = new Map(existingShares.map((share) => [String(share.recipientUserId), share]));
    const selectedRecipientIds = new Set(recipients.map((recipient) => String(recipient.id)));
    const removedShareIds = [];

    await Promise.all(
      existingShares
        .filter((share) => !selectedRecipientIds.has(String(share.recipientUserId)))
        .map(async (share) => {
          removedShareIds.push(share.id);
          await share.destroy();
        }),
    );

    const shares = [];
    let createdCount = 0;
    for (const recipient of recipients) {
      const existing = existingByRecipientId.get(String(recipient.id));
      const attrs = {
        profileId: profile.id,
        ownerUserId: profile.userId,
        recipientUserId: recipient.id,
        status: existing?.status === 'accepted' ? 'accepted' : 'pending',
        respondedAt: existing?.status === 'accepted' ? existing.respondedAt : null,
      };
      const share = existing ? await existing.update(attrs) : await ProfileShareRequest.create(attrs);
      if (!existing) createdCount += 1;
      share.setDataValue('profile', profile);
      share.setDataValue('recipient', recipient);
      shares.push(share);
    }

    res.status(createdCount ? 201 : 200).json({
      share: shares[0] ? formatProfileShareRequest(shares[0]) : null,
      shares: shares.map(formatProfileShareRequest),
      removedShareIds,
    });
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

function recipientUsernamesFromBody(body = {}) {
  const values = Array.isArray(body.usernames)
    ? body.usernames
    : Array.isArray(body.recipients)
      ? body.recipients
      : Array.isArray(body.users)
        ? body.users
        : [body.username || body.recipient || body.email];
  const usernames = values.map((value) => clean(value).toLowerCase()).filter(Boolean);
  return [...new Set(usernames)];
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
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.query.profileId);
    const ScrapedJob = getScrapedJobModel();
    const JobBid = getJobBidModel();
    const TailoredResume = getTailoredResumeModel();
    const WebUser = getWebUserModel();
    const sequelize = getSequelize();
    const { where, order: jobOrder, limit, offset } = buildJobQuery({ ...req.query, limit: req.query.limit || 10 });
    const bidTab = clean(req.query.bidTab || 'todo');
    const canViewInternalData = isInternalUser(user);
    if (bidTab === 'interviews') {
      requireInternalUser(user, res);
      if (res.headersSent) return;
    }
    const bidUsers = await bidUsersForProfile(profile);
    const appliedByUserId = bidUserFilter(req.query.appliedByUserId, bidUsers);
    const activeTabQuery = buildBidTabQuery({ where, tab: bidTab, profileId: profile.id, appliedByUserId, JobBid, sequelize });

    const countBidTab = (tab) => {
      const countQuery = buildBidTabQuery({
        where,
        tab,
        profileId: profile.id,
        appliedByUserId: tab === bidTab ? appliedByUserId : '',
        JobBid,
        sequelize,
      });
      return ScrapedJob.count({
        where: countQuery.where,
        distinct: true,
        col: 'id',
        subQuery: false,
        include: countQuery.include,
      });
    };

    const [rows, count, todoCount, tailoredCount, doneCount, interviewsCount] = await Promise.all([
      ScrapedJob.findAll({
        where: activeTabQuery.where,
        order: activeTabQuery.order || jobOrder,
        limit,
        offset,
        subQuery: false,
        include: activeTabQuery.include,
      }),
      countBidTab(bidTab),
      countBidTab('todo'),
      countBidTab('tailored'),
      countBidTab('done'),
      canViewInternalData ? countBidTab('interviews') : Promise.resolve(0),
    ]);

    const tailoredResumesByUrl = await tailoredResumesForJobs({
      TailoredResume,
      jobs: rows,
      profileId: profile.id,
    });
    const bidUsersById = new Map(bidUsers.map((bidUser) => [String(bidUser.id), bidUser]));
    const callerUsers = canViewInternalData
      ? await WebUser.findAll({
          where: { role: 'caller' },
          order: [['username', 'ASC']],
        })
      : [];
    const callerUsersById = new Map(callerUsers.map((caller) => [String(caller.id), { id: caller.id, username: caller.username }]));

    res.json({
      jobs: rows.map((job) => ({
        ...formatJob(job),
        bid: job.bids?.[0] ? formatBidWithUser(job.bids[0], bidUsersById, callerUsersById) : null,
        tailoredResume: tailoredResumesByUrl.get(job.url) || null,
      })),
      bidUsers,
      callerUsers: callerUsers.map((caller) => ({ id: caller.id, username: caller.username })),
      currentUser: { id: user.id, username: user.username },
      total: count,
      tabCounts: {
        todo: todoCount,
        tailored: tailoredCount,
        done: doneCount,
        interviews: interviewsCount,
      },
      limit,
      offset,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

function requireInternalUser(user, res) {
  if (isInternalUser(user)) return;
  res.status(403).json({ error: 'Internal access required' });
}

function isInternalUser(user) {
  return ['admin', 'internal'].includes(user?.role);
}

async function bidUsersForProfile(profile) {
  const WebUser = getWebUserModel();
  const ProfileShareRequest = getProfileShareRequestModel();
  const [owner, acceptedShares] = await Promise.all([
    WebUser.findByPk(profile.userId),
    ProfileShareRequest.findAll({
      where: { profileId: profile.id, status: 'accepted' },
      include: [{ model: WebUser, as: 'recipient', required: true }],
      order: [['updatedAt', 'ASC']],
    }),
  ]);

  const usersById = new Map();
  if (owner) usersById.set(String(owner.id), owner);
  for (const share of acceptedShares) {
    if (share.recipient) usersById.set(String(share.recipient.id), share.recipient);
  }

  return [...usersById.values()]
    .map((row) => ({ id: row.id, username: row.username }))
    .sort((left, right) => String(left.username).localeCompare(String(right.username)));
}

function bidUserFilter(value, bidUsers) {
  const userId = clean(value);
  if (!userId || userId === 'all') return '';
  const allowedUserIds = new Set(bidUsers.map((bidUser) => String(bidUser.id)));
  return allowedUserIds.has(String(userId)) ? userId : '';
}

function formatBidWithUser(row, bidUsersById, callerUsersById) {
  const bid = formatBid(row);
  const bidUser = bidUsersById.get(String(row.userId));
  const caller = callerUsersById?.get(String(row.callerUserId || ''));
  return {
    ...bid,
    user: bidUser || null,
    caller: caller || null,
  };
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
      downloadedAt: null,
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
    await markTailoredResumeDownloaded(tailoredResume);

    res.setHeader('content-type', file.contentType);
    res.setHeader('content-disposition', `attachment; filename="${escapeHeaderValue(file.filename)}"`);
    res.setHeader('content-length', String(file.data.length));
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
    const failures = [];
    for (const id of ids) {
      try {
        const tailoredResume = await readyTailoredResumeForUser(req, id);
        const file = await fetchTailoredResumeFile(tailoredResume);
        await markTailoredResumeDownloaded(tailoredResume);
        files.push(file);
      } catch (error) {
        failures.push({ id, message: error.message || 'Download failed' });
      }
    }

    if (!files.length) {
      res.status(404).json({
        error: failures.length ? `No resumes could be downloaded: ${failures.map((failure) => failure.message).join('; ')}` : 'No ready resumes found',
      });
      return;
    }

    const nameCounts = new Map();
    const zipFiles = files.map((file) => ({ name: uniqueZipName(file.filename, nameCounts), data: file.data }));
    if (failures.length) {
      zipFiles.push({
        name: 'download-errors.txt',
        data: Buffer.from(
          [
            'Some resumes could not be included in this download.',
            '',
            ...failures.map((failure) => `Resume ${failure.id}: ${failure.message}`),
            '',
          ].join('\n'),
        ),
      });
    }
    const zip = buildZip(zipFiles);
    res.setHeader('content-type', 'application/zip');
    res.setHeader('content-disposition', 'attachment; filename="tailored-resumes.zip"');
    res.setHeader('content-length', String(zip.length));
    res.send(zip);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

async function markTailoredResumeDownloaded(tailoredResume) {
  if (!tailoredResume.downloadedAt) {
    await tailoredResume.update({ downloadedAt: new Date() });
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

    const now = new Date();
    const attrs = bidAttributesFromBody(req.body);
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (req.user?.role !== 'admin') delete attrs.callerUserId;

    const bid = await getJobBidModel().create({
      ...attrs,
      userId: user.id,
      profileId: profile.id,
      jobId: job.id,
      bidAt: now,
      updatedAt: now,
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

  await logTailoredResumeDownloadRow(id, tailoredResume);
  console.log(
    'Loaded tailored_resume for download:',
    JSON.stringify({
      id: tailoredResume?.id || id,
      status: tailoredResume?.status || null,
      profileId: tailoredResume?.profileId || null,
      jobUrl: tailoredResume?.jobUrl || null,
      filePath: tailoredResume?.filePath || null,
    }),
  );

  if (!tailoredResume || !tailoredResume.filePath) {
    throw new NotFoundError('Ready resume not found');
  }
  await accessibleProfile(req, tailoredResume.profileId);

  return tailoredResume;
}

async function logTailoredResumeDownloadRow(id, tailoredResume) {
  const [rows] = await getSequelize().query(
    `
    SELECT to_jsonb(tailored_resumes) AS row
    FROM tailored_resumes
    WHERE id = :id
    LIMIT 1
    `,
    { replacements: { id } },
  );

  console.log(
    'Raw tailored_resumes row for download:',
    JSON.stringify({
      id,
      sequelizeFilePath: tailoredResume?.filePath || null,
      row: rows[0]?.row || null,
    }),
  );
}

async function fetchTailoredResumeFile(tailoredResume) {
  const filePath = String(tailoredResume.filePath);
  const candidates = getTailoredResumeS3Candidates(filePath);

  console.log(
    'Resolved tailored resume S3 candidates:',
    JSON.stringify({
      tailoredResumeId: tailoredResume.id,
      filePath,
      candidates,
    }),
  );

  for (const s3Details of candidates) {
    try {
      return await fetchTailoredResumeFromS3(s3Details.bucket, s3Details.key, tailoredResume);
    } catch (error) {
      if (!isMissingStorageObjectError(error)) throw error;
      console.warn(
        'Tailored resume S3 candidate was not found:',
        JSON.stringify({
          tailoredResumeId: tailoredResume.id,
          bucket: s3Details.bucket,
          key: s3Details.key,
        }),
      );
    }
  }

  throw new NotFoundError('Resume file is not stored in S3');
}

function getTailoredResumeS3Candidates(filePath) {
  const candidates = [
    getExplicitS3Details(filePath),
    getS3UrlDetails(filePath),
    ...getConfiguredS3Details(filePath),
  ].filter(Boolean);
  const seen = new Set();

  return candidates.filter(({ bucket, key }) => {
    const candidateKey = `${bucket}/${key}`;
    if (seen.has(candidateKey)) return false;
    seen.add(candidateKey);
    return true;
  });
}

function getExplicitS3Details(filePath) {
  if (!filePath) return null;
  if (!filePath.startsWith('s3://')) return null;

  try {
    const url = new URL(filePath);
    const bucket = url.hostname;
    const key = url.pathname.replace(/^\//, '');
    return bucket && key ? { bucket, key } : null;
  } catch {
    return null;
  }
}

function getS3UrlDetails(filePath) {
  if (!filePath || !/^https?:\/\//i.test(filePath)) return null;

  try {
    const url = new URL(filePath);
    const virtualHostedMatch = url.hostname.match(/^(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i);
    if (virtualHostedMatch) {
      const bucket = virtualHostedMatch[1];
      const key = decodeURIComponent(url.pathname.replace(/^\//, ''));
      return bucket && key ? { bucket, key } : null;
    }
    if (/^s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname)) {
      const [bucket, ...keyParts] = url.pathname.replace(/^\//, '').split('/');
      const key = decodeURIComponent(keyParts.join('/'));
      return bucket && key ? { bucket, key } : null;
    }
  } catch {
    return null;
  }

  return null;
}

function getConfiguredS3Details(filePath) {
  if (!filePath || !ENV.AWS_S3_BUCKET) return [];
  const key = String(filePath).trim().replace(/^\/+/, '');
  return key ? [{ bucket: ENV.AWS_S3_BUCKET, key }] : [];
}

async function fetchTailoredResumeFromS3(bucket, key, tailoredResume) {
  let response;
  try {
    response = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (isMissingStorageObjectError(error)) throw new NotFoundError('Resume file not found');
    throw error;
  }
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

function isMissingStorageObjectError(error) {
  return (
    error instanceof NotFoundError ||
    error?.name === 'NoSuchKey' ||
    error?.name === 'NotFound' ||
    error?.$metadata?.httpStatusCode === 404
  );
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

function buildDailyApplications(rows) {
  const emptySeries = buildEmptyDailyApplications();
  const byUserId = new Map();
  for (const row of rows) {
    const userId = String(row.user_id);
    if (!byUserId.has(userId)) {
      byUserId.set(userId, emptySeries.map((item) => ({ ...item, sources: [...item.sources] })));
    }
    const series = byUserId.get(userId);
    const day = series.find((item) => item.date === row.day);
    if (day) {
      const applications = Number(row.applications || 0);
      day.applications += applications;
      day.sources.push({
        source: row.source || 'Unknown',
        applications,
      });
    }
  }
  return byUserId;
}

function buildEmptyDailyApplications() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_item, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    return {
      date: date.toISOString().slice(0, 10),
      applications: 0,
      sources: [],
    };
  });
}

export async function updateJobBid(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const bid = await getJobBidModel().findByPk(req.params.id);
    if (!bid) {
      res.status(404).json({ error: 'Bid not found' });
      return;
    }
    const attrs = bidAttributesFromBody(req.body);
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (req.user?.role !== 'admin') {
      await accessibleProfile(req, bid.profileId);
      if (String(bid.userId) !== String(user.id)) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }
      delete attrs.callerUserId;
    }
    await bid.update({ ...attrs, updatedAt: new Date() });
    res.json({ bid: formatBid(bid) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

async function ensureCallerUser(callerUserId) {
  const caller = await getWebUserModel().findOne({ where: { id: callerUserId, role: 'caller' } });
  if (!caller) throw new NotFoundError('Caller not found');
  return caller;
}

function formatCallerAssignment(row) {
  return {
    id: row.id,
    profileId: row.profileId,
    jobId: row.jobId,
    status: row.status,
    interviewStage: row.interviewStage,
    interviewNextAt: row.interviewNextAt,
    interviewNotes: row.interviewNotes,
    updatedAt: row.updatedAt,
    job: row.job ? formatJob(row.job) : null,
    profile: row.profile ? formatProfile(row.profile) : null,
  };
}
