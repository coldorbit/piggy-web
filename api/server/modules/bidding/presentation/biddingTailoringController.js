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
import { ensureProfileTailoringEligible, existingTailoredResumesByJobUrl, findSameCompanyTailoringConflicts, sameCompanyTailoringByJobUrl } from './biddingQueriesController.js';
import { ensureTailoredResumeAccess, escapeHeaderValue, fetchTailoredResumeFile, formatTailoringRequest, readyTailoredResumeForUser, uniqueZipName, validHttpUrl } from './biddingApplicationsController.js';
import { numericBatchIds } from './biddingInterviewEndpointsController.js';

export async function createTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    if (!ensureProfileTailoringEligible(profile, res)) return;
    const sequelize = getSequelize();
    const job = await getScrapedJobModel().findByPk(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const TailoredResume = getTailoredResumeModel();
    const sameCompanyConflicts = await findSameCompanyTailoringConflicts({
      sequelize,
      profileId: profile.id,
      job,
    });
    if (sameCompanyConflicts.length && req.body?.confirmSameCompany !== true) {
      const prior = sameCompanyConflicts[0];
      res.status(409).json({
        error: `Different role at same company: ${prior.priorTitle} was tailored ${prior.daysSincePrior} day${prior.daysSincePrior === 1 ? '' : 's'} ago.`,
        code: 'same_company_tailoring_conflict',
        sameCompanyTailoring: prior,
      });
      return;
    }

    if (sameCompanyConflicts.length) {
      await TailoredResume.update(
        {
          status: 'invalid',
          lastError: 'Invalidated by newer same-company tailoring request',
          deadLetterAt: new Date(),
        },
        {
          where: {
            id: { [Op.in]: sameCompanyConflicts.map((conflict) => conflict.priorTailoredResumeId) },
            profileId: profile.id,
            status: { [Op.in]: ACTIVE_TAILORED_RESUME_STATUSES },
          },
        },
      );
    }

    const existing = await TailoredResume.findOne({
      where: { profileId: profile.id, jobUrl: job.url },
      order: [['updatedAt', 'DESC']],
    });

    const attrs = tailoredResumeRequestAttrs({ userId: user.id, profileId: profile.id, jobUrl: job.url });
    const tailoredResume = existing ? await existing.update(attrs) : await TailoredResume.create(attrs);
    await enqueueTailoredResumeRequest({ tailoredResumeId: tailoredResume.id });

    res.status(202).json({
      tailoredResume: formatTailoredResume(tailoredResume),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function bulkCreateTailoredResumes(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    if (!ensureProfileTailoringEligible(profile, res)) return;
    const jobIds = numericBatchIds(req.body?.jobIds || req.body?.ids, 'jobIds');
    const confirmSameCompany = req.body?.confirmSameCompany === true;
    const sequelize = getSequelize();
    const ScrapedJob = getScrapedJobModel();
    const TailoredResume = getTailoredResumeModel();
    const jobs = await ScrapedJob.findAll({ where: { id: { [Op.in]: jobIds } } });
    const jobsById = new Map(jobs.map((job) => [String(job.id), job]));
    const [sameCompanyByJobUrl, existingByJobUrl] = await Promise.all([
      sameCompanyTailoringByJobUrl({ sequelize, profileId: profile.id, jobs }),
      existingTailoredResumesByJobUrl({ sequelize, profileId: profile.id, jobs }),
    ]);
    const priorIdsToInvalidate = confirmSameCompany
      ? new Set([...sameCompanyByJobUrl.values()].filter((conflict) => conflict.requiresConfirmation).map((conflict) => conflict.priorTailoredResumeId))
      : new Set();
    if (priorIdsToInvalidate.size) {
      await TailoredResume.update(
        {
          status: 'invalid',
          lastError: 'Invalidated by newer same-company tailoring request',
          deadLetterAt: new Date(),
        },
        {
          where: {
            id: { [Op.in]: [...priorIdsToInvalidate] },
            profileId: profile.id,
            status: { [Op.in]: ACTIVE_TAILORED_RESUME_STATUSES },
          },
        },
      );
    }
    const results = [];

    for (const jobId of jobIds) {
      const job = jobsById.get(String(jobId));
      if (!job) {
        results.push({ jobId: String(jobId), ok: false, error: 'Job not found' });
        continue;
      }

      try {
        const sameCompanyConflict = sameCompanyByJobUrl.get(job.url);
        if (sameCompanyConflict?.requiresConfirmation && !confirmSameCompany) {
          results.push({
            jobId: String(job.id),
            ok: false,
            code: 'same_company_tailoring_conflict',
            error: `Different role at same company: ${sameCompanyConflict.priorTitle} was tailored ${sameCompanyConflict.daysSincePrior} day${sameCompanyConflict.daysSincePrior === 1 ? '' : 's'} ago.`,
            sameCompanyTailoring: sameCompanyConflict,
          });
          continue;
        }

        const existing = existingByJobUrl.get(job.url);
        const attrs = tailoredResumeRequestAttrs({ userId: user.id, profileId: profile.id, jobUrl: job.url });
        const tailoredResume = existing ? await existing.update(attrs) : await TailoredResume.create(attrs);
        await enqueueTailoredResumeRequest({ tailoredResumeId: tailoredResume.id });
        results.push({ jobId: String(job.id), ok: true, tailoredResume: formatTailoredResume(tailoredResume) });
      } catch (error) {
        results.push({ jobId: String(job.id), ok: false, error: error.message || 'Tailoring request failed' });
      }
    }

    res.status(202).json({
      requested: jobIds.length,
      created: results.filter((result) => result.ok).length,
      results,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createManualTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    if (!ensureProfileTailoringEligible(profile, res)) return;
    const attrs = manualTailoringAttributesFromBody(req.body);
    const TailoredResume = getTailoredResumeModel();
    const tailoredResume = await TailoredResume.create({
      userId: user.id,
      profileId: profile.id,
      jobUrl: attrs.jobUrl,
      requestType: 'manual',
      manualCompany: attrs.company,
      manualRole: attrs.role,
      manualJobDescription: attrs.jobDescription,
      status: 'requested',
      filePath: null,
      readyAt: null,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      deadLetterAt: null,
      downloadedAt: null,
    });
    await enqueueTailoredResumeRequest({ tailoredResumeId: tailoredResume.id });

    res.status(202).json({
      tailoredResume: formatTailoredResume(tailoredResume),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function cancelTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const tailoredResume = await getTailoredResumeModel().findByPk(req.params.id);
    if (!tailoredResume) {
      res.status(404).json({ error: 'Tailoring request not found' });
      return;
    }
    await ensureTailoredResumeAccess(req, tailoredResume);

    if (!['requested', 'processing'].includes(tailoredResume.status)) {
      res.status(400).json({ error: 'Only queued or processing tailoring requests can be stopped' });
      return;
    }

    await tailoredResume.update({
      status: 'cancelled',
      filePath: null,
      readyAt: null,
      lastError: null,
      deadLetterAt: null,
      downloadedAt: null,
    });

    res.json({ tailoredResume: formatTailoredResume(tailoredResume) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export function manualTailoringAttributesFromBody(body = {}) {
  const company = clean(body.company || body.companyName);
  const role = clean(body.role || body.title || body.positionTitle);
  const jobUrl = clean(body.url || body.jobUrl);
  const jobDescription = clean(body.jobDescription || body.jdContent || body.listingText);

  if (!company) throw new InputError('Company name is required');
  if (!role) throw new InputError('Role or position title is required');
  if (!jobUrl) throw new InputError('Job URL is required');
  if (!validHttpUrl(jobUrl)) throw new InputError('Job URL must be a valid URL');
  if (!jobDescription) throw new InputError('Job description content is required');

  return { company, role, jobUrl, jobDescription };
}

export function tailoredResumeRequestAttrs({ userId, profileId, jobUrl }) {
  return {
    userId,
    profileId,
    jobUrl,
    requestType: 'job',
    manualCompany: null,
    manualRole: null,
    manualJobDescription: null,
    status: 'requested',
    filePath: null,
    readyAt: null,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    deadLetterAt: null,
    downloadedAt: null,
  };
}

export async function listTailoringRequests(req, res, next) {
  try {
    await ensureWebModels();
    const sequelize = getSequelize();
    const user = await currentDbUser(req);
    const canViewAllTailoring = isSuperadmin(user);
    const visibleProfiles = canViewAllTailoring ? [] : await profilesVisibleToUser(user);
    const visibleProfileIds = visibleProfiles.map((profile) => String(profile.id)).filter(Boolean);
    const requestedStatus = clean(req.query?.status || 'all').toLowerCase();
    const status = TAILORED_REQUEST_STATUSES.includes(requestedStatus) ? requestedStatus : 'all';
    const profileId = clean(req.query?.profileId || 'all');
    const search = clean(req.query?.search).toLowerCase();
    const dateRange = tailoringDateRange({
      since: clean(req.query?.since || 'all'),
      dateFrom: req.query?.dateFrom,
      dateTo: req.query?.dateTo,
      timeZone: user.timezone,
    });
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.max(1, Math.min(Number(req.query?.limit) || 50, 100));
    const replacements = {
      status,
      profileId,
      searchPattern: `%${search}%`,
      canViewAllTailoring,
      visibleProfileIds: visibleProfileIds.length ? visibleProfileIds : ['-1'],
      hasDateFrom: Boolean(dateRange?.from),
      hasDateTo: Boolean(dateRange?.to),
      dateFromValue: dateRange?.from || null,
      dateToValue: dateRange?.to || null,
      limit,
      offset: (page - 1) * limit,
    };
    const baseWhereSql = `
      WHERE (:canViewAllTailoring = true OR tailored_resumes.profile_id::text IN (:visibleProfileIds))
        AND (:profileId = 'all' OR tailored_resumes.profile_id::text = :profileId)
        AND (:hasDateFrom = false OR tailored_resumes.created_at >= CAST(:dateFromValue AS timestamptz))
        AND (:hasDateTo = false OR tailored_resumes.created_at < CAST(:dateToValue AS timestamptz))
        AND (
          :searchPattern = '%%'
          OR LOWER(COALESCE(scraped_jobs.title, '')) LIKE :searchPattern
          OR LOWER(COALESCE(scraped_jobs.company, '')) LIKE :searchPattern
          OR LOWER(COALESCE(tailored_resumes.manual_role, '')) LIKE :searchPattern
          OR LOWER(COALESCE(tailored_resumes.manual_company, '')) LIKE :searchPattern
          OR LOWER(COALESCE(tailored_resumes.manual_job_description, '')) LIKE :searchPattern
          OR LOWER(COALESCE(scraped_jobs.location, '')) LIKE :searchPattern
          OR LOWER(COALESCE(bid_profiles.name, '')) LIKE :searchPattern
          OR LOWER(COALESCE(request_user.username, '')) LIKE :searchPattern
          OR LOWER(COALESCE(owner_user.username, '')) LIKE :searchPattern
          OR LOWER(COALESCE(tailored_resumes.job_url, '')) LIKE :searchPattern
        )
    `;
    const whereSql = `
      ${baseWhereSql}
        AND (:status = 'all' OR tailored_resumes.status = :status)
    `;

    const requests = await sequelize.query(
      `
      SELECT
        tailored_resumes.id,
        tailored_resumes.user_id,
        tailored_resumes.profile_id,
        tailored_resumes.job_url,
        tailored_resumes.request_type,
        tailored_resumes.manual_company,
        tailored_resumes.manual_role,
        tailored_resumes.manual_job_description,
        tailored_resumes.status,
        tailored_resumes.file_path,
        tailored_resumes.cv_data,
        tailored_resumes.ready_at,
        tailored_resumes.attempts,
        tailored_resumes.max_attempts,
        tailored_resumes.last_error,
        tailored_resumes.dead_letter_at,
        tailored_resumes.downloaded_at,
        tailored_resumes.created_at,
        tailored_resumes.updated_at,
        request_user.username AS requester_username,
        bid_profiles.name AS profile_name,
        bid_profiles.resume_text AS profile_resume_text,
        bid_profiles.user_id AS profile_owner_user_id,
        owner_user.username AS profile_owner_username,
        scraped_jobs.id AS job_id,
        scraped_jobs.title,
        scraped_jobs.company,
        scraped_jobs.location,
        scraped_jobs.source,
        scraped_jobs.listing_text,
        scraped_jobs.posted_at,
        scraped_jobs.scraped_at
      FROM tailored_resumes
      LEFT JOIN web_users request_user ON request_user.id = tailored_resumes.user_id
      LEFT JOIN bid_profiles ON bid_profiles.id = tailored_resumes.profile_id
      LEFT JOIN web_users owner_user ON owner_user.id = bid_profiles.user_id
      LEFT JOIN scraped_jobs ON md5(scraped_jobs.url) = md5(tailored_resumes.job_url)
        AND scraped_jobs.url = tailored_resumes.job_url
      ${whereSql}
      ORDER BY tailored_resumes.updated_at DESC
      LIMIT :limit
      OFFSET :offset
      `,
      { replacements, type: QueryTypes.SELECT },
    );

    const [totalRows, statusCounts, profileRows] = await Promise.all([
      sequelize.query(
        `
        SELECT COUNT(*)::int AS count
        FROM tailored_resumes
        LEFT JOIN web_users request_user ON request_user.id = tailored_resumes.user_id
        LEFT JOIN bid_profiles ON bid_profiles.id = tailored_resumes.profile_id
        LEFT JOIN web_users owner_user ON owner_user.id = bid_profiles.user_id
        LEFT JOIN scraped_jobs ON md5(scraped_jobs.url) = md5(tailored_resumes.job_url)
          AND scraped_jobs.url = tailored_resumes.job_url
        ${whereSql}
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `
        SELECT status, COUNT(*)::int AS count
        FROM tailored_resumes
        LEFT JOIN web_users request_user ON request_user.id = tailored_resumes.user_id
        LEFT JOIN bid_profiles ON bid_profiles.id = tailored_resumes.profile_id
        LEFT JOIN web_users owner_user ON owner_user.id = bid_profiles.user_id
        LEFT JOIN scraped_jobs ON md5(scraped_jobs.url) = md5(tailored_resumes.job_url)
          AND scraped_jobs.url = tailored_resumes.job_url
        ${baseWhereSql}
        GROUP BY status
        ORDER BY status ASC
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `
        SELECT
          tailored_resumes.profile_id AS id,
          COALESCE(bid_profiles.name, 'Unknown profile') AS name,
          COALESCE(owner_user.username, 'Unknown owner') AS owner_username,
          COUNT(*)::int AS count
        FROM tailored_resumes
        LEFT JOIN bid_profiles ON bid_profiles.id = tailored_resumes.profile_id
        LEFT JOIN web_users owner_user ON owner_user.id = bid_profiles.user_id
        WHERE (:canViewAllTailoring = true OR tailored_resumes.profile_id::text IN (:visibleProfileIds))
        GROUP BY tailored_resumes.profile_id, bid_profiles.name, owner_user.username
        ORDER BY COALESCE(bid_profiles.name, 'Unknown profile') ASC, tailored_resumes.profile_id ASC
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
    ]);

    res.json({
      requests: requests.map(formatTailoringRequest),
      total: Number(totalRows[0]?.count || 0),
      page,
      limit,
      statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, Number(row.count || 0)])),
      profiles: profileRows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerUsername: row.owner_username,
        count: Number(row.count || 0),
      })),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export function tailoringDateRange({ since, dateFrom, dateTo, timeZone }) {
  if (since === 'all') return null;
  if (since === 'custom') {
    const from = localDateRange(dateFrom, { timeZone })?.from || null;
    const to = localDateRange(dateTo, { timeZone })?.from || null;
    return { from, to: to ? addLocalDays(to, 1, { timeZone }) : null };
  }
  return presetTailoringDateRange(since, timeZone);
}

export function presetTailoringDateRange(since, timeZone) {
  return localPresetRange(since, new Date(), { timeZone });
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

export async function markTailoredResumeDownloaded(tailoredResume) {
  if (!tailoredResume.downloadedAt) {
    await tailoredResume.update({ downloadedAt: new Date() });
  }
}
