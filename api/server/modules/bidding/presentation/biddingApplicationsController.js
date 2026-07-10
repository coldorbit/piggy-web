import {
  ensureWebModels,
  getBidProfileModel,
  getCollaborationEventModel,
  getInterviewCallModel,
  getInterviewLogModel,
  getInterviewModel,
  getJobBidModel,
  getProfileShareRequestModel,
  getScrapedJobModel,
  getSequelize,
  getTailoredResumeModel,
  getWebUserModel,
  repositories,
} from '../../../../db.js';
import { Readable } from 'node:stream';
import { Op, QueryTypes } from 'sequelize';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../../../../env.js';
import { hashPassword, publicUser } from '../../../../auth.js';
import {
  bidAttributesFromBody,
  buildBidTabQuery,
  buildZip,
  dailyGoalRangeForUserBidFilter,
  formatBid,
  formatTailoredResume,
  REVIEW_BID_STATUSES,
  shouldRefreshBidAtForStatus,
  shouldSetInterviewAtForStatus,
  tailoredResumesForJobs,
} from '../application/biddingService.js';
import { buildJobQuery, formatJob, jobDateFiltersForUser, jobSourceLabel, normalizeJobSource } from '../../jobs/application/jobsService.js';
import {
  accessibleProfile,
  accessibleAppliedProfile,
  currentDbUser,
  formatProfile,
  isLegacyProfile,
  ownedProfile,
  profileAttributesFromBody,
  profilesManagedByUser,
  profilesForAppliedFilter,
  profileStatusAttributesFromBody,
  sortProfilesForDisplay,
  profilesVisibleToUser,
  profilesWithProgress,
  profilesWithSharing,
  isDraftProfile,
  isProfileInUserWorkspace,
  canUserAccessWorkspace,
  workspaceProfileWhereForUser,
} from '../application/profilesService.js';
import { enqueueTailoredResumeRequest } from '../application/tailoringQueueService.js';
import { userAttributesFromBody } from '../../admin/application/usersService.js';
import { deleteProfileHubRecords } from './profileIntelligenceController.js';
import { clean } from '../../../utils/index.js';
import { handleInputError, handleUserWriteError, InputError, NotFoundError } from '../../../utils/errors.js';
import {
  ADMIN_MANAGED_PROFILE_OWNER_ROLES,
  BIDDER_ROLES,
  INTERNAL_DATA_ROLES,
  INTERVIEW_ACCESS_ROLES,
  PRIVILEGED_USER_ROLES,
  canRegisterManualInterviewCalls,
  canManageCallers as canManageCallersRole,
  isAdminRole,
  isSuperadmin,
} from '../../../utils/roles.js';
import {
  addLocalDays,
  localDateKeyDaysAgo,
  localDateRange,
  localDaySql,
  localPresetRange,
} from '../../../utils/localTime.js';

const ACTIVE_TAILORED_RESUME_STATUSES = ['requested', 'processing', 'ready', 'dead_letter'];
const TAILORED_REQUEST_STATUSES = ['requested', 'processing', 'ready', 'dead_letter', 'cancelled', 'invalid'];
const DAILY_BID_GOAL_STATUSES = ['submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost'];
const BATCH_LIMIT = 100;
const SAME_COMPANY_TAILORING_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
import { ensureProfileBidEligible } from './biddingQueriesController.js';
import { batchApplicationItems, ensureCallerUser, recordBidChangeEvent } from './biddingInterviewEndpointsController.js';
import { applyBidUpdates, bidUpdateValuesFromAttrs, canAssignInterviewCaller, createBidForBatch, ensureBidBatchWritable, ensureInitialInterviewCallSchedule, formatInterviewAsJob, formatInterviewCall, interviewValuesFromAttrs, interviewWriteProfileForUser, logInterviewCreated, manualInterviewCallAttributes, pruneAttrsForProvidedBidFields, rejectReviewStatusForNonAdmin, syncInitialInterviewCall, upsertInterviewCallForStage, upsertInterviewForBid } from './biddingInterviewDomainController.js';

