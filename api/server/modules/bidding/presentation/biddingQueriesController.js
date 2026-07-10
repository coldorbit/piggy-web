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
import { workspaceFilterForUser } from './biddingCollaborationController.js';
import { formatInterviewAsJob, interviewCallsByInterviewId, interviewLogsByInterviewId } from './biddingInterviewDomainController.js';

export function jobQueryForBidTab(query, tab) {
  if (!isCompletedBidTab(tab)) return query;
  return { ...query, since: 'all', dateFrom: '', dateTo: '' };
}

export function bidDateRangeForTab(query, tab, user) {
  if (!isCompletedBidTab(tab)) return null;
  return bidDateRange({
    since: clean(query?.since || 'all'),
    dateFrom: query?.dateFrom,
    dateTo: query?.dateTo,
    timeZone: user?.timezone,
  });
}

export function bidDateRange({ since, dateFrom, dateTo, timeZone }) {
  if (since === 'all') return null;
  if (since === 'custom') {
    const from = localDateRange(dateFrom, { timeZone })?.from || null;
    const to = localDateRange(dateTo, { timeZone })?.from || null;
    return { from, to: to ? addLocalDays(to, 1, { timeZone }) : null };
  }
  return presetBidDateRange(since, timeZone);
}

export function presetBidDateRange(since, timeZone) {
  return localPresetRange(since, new Date(), { timeZone });
}

export function isCompletedBidTab(tab) {
  return tab === 'done' || tab === 'bad_work';
}

export function isBidStrategyTab(tab) {
  return tab === 'todo' || tab === 'tailored';
}

export function shouldGroupBidTab(tab) {
  return isBidStrategyTab(tab);
}

export function groupedBidJobs(jobs) {
  const groups = new Map();

  for (const job of jobs) {
    const groupKey = bidJobGroupKey(job);
    const group = groups.get(groupKey);
    const option = bidJobLocationOption(job);
    if (!group) {
      groups.set(groupKey, {
        ...job,
        groupId: `bid-job-group:${groupKey}`,
        representativeJobId: job.id,
        locationOptions: [option],
      });
      continue;
    }

    group.locationOptions.push(option);
    const latestPostedAt = latestDateValue(group.postedAt, job.postedAt);
    const latestScrapedAt = latestDateValue(group.scrapedAt, job.scrapedAt);
    if (shouldPromoteBidJobRepresentative(group, job)) {
      const { groupId, locationOptions } = group;
      Object.assign(group, {
        ...job,
        groupId,
        representativeJobId: job.id,
        locationOptions,
      });
    }
    group.location = groupedBidLocationLabel(group.locationOptions);
    group.postedAt = latestPostedAt;
    group.scrapedAt = latestScrapedAt;
  }

  return [...groups.values()].map((group) => ({
    ...group,
    locationOptions: group.locationOptions.sort(compareBidLocationOptions),
  }));
}

export function bidJobGroupKey(job) {
  return [
    normalizeJobSource(job.source || 'Unknown source') || 'unknown source',
    normalizeBidGroupValue(job.title || 'Untitled role'),
    normalizeBidGroupValue(job.company || 'Unknown company'),
  ].join('::');
}

export function normalizeBidGroupValue(value) {
  return clean(value).toLowerCase().replace(/\s+/g, ' ') || 'unknown';
}

export function bidJobLocationOption(job) {
  return {
    ...job,
    groupJobId: job.id,
    locationLabel: job.location || 'Location not listed',
  };
}

export function shouldPromoteBidJobRepresentative(current, candidate) {
  const currentPriority = bidJobRepresentativePriority(current);
  const candidatePriority = bidJobRepresentativePriority(candidate);
  if (candidatePriority !== currentPriority) return candidatePriority > currentPriority;

  const currentTime = Date.parse(current.postedAt || current.scrapedAt || 0) || 0;
  const candidateTime = Date.parse(candidate.postedAt || candidate.scrapedAt || 0) || 0;
  if (candidateTime !== currentTime) return candidateTime > currentTime;

  return Number(candidate.id || 0) > Number(current.id || 0);
}

export function bidJobRepresentativePriority(job) {
  const tailoredStatusPriority = {
    ready: 5,
    processing: 4,
    requested: 3,
    dead_letter: 2,
  };
  return tailoredStatusPriority[job.tailoredResume?.status] || 1;
}

