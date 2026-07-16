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
import { buildJobQuery, formatJob, jobDateFiltersForUser, jobSourceLabel, jobSummaryAttributes, normalizeJobSource } from '../../jobs/application/jobsService.js';
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
import { appliedProfileFilter, assignedCallerProfile, bidDateRange, bidDateRangeForTab, bidUsersForProfile, countInterviewsForProfile, dailyBidProgressForUser, ensureProfileBidEligible, formatBidWithUser, groupedBidJobs, isInternalUser, jobQueryForBidTab, listInterviewJobs, requireInterviewAccessUser, sameCompanyBidByJobId, shouldGroupBidTab } from './biddingQueriesController.js';

export async function listBidJobs(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const bidTab = clean(req.query.bidTab || 'todo');
    const query = jobDateFiltersForUser(req.query, user);
    const profile = user.role === 'caller' && bidTab === 'interviews'
      ? await assignedCallerProfile(user, query.profileId)
      : await accessibleProfile(req, query.profileId);
    const canViewInternalData = isInternalUser(user);
    if (bidTab === 'interviews') {
      requireInterviewAccessUser(user, res);
      if (res.headersSent) return;
      await listInterviewJobs(req, res, { user, profile });
      return;
    }
    if (!ensureProfileBidEligible(profile, res)) return;
    const ScrapedJob = getScrapedJobModel();
    const JobBid = getJobBidModel();
    const TailoredResume = getTailoredResumeModel();
    const WebUser = getWebUserModel();
    const sequelize = getSequelize();
    const activeBidDateRange = bidDateRangeForTab(query, bidTab, user);
    const { where, order: jobOrder, limit, offset } = buildJobQuery({
      ...jobQueryForBidTab(query, bidTab),
      workspaceId: profile.workspaceId,
      limit: query.limit || 10,
    }, { timeZone: user.timezone });
    const appliedProfileId = bidTab === 'todo' ? await appliedProfileFilter(req, req.query.appliedProfileId) : '';
    const activeTabQuery = buildBidTabQuery({
      where,
      tab: bidTab,
      profileId: profile.id,
      appliedProfileId,
      bidDateRange: activeBidDateRange,
      isStaticProfile: Boolean(profile.isStatic),
      JobBid,
      sequelize,
    });

    const includeTabCounts = clean(req.query.includeTabCounts) !== 'false';
    const tabCountsPromise = includeTabCounts
      ? bidTabCountsForProfile({ profile, query, user, appliedProfileId, activeBidTab: bidTab })
      : Promise.resolve({ todo: 0, tailored: 0, done: 0, badWork: 0 });

    const [
      rows,
      tabCounts,
      interviewsCount,
      bidUsers,
      callerUsers,
    ] = await Promise.all([
      ScrapedJob.findAll({
        attributes: jobSummaryAttributes(),
        where: activeTabQuery.where,
        order: activeTabQuery.order || jobOrder,
        limit,
        offset,
        subQuery: false,
        include: activeTabQuery.include,
      }),
      tabCountsPromise,
      canViewInternalData && includeTabCounts ? countInterviewsForProfile(profile.id) : Promise.resolve(0),
      bidUsersForProfile(profile),
      canViewInternalData
        ? WebUser.findAll({
            where: { role: 'caller', ...workspaceFilterForUser(user) },
            order: [['username', 'ASC']],
          })
        : Promise.resolve([]),
    ]);
    const { todo: todoCount, tailored: tailoredCount, done: doneCount, badWork: badWorkCount } = tabCounts;

    const [tailoredResumesByUrl, sameCompanyBidById] = await Promise.all([
      tailoredResumesForJobs({ TailoredResume, jobs: rows, profileId: profile.id }),
      sameCompanyBidByJobId({ sequelize, profileId: profile.id, jobs: rows }),
    ]);
    const bidUsersById = new Map(bidUsers.map((bidUser) => [String(bidUser.id), bidUser]));
    const callerUsersById = new Map(callerUsers.map((caller) => [String(caller.id), { id: caller.id, username: caller.username }]));

    const formattedJobs = rows.map((job) => ({
      ...formatBidJob(job),
      bid: job.bids?.[0] ? formatBidWithUser(job.bids[0], bidUsersById, callerUsersById) : null,
      tailoredResume: tailoredResumesByUrl.get(job.url) || null,
      sameCompanyBid: sameCompanyBidById.get(String(job.id)) || null,
    }));
    const tabJobs = shouldGroupBidTab(bidTab) ? groupedBidJobs(formattedJobs) : formattedJobs;
    const activeTabCount = bidTab === 'tailored'
      ? tailoredCount
      : bidTab === 'done'
        ? doneCount
        : bidTab === 'bad_work'
          ? badWorkCount
          : todoCount;

    res.json({
      jobs: tabJobs,
      bidUsers,
      callerUsers: callerUsers.map((caller) => ({ id: caller.id, username: caller.username })),
      currentUser: {
        id: user.id,
        username: user.username,
        role: user.role,
        dailyBidGoal: Number(user.dailyBidGoal || 0) || null,
      },
      profile: formatBidProfile(profile),
      total: activeTabCount,
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
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listBidJobCounts(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const activeBidTab = clean(req.query.bidTab || 'todo');
    const query = jobDateFiltersForUser(req.query, user);
    const profile = await accessibleProfile(req, query.profileId);
    if (!ensureProfileBidEligible(profile, res)) return;
    const appliedProfileId = activeBidTab === 'todo' ? await appliedProfileFilter(req, req.query.appliedProfileId) : '';
    const [tabCounts, interviews] = await Promise.all([
      bidTabCountsForProfile({ profile, query, user, appliedProfileId, activeBidTab }),
      isInternalUser(user) ? countInterviewsForProfile(profile.id) : Promise.resolve(0),
    ]);
    res.json({ ...tabCounts, interviews });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

async function bidTabCountsForProfile({ profile, query, user, appliedProfileId = '', activeBidTab = 'todo' }) {
  const ScrapedJob = getScrapedJobModel();
  const JobBid = getJobBidModel();
  const sequelize = getSequelize();
  const countBidTab = (tab) => {
    const { where } = buildJobQuery({
      ...jobQueryForBidTab(query, tab),
      workspaceId: profile.workspaceId,
      limit: query.limit || 10,
    }, { timeZone: user.timezone });
    const countQuery = buildBidTabQuery({
      where,
      tab,
      profileId: profile.id,
      appliedProfileId: tab === 'todo' && activeBidTab === 'todo' ? appliedProfileId : '',
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
  };
  const [todo, tailored, done, badWork] = await Promise.all([
    countBidTab('todo'),
    countBidTab('tailored'),
    countBidTab('done'),
    countBidTab('bad_work'),
  ]);
  return { todo, tailored, done, badWork };
}

export function formatBidJob(job) {
  const formatted = formatJob(job);
  delete formatted.listingText;
  return formatted;
}

export function formatBidProfile(profile) {
  const formatted = formatProfile(profile);
  delete formatted.progress;
  return formatted;
}