export async function createJobBid(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    if (!ensureProfileBidEligible(profile, res)) return;
    const job = await getScrapedJobModel().findByPk(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const now = new Date();
    const attrs = bidAttributesFromBody(req.body);
    if (rejectReviewStatusForNonAdmin(req, res, attrs)) return;
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (!canAssignInterviewCaller(user)) delete attrs.callerUserId;

    const bid = await getJobBidModel().create({
      ...bidUpdateValuesFromAttrs(attrs),
      userId: user.id,
      profileId: profile.id,
      jobId: job.id,
      bidAt: now,
      ...(attrs.status === 'interviewing' ? { interviewAt: now } : {}),
      updatedAt: now,
    });
    if (['interviewing', 'won', 'lost'].includes(attrs.status)) {
      await upsertInterviewForBid({ bid, job, attrs, userId: user.id });
    }
    await recordBidChangeEvent({
      bid,
      job,
      userId: user.id,
      body: `Application created with status ${bid.status}.`,
      metadata: { action: 'created', status: bid.status },
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

export async function bulkUpdateJobBids(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const items = batchApplicationItems(req.body?.items);
    const updatesBody = req.body?.updates || req.body || {};
    const attrs = bidAttributesFromBody(updatesBody);
    pruneAttrsForProvidedBidFields(attrs, updatesBody);
    if (rejectReviewStatusForNonAdmin(req, res, attrs)) return;
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (!canAssignInterviewCaller(user)) delete attrs.callerUserId;

    const profileId = clean(req.body?.profileId);
    const profile = profileId ? await accessibleProfile(req, profileId) : null;
    if (profile && !ensureProfileBidEligible(profile, res)) return;
    const JobBid = getJobBidModel();
    const ScrapedJob = getScrapedJobModel();
    const results = [];

    for (const item of items) {
      try {
        let bid = item.bidId ? await JobBid.findByPk(item.bidId) : null;
        let job = item.jobId ? await ScrapedJob.findByPk(item.jobId) : null;

        if (bid && !job) job = await ScrapedJob.findByPk(bid.jobId);
        if (!bid && !job) {
          results.push({ jobId: item.jobId ? String(item.jobId) : null, bidId: item.bidId ? String(item.bidId) : null, ok: false, error: 'Job or bid not found' });
          continue;
        }

        if (bid) {
          await ensureBidBatchWritable({ req, res, user, bid, attrs });
          if (res.headersSent) return;
          bid = await applyBidUpdates({ bid, attrs });
        } else {
          if (!profile) throw new InputError('profileId is required when creating applications');
          if (attrs.callerUserId && !canAssignInterviewCaller(user)) delete attrs.callerUserId;
          bid = await createBidForBatch({ user, profile, job, attrs });
        }

        if (['interviewing', 'won', 'lost'].includes(attrs.status)) {
          await upsertInterviewForBid({ bid, job, attrs, userId: bid.userId });
        }
        await recordBidChangeEvent({
          bid,
          job,
          userId: user.id,
          body: `Application updated to ${bid.status}.`,
          metadata: { action: item.bidId ? 'bulk_updated' : 'bulk_created', status: bid.status },
        });
        results.push({ jobId: String(bid.jobId), bidId: String(bid.id), ok: true, bid: formatBid(bid) });
      } catch (error) {
        results.push({
          jobId: item.jobId ? String(item.jobId) : null,
          bidId: item.bidId ? String(item.bidId) : null,
          ok: false,
          error: error.message || 'Application update failed',
        });
      }
    }

    res.json({
      requested: items.length,
      updated: results.filter((result) => result.ok).length,
      results,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createManualInterview(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await interviewWriteProfileForUser(user, req.body?.profileId);
    const title = clean(req.body?.title);
    const company = clean(req.body?.company);
    const jobUrl = clean(req.body?.url || req.body?.jobUrl);
    if (!title) {
      res.status(400).json({ error: 'Job title is required' });
      return;
    }
    if (!company) {
      res.status(400).json({ error: 'Company is required' });
      return;
    }
    if (jobUrl && !validHttpUrl(jobUrl)) {
      res.status(400).json({ error: 'Job link must be a valid URL' });
      return;
    }

    const attrs = bidAttributesFromBody({ ...req.body, status: 'interviewing' });
    ensureInitialInterviewCallSchedule(attrs);
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (!canAssignInterviewCaller(user)) delete attrs.callerUserId;

    const interview = await getInterviewModel().create({
      ...interviewValuesFromAttrs(attrs),
      userId: user.id,
      profileId: profile.id,
      title,
      company,
      location: clean(req.body?.location) || null,
      jobUrl: jobUrl || null,
    });
    await logInterviewCreated(interview, user.id);
    await syncInitialInterviewCall(interview, { sourceType: 'created' });

    res.status(201).json({
      job: formatInterviewAsJob(interview),
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'This profile already has a bid for this job' });
      return;
    }
    handleInputError(error, res, next);
  }
}

export async function createManualInterviewCall(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    if (!canRegisterManualInterviewCalls(user)) {
      res.status(403).json({ error: 'Manual call registration access required' });
      return;
    }

    const interview = await getInterviewModel().findByPk(req.params.id);
    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }
    if (!isAdminRole(user)) {
      await interviewWriteProfileForUser(user, interview.profileId, 'Interview not found');
    }

    const attrs = manualInterviewCallAttributes(req.body, interview);
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    const call = await upsertInterviewCallForStage(interview, attrs, {
      sourceType: 'manual',
      metadata: {
        createdFrom: 'manual',
        createdByUserId: user.id,
        ...(attrs.callerUserIdProvided ? { callerUserIdManuallyAssigned: true } : {}),
      },
    });

    res.status(201).json({
      call: formatInterviewCall(call),
      job: formatInterviewAsJob(interview),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function readyTailoredResumeForUser(req, id) {
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
  await ensureTailoredResumeAccess(req, tailoredResume);

  return tailoredResume;
}

export async function ensureTailoredResumeAccess(req, tailoredResume) {
  const user = await currentDbUser(req);
  if (user.role !== 'caller') {
    await accessibleProfile(req, tailoredResume.profileId);
    return;
  }
  const assignment = await getInterviewModel().findOne({
    where: {
      profileId: tailoredResume.profileId,
      jobUrl: tailoredResume.jobUrl,
      callerUserId: user.id,
    },
  });
  if (!assignment) throw new NotFoundError('Ready resume not found');
}

export async function logTailoredResumeDownloadRow(id, tailoredResume) {
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
    }),
  );
}

export async function fetchTailoredResumeFile(tailoredResume) {
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

export function getTailoredResumeS3Candidates(filePath) {
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

export function getExplicitS3Details(filePath) {
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

export function getS3UrlDetails(filePath) {
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

export function getConfiguredS3Details(filePath) {
  if (!filePath || !ENV.AWS_S3_BUCKET) return [];
  const key = String(filePath).trim().replace(/^\/+/, '');
  return key ? [{ bucket: ENV.AWS_S3_BUCKET, key }] : [];
}

export async function fetchTailoredResumeFromS3(bucket, key, tailoredResume) {
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
    contentType: response.ContentType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    data,
  };
}

export function isMissingStorageObjectError(error) {
  return (
    error instanceof NotFoundError ||
    error?.name === 'NoSuchKey' ||
    error?.name === 'NotFound' ||
    error?.$metadata?.httpStatusCode === 404
  );
}

export async function streamToBuffer(body) {
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
export function getS3Client() {
  if (s3Client) return s3Client;
  s3Client = new S3Client({ region: ENV.AWS_REGION });
  return s3Client;
}

export function filenameFromPath(filePath) {
  return sanitizeFilename(String(filePath).split('/').pop() || 'resume.docx');
}

export function sanitizeFilename(value) {
  return String(value || 'resume.docx').replace(/[/\\?%*:|"<>]/g, '_') || 'resume.docx';
}

export function escapeHeaderValue(value) {
  return sanitizeFilename(value).replace(/"/g, '\\"');
}

export function uniqueZipName(filename, nameCounts) {
  const index = (nameCounts.get(filename) || 0) + 1;
  nameCounts.set(filename, index);
  if (index === 1) return filename;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return `${filename}-${index}`;
  return `${filename.slice(0, dotIndex)}-${index}${filename.slice(dotIndex)}`;
}

export function formatProfileShareRequest(row) {
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

export function formatTailoringRequest(row) {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    jobUrl: row.job_url,
    requestType: row.request_type || 'job',
    manualCompany: row.manual_company,
    manualRole: row.manual_role,
    manualJobDescription: row.manual_job_description,
    status: row.status,
    filePath: row.file_path,
    readyAt: row.ready_at,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    deadLetterAt: row.dead_letter_at,
    downloadedAt: row.downloaded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requester: row.user_id
      ? {
          id: row.user_id,
          username: row.requester_username || 'Unknown user',
        }
      : null,
    profile: row.profile_id
      ? {
          id: row.profile_id,
          name: row.profile_name || 'Untitled profile',
          ownerUserId: row.profile_owner_user_id,
          ownerUsername: row.profile_owner_username || 'Unknown owner',
        }
      : null,
    job: {
      id: row.job_id,
      title: row.title || row.manual_role || 'Untitled role',
      company: row.company || row.manual_company || 'Unknown company',
      location: row.location,
      source: row.request_type === 'manual' ? 'Manual' : row.source,
      postedAt: row.posted_at,
      scrapedAt: row.scraped_at,
      url: validHttpUrl(row.job_url) ? row.job_url : '',
    },
    review: resumeTailoringReview(row),
  };
}

export function resumeTailoringReview(row) {
  const cvText = clean(cvDataReviewText(row.cv_data));
  const profileResumeText = clean(row.profile_resume_text);
  const resumeText = cvText || profileResumeText;
  const resumeSource = cvText ? 'generated_cv_json' : profileResumeText ? 'profile_resume' : 'missing_resume';
  const jobText = clean(row.listing_text || row.manual_job_description);
  const keywords = extractReviewKeywords(jobText);
  const resumeTextLower = resumeText.toLowerCase();
  const covered = keywords.filter((keyword) => resumeTextLower.includes(keyword.toLowerCase()));
  const missing = keywords.filter((keyword) => !resumeTextLower.includes(keyword.toLowerCase()));
  const coverage = keywords.length ? covered.length / keywords.length : null;
  const truthfulnessFlags = resumeTruthfulnessFlags({ resumeText, jobText, row });
  const confidence = reviewConfidence({ status: row.status, coverage, truthfulnessFlags, hasResume: Boolean(resumeText), hasJobText: Boolean(jobText) });

  return {
    approval: {
      status: row.status === 'ready' ? (truthfulnessFlags.length ? 'needs_review' : 'pending_approval') : 'not_ready',
      downloadedAt: row.downloaded_at ? new Date(row.downloaded_at).toISOString() : null,
      nextAction: row.status === 'ready' ? 'Review keyword coverage and truthfulness before approving download/use.' : 'Wait for the tailored resume to be ready.',
    },
    confidence,
    atsKeywordCoverage: coverage === null
      ? null
      : {
          score: Number(coverage.toFixed(2)),
          covered,
          missing,
          total: keywords.length,
        },
    beforeAfterDiff: {
      baseline: resumeSource,
      target: jobText ? 'job_description' : 'missing_job_description',
      likelyAddedKeywords: missing.slice(0, 12),
      alreadyCoveredKeywords: covered.slice(0, 12),
    },
    truthfulness: {
      status: truthfulnessFlags.length ? 'needs_review' : 'clear',
      flags: truthfulnessFlags,
    },
  };
}

export function cvDataReviewText(value) {
  const parsed = parseCvData(value);
  if (!parsed) return '';

  const parts = [];
  collectCvDataText(parsed, parts);
  return parts.join('\n');
}

export function parseCvData(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function collectCvDataText(value, parts) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = clean(value);
    if (text) parts.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectCvDataText(item, parts);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key) parts.push(key.replace(/_/g, ' '));
      collectCvDataText(item, parts);
    }
  }
}

export function extractReviewKeywords(value) {
  const text = String(value || '').toLowerCase();
  const phrases = [
    'react', 'node', 'typescript', 'javascript', 'python', 'java', 'aws', 'gcp', 'azure',
    'postgresql', 'mysql', 'mongodb', 'graphql', 'rest', 'kubernetes', 'docker',
    'terraform', 'ci/cd', 'machine learning', 'data engineering', 'etl', 'spark',
    'leadership', 'stakeholder', 'communication', 'agile', 'security', 'testing',
  ];
  const found = phrases.filter((phrase) => text.includes(phrase));
  const repeatedTerms = [...text.matchAll(/\b[a-z][a-z0-9+#.-]{2,}\b/g)]
    .map(([term]) => term)
    .filter((term) => !COMMON_REVIEW_TERMS.has(term))
    .reduce((counts, term) => counts.set(term, (counts.get(term) || 0) + 1), new Map());
  const frequent = [...repeatedTerms.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])
    .map(([term]) => term);
  return [...new Set([...found, ...frequent])].slice(0, 24);
}

export function resumeTruthfulnessFlags({ resumeText, jobText, row }) {
  const flags = [];
  if (!resumeText) flags.push({ type: 'missing_source_resume', message: 'Profile resume text is missing, so claims cannot be checked.' });
  if (!jobText) flags.push({ type: 'missing_job_description', message: 'Job description text is missing, so ATS coverage is incomplete.' });
  if (row.request_type === 'manual' && clean(row.manual_job_description).length < 400) {
    flags.push({ type: 'short_manual_job_description', message: 'Manual job description is short; generated tailoring may lean on incomplete context.' });
  }
  if (resumeText && jobText) {
    const jobSeniority = seniorityTerms(jobText);
    const resumeSeniority = seniorityTerms(resumeText);
    if (jobSeniority.has('manager') && !resumeSeniority.has('manager') && !resumeSeniority.has('lead')) {
      flags.push({ type: 'seniority_gap', message: 'Job appears manager-level but profile resume does not show manager or lead experience.' });
    }
  }
  return flags;
}

export function reviewConfidence({ status, coverage, truthfulnessFlags, hasResume, hasJobText }) {
  let score = status === 'ready' ? 0.72 : 0.45;
  if (coverage !== null) score += Math.min(coverage, 1) * 0.18;
  if (hasResume) score += 0.05;
  if (hasJobText) score += 0.05;
  score -= truthfulnessFlags.length * 0.08;
  return Math.max(0.05, Math.min(0.98, Number(score.toFixed(2))));
}

export function seniorityTerms(value) {
  const text = String(value || '').toLowerCase();
  return new Set(['lead', 'manager', 'principal', 'staff', 'senior'].filter((term) => text.includes(term)));
}

export const COMMON_REVIEW_TERMS = new Set([
  'and', 'the', 'for', 'with', 'you', 'our', 'are', 'will', 'this', 'that', 'from', 'have',
  'has', 'your', 'job', 'role', 'team', 'work', 'who', 'can', 'all', 'not', 'but', 'about',
  'experience', 'years', 'skills', 'using', 'build', 'building', 'develop', 'developing',
]);

export function buildDailyApplications(rows, timeZone) {
  const emptySeries = buildEmptyDailyApplications(timeZone);
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

export function buildEmptyDailyApplications(timeZone) {
  return Array.from({ length: 14 }, (_item, index) => {
    return {
      date: localDateKeyDaysAgo(13 - index, new Date(), { timeZone }),
      applications: 0,
      sources: [],
    };
  });
}