export function groupedBidLocationLabel(options) {
  const locations = [...new Set(options.map((option) => option.locationLabel).filter(Boolean))];
  if (locations.length <= 1) return locations[0] || '';
  return `${locations[0]} + ${locations.length - 1} more`;
}

export function compareBidLocationOptions(left, right) {
  return String(left.locationLabel || '').localeCompare(String(right.locationLabel || '')) || Number(left.id || 0) - Number(right.id || 0);
}

export function latestDateValue(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime > leftTime ? right : left;
}

export async function listInterviewJobs(req, res, { user, profile }) {
  const Interview = getInterviewModel();
  const TailoredResume = getTailoredResumeModel();
  const WebUser = getWebUserModel();
  const { limit, offset } = paginationFromQuery(req.query);
  const search = clean(req.query.search).toLowerCase();
  const where = {
    profileId: profile.id,
    ...(user.role === 'caller' ? { callerUserId: user.id } : {}),
    ...(search
      ? {
          [Op.or]: [
            { title: { [Op.iLike]: `%${search}%` } },
            { company: { [Op.iLike]: `%${search}%` } },
            { location: { [Op.iLike]: `%${search}%` } },
            { jobUrl: { [Op.iLike]: `%${search}%` } },
            { interviewNotes: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {}),
  };
  const [interviews, count, todoCount, tailoredCount, doneCount, badWorkCount, interviewsCount, bidUsers, callerUsers] = await Promise.all([
    Interview.findAll({
      where,
      order: [
        ['interviewNextAt', 'ASC'],
        ['updatedAt', 'DESC'],
      ],
      limit,
      offset,
    }),
    Interview.count({ where }),
    user.role === 'caller' ? Promise.resolve(0) : countBidTabForProfile({ profile, tab: 'todo', query: req.query, user }),
    user.role === 'caller' ? Promise.resolve(0) : countBidTabForProfile({ profile, tab: 'tailored', query: req.query, user }),
    user.role === 'caller' ? Promise.resolve(0) : countBidTabForProfile({ profile, tab: 'done', query: req.query, user }),
    user.role === 'caller' ? Promise.resolve(0) : countBidTabForProfile({ profile, tab: 'bad_work', query: req.query, user }),
    Interview.count({ where: { profileId: profile.id, ...(user.role === 'caller' ? { callerUserId: user.id } : {}) } }),
    bidUsersForProfile(profile),
    canRegisterManualInterviewCalls(user)
      ? WebUser.findAll({ where: { role: 'caller', ...workspaceFilterForUser(user) }, order: [['username', 'ASC']] })
      : Promise.resolve([]),
  ]);
  const [logsByInterviewId, callsByInterviewId] = await Promise.all([
    interviewLogsByInterviewId(interviews),
    interviewCallsByInterviewId(interviews, user),
  ]);
  const tailoredResumesByUrl = await tailoredResumesForJobs({
    TailoredResume,
    jobs: interviews.map((interview) => ({ url: interview.jobUrl })).filter((job) => job.url),
    profileId: profile.id,
  });
  const bidUsersById = new Map(bidUsers.map((bidUser) => [String(bidUser.id), bidUser]));
  const callerUsersById = new Map(callerUsers.map((caller) => [String(caller.id), { id: caller.id, username: caller.username }]));

  res.json({
    jobs: interviews.map((interview) => {
      interview.setDataValue('logs', logsByInterviewId.get(String(interview.id)) || []);
      interview.setDataValue('calls', callsByInterviewId.get(String(interview.id)) || []);
      return formatInterviewAsJob(interview, bidUsersById, callerUsersById, tailoredResumesByUrl.get(interview.jobUrl) || null);
    }),
    bidUsers,
    callerUsers: callerUsers.map((caller) => ({ id: caller.id, username: caller.username })),
    currentUser: { id: user.id, username: user.username, role: user.role },
    total: count,
    tabCounts: {
      todo: todoCount,
      tailored: tailoredCount,
      done: doneCount,
      badWork: badWorkCount,
      interviews: interviewsCount,
    },
    limit,
    offset,
  });
}

export async function countBidTabForProfile({ profile, tab, query, user, appliedProfileId = '' }) {
  const ScrapedJob = getScrapedJobModel();
  const JobBid = getJobBidModel();
  const sequelize = getSequelize();
  const { where } = buildJobQuery({
    ...jobQueryForBidTab(query, tab),
    bidTab: tab,
    profileId: profile.id,
    workspaceId: profile.workspaceId,
    limit: query.limit || 10,
  }, { timeZone: user?.timezone });
  const countQuery = buildBidTabQuery({
    where,
    tab,
    profileId: profile.id,
    appliedProfileId,
    bidDateRange: bidDateRangeForTab(query, tab, user),
    isStaticProfile: Boolean(profile.isStatic),
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
}

export function paginationFromQuery(query) {
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 250);
  const page = Math.max(Number(query.page || 1), 1);
  return { limit, offset: (page - 1) * limit };
}

export function countInterviewsForProfile(profileId) {
  return getInterviewModel().count({ where: { profileId } });
}

export async function assignedCallerProfile(user, profileId) {
  const id = clean(profileId);
  if (!id) throw new NotFoundError('Profile not found');
  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  if (!isProfileInUserWorkspace(profile, user)) {
    throw new NotFoundError('Profile not found');
  }
  const assignment = await getInterviewModel().findOne({ where: { profileId: profile.id, callerUserId: user.id } });
  if (!assignment) throw new NotFoundError('Profile not found');
  profile.setDataValue('shareStatus', 'caller');
  return profile;
}

export function requireInterviewAccessUser(user, res) {
  if (canAccessInterviews(user)) return;
  res.status(403).json({ error: 'Interview access required' });
}

export function isInternalUser(user) {
  return INTERNAL_DATA_ROLES.includes(user?.role);
}

export function canAccessInterviews(user) {
  return INTERVIEW_ACCESS_ROLES.includes(user?.role);
}

export function requireCallerManagementUser(user, res) {
  if (canManageCallers(user)) return;
  res.status(403).json({ error: 'Caller registration is not available for this role' });
}

export function canManageCallers(user) {
  return canManageCallersRole(user);
}

export function ensureProfileBidEligible(profile, res) {
  if (!isLegacyProfile(profile)) return true;
  res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding or tailoring' });
  return false;
}

export function ensureProfileTailoringEligible(profile, res) {
  if (!ensureProfileBidEligible(profile, res)) return false;
  if (!profile.isStatic) return true;
  res.status(400).json({ error: 'Static profiles use their uploaded resume and cannot request tailoring' });
  return false;
}

export function isInterviewBidStatus(status) {
  return ['interviewing', 'won', 'lost'].includes(status);
}

export async function bidUsersForProfile(profile) {
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

export async function appliedProfileFilter(req, value) {
  const profileId = clean(value);
  if (!profileId || profileId === 'all') return '';
  const profile = await accessibleAppliedProfile(req, profileId, req.query.profileId);
  return profile.id;
}

export function formatBidWithUser(row, bidUsersById, callerUsersById) {
  const bid = formatBid(row);
  const bidUser = bidUsersById.get(String(row.userId));
  const caller = callerUsersById?.get(String(row.callerUserId || ''));
  return {
    ...bid,
    user: bidUser || null,
    caller: caller || null,
  };
}

export async function dailyBidProgressForUser(user, filters = {}) {
  const goal = Number(user.dailyBidGoal || 0);
  if (!goal) return { goal: null, finished: 0 };

  // Goal progress uses the user's local timezone; cumulative presets collapse to a single day.
  const dailyGoalRange = filters?.from && filters?.to ? filters : dailyGoalRangeForUserBidFilter(filters, user);
  const { from, to } = dailyGoalRange;
  const finished = await getJobBidModel().count({
    where: {
      userId: user.id,
      status: { [Op.in]: DAILY_BID_GOAL_STATUSES },
      bidAt: { [Op.gte]: from, [Op.lt]: to },
    },
  });

  return { goal, finished };
}

export async function sameCompanyTailoringByJobUrl({ sequelize, profileId, jobs }) {
  const companyByJobUrl = new Map(
    jobs
      .map((job) => [job.url, normalizeCompany(job.company)])
      .filter(([jobUrl, company]) => jobUrl && company),
  );
  const companies = [...new Set(companyByJobUrl.values())];
  if (!companies.length) return new Map();

  const [rows] = await sequelize.query(
    `
      SELECT
        tailored_resumes.id,
        tailored_resumes.job_url,
        tailored_resumes.status,
        tailored_resumes.created_at,
        tailored_resumes.updated_at,
        scraped_jobs.title,
        scraped_jobs.company,
        scraped_jobs.posted_at,
        scraped_jobs.scraped_at,
        scraped_jobs.url
      FROM tailored_resumes
      JOIN scraped_jobs ON md5(scraped_jobs.url) = md5(tailored_resumes.job_url)
        AND scraped_jobs.url = tailored_resumes.job_url
      WHERE tailored_resumes.profile_id = :profileId
        AND tailored_resumes.status IN (:statuses)
        AND scraped_jobs.normalized_company IN (:companies)
      ORDER BY tailored_resumes.created_at DESC NULLS LAST, tailored_resumes.updated_at DESC NULLS LAST
    `,
    {
      replacements: {
        profileId,
        statuses: ACTIVE_TAILORED_RESUME_STATUSES,
        companies,
      },
    },
  );

  const priorByCompany = new Map();
  for (const row of rows) {
    const company = normalizeCompany(row.company);
    if (!company) continue;
    const entries = priorByCompany.get(company) || [];
    entries.push(row);
    priorByCompany.set(company, entries);
  }

  const now = new Date();
  const result = new Map();
  for (const job of jobs) {
    const company = companyByJobUrl.get(job.url);
    if (!company) continue;
    const prior = (priorByCompany.get(company) || []).find((row) => String(row.job_url) !== String(job.url));
    if (!prior) continue;
    result.set(job.url, sameCompanyTailoringSummary(prior, now));
  }

  return result;
}

export async function existingTailoredResumesByJobUrl({ profileId, jobs }) {
  const jobUrls = [...new Set(jobs.map((job) => clean(job.url)).filter(Boolean))];
  if (!jobUrls.length) return new Map();

  const rows = await getTailoredResumeModel().findAll({
    where: {
      profileId,
      jobUrl: { [Op.in]: jobUrls },
    },
    order: [['jobUrl', 'ASC'], ['updatedAt', 'DESC']],
  });

  const rowsByJobUrl = new Map();
  for (const row of rows) {
    if (!rowsByJobUrl.has(row.jobUrl)) rowsByJobUrl.set(row.jobUrl, row);
  }
  return rowsByJobUrl;
}

export async function findSameCompanyTailoringConflicts({ sequelize, profileId, job }) {
  const company = normalizeCompany(job.company);
  if (!company || !job.url) return [];

  const [rows] = await sequelize.query(
    `
      SELECT
        tailored_resumes.id,
        tailored_resumes.job_url,
        tailored_resumes.status,
        tailored_resumes.created_at,
        tailored_resumes.updated_at,
        scraped_jobs.title,
        scraped_jobs.company,
        scraped_jobs.posted_at,
        scraped_jobs.scraped_at,
        scraped_jobs.url
      FROM tailored_resumes
      JOIN scraped_jobs ON md5(scraped_jobs.url) = md5(tailored_resumes.job_url)
        AND scraped_jobs.url = tailored_resumes.job_url
      WHERE tailored_resumes.profile_id = :profileId
        AND tailored_resumes.job_url <> :jobUrl
        AND tailored_resumes.status IN (:statuses)
        AND lower(regexp_replace(btrim(coalesce(scraped_jobs.company, '')), '\\s+', ' ', 'g')) = :company
      ORDER BY tailored_resumes.created_at DESC NULLS LAST, tailored_resumes.updated_at DESC NULLS LAST
    `,
    {
      replacements: {
        profileId,
        jobUrl: job.url,
        statuses: ACTIVE_TAILORED_RESUME_STATUSES,
        company,
      },
    },
  );

  return rows
    .map((row) => sameCompanyTailoringSummary(row))
    .filter((summary) => summary.daysSincePrior <= SAME_COMPANY_TAILORING_WINDOW_DAYS);
}

export function sameCompanyTailoringSummary(row, now = new Date()) {
  const priorAt = row.created_at || row.updated_at || null;
  const priorPostedAt = row.posted_at || row.scraped_at || null;
  const daysSincePrior = daysSince(priorAt, now);
  return {
    priorTailoredResumeId: row.id,
    priorJobUrl: row.job_url || row.url,
    priorTitle: row.title || 'Untitled role',
    priorCompany: row.company || 'Unknown company',
    priorStatus: row.status,
    priorAt,
    priorPostedAt,
    daysSincePriorPosting: daysSince(priorPostedAt, now),
    daysSincePrior,
    requiresConfirmation: daysSincePrior <= SAME_COMPANY_TAILORING_WINDOW_DAYS,
  };
}

export function normalizeCompany(value) {
  return clean(value)
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co)\.?$/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function daysSince(value, now = new Date()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(Math.floor((now.getTime() - timestamp) / DAY_MS), 0);
}
