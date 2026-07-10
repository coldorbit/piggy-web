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
import { canManageProfiles, manageableProfile } from './biddingProfilesController.js';
import { requireCallerManagementUser } from './biddingQueriesController.js';
import { buildDailyApplications, buildEmptyDailyApplications, formatProfileShareRequest } from './biddingApplicationsController.js';
import { formatCallerAssignment } from './biddingInterviewDomainController.js';

export async function listProfiles(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const scope = clean(req.query?.scope);
    const query = jobDateFiltersForUser(req.query, user);
    let profiles;
    if (scope === 'applied-filter') {
      const activeProfileId = clean(req.query?.profileId);
      const activeProfile = activeProfileId ? await accessibleProfile(req, activeProfileId) : null;
      profiles = await profilesForAppliedFilter(user, {
        profileBadge: activeProfile?.profileBadge,
        workspaceId: activeProfile ? activeProfile.workspaceId : user.workspaceId,
      });
    } else if (scope === 'manage' && isAdminRole(user)) {
      profiles = await profilesManagedByUser(user);
    } else {
      profiles = await profilesVisibleToUser(user);
    }
    const visibleProfiles = sortProfilesForDisplay(await profilesWithSharing(await profilesWithProgress(profiles, { user, dailyGoalFilters: query })));
    res.json({ profiles: visibleProfiles.map(formatProfile) });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'This profile already has a bid for this job' });
      return;
    }
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
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'This profile already has a bid for this job' });
      return;
    }
    handleInputError(error, res, next);
  }
}

export async function listProfileShareRecipients(req, res, next) {
  try {
    await ensureWebModels();
    const users = await repositories.listUsers();
    res.json({
      users: users.map((row) => ({
        id: row.id,
        username: row.username,
        role: row.role,
        workspaceId: row.workspaceId || null,
        workspace: row.workspace ? {
          id: row.workspace.id,
          name: row.workspace.name,
          slug: row.workspace.slug,
        } : null,
      })),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listCollaborationEvents(req, res, next) {
  try {
    await ensureWebModels();
    const context = await collaborationContextFromQuery(req);
    const CollaborationEvent = getCollaborationEventModel();
    const WebUser = getWebUserModel();
    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 100);
    const where = context.where;

    const events = await CollaborationEvent.findAll({
      where,
      include: [
        { model: WebUser, as: 'author', required: false },
        { model: WebUser, as: 'assignedTo', required: false },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
    });

    res.json({ events: events.map(formatCollaborationEvent) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createCollaborationEvent(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const attrs = await collaborationAttributesFromBody(req, user);
    const event = await getCollaborationEventModel().create(attrs);
    const hydrated = await collaborationEventById(event.id);
    res.status(201).json({ event: formatCollaborationEvent(hydrated || event) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateCollaborationEvent(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const CollaborationEvent = getCollaborationEventModel();
    const event = await CollaborationEvent.findByPk(req.params.id);
    if (!event) throw new NotFoundError('Collaboration event not found');
    await ensureCollaborationEventWritable(req, event);

    const hasResolved = Object.prototype.hasOwnProperty.call(req.body || {}, 'resolved');
    const body = Object.prototype.hasOwnProperty.call(req.body || {}, 'body') ? clean(req.body.body) : undefined;
    const updates = {};
    if (body !== undefined) {
      if (!body) throw new InputError('Note is required');
      updates.body = body;
      updates.mentions = await mentionsForBody(req.body, body);
    }
    if (hasResolved) updates.resolvedAt = req.body.resolved ? new Date() : null;
    updates.metadata = {
      ...(event.metadata || {}),
      lastEditedByUserId: user.id,
      lastEditedAt: new Date().toISOString(),
    };

    await event.update(updates);
    const hydrated = await collaborationEventById(event.id);
    res.json({ event: formatCollaborationEvent(hydrated || event) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function collaborationContextFromQuery(req) {
  const entityType = normalizeCollaborationEntityType(req.query?.entityType || req.query?.type);
  const entityId = numericIdOrNull(req.query?.entityId || req.query?.id);
  const profileId = numericIdOrNull(req.query?.profileId);

  if (entityType && entityId) {
    const context = await collaborationContextForEntity(req, entityType, entityId);
    return { where: { entityType, entityId: context.entityId } };
  }

  if (profileId) {
    const profile = await accessibleProfile(req, profileId);
    return { where: { profileId: profile.id } };
  }

  throw new InputError('Choose a profile or collaboration entity');
}

export async function collaborationAttributesFromBody(req, user) {
  const entityType = normalizeCollaborationEntityType(req.body?.entityType || req.body?.type);
  const entityId = numericIdOrNull(req.body?.entityId || req.body?.id);
  if (!entityType || !entityId) throw new InputError('Choose a collaboration entity');
  const context = await collaborationContextForEntity(req, entityType, entityId);
  const eventType = normalizeCollaborationEventType(req.body?.eventType || req.body?.type || 'comment');
  const body = clean(req.body?.body || req.body?.note || req.body?.comment);
  if (!body) throw new InputError('Note is required');
  const assignedToUserId = await assignedUserIdFromBody(req.body);

  return {
    entityType,
    entityId: context.entityId,
    profileId: context.profileId,
    jobId: context.jobId,
    bidId: context.bidId,
    authorUserId: user.id,
    assignedToUserId,
    eventType,
    body,
    mentions: await mentionsForBody(req.body, body),
    metadata: {
      ...(req.body?.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata) ? req.body.metadata : {}),
      createdVia: 'api',
    },
  };
}

export async function collaborationContextForEntity(req, entityType, entityId) {
  if (entityType === 'profile') {
    const profile = await accessibleProfile(req, entityId);
    return { entityId: profile.id, profileId: profile.id, jobId: null, bidId: null };
  }

  if (entityType === 'bid') {
    const bid = await getJobBidModel().findByPk(entityId);
    if (!bid) throw new NotFoundError('Bid not found');
    await accessibleProfile(req, bid.profileId);
    return { entityId: bid.id, profileId: bid.profileId, jobId: bid.jobId, bidId: bid.id };
  }

  if (entityType === 'job') {
    const profileId = numericIdOrNull(req.body?.profileId || req.query?.profileId);
    const profile = profileId ? await accessibleProfile(req, profileId) : null;
    const job = await getScrapedJobModel().findByPk(entityId);
    if (!job) throw new NotFoundError('Job not found');
    return { entityId: job.id, profileId: profile?.id || null, jobId: job.id, bidId: null };
  }

  throw new InputError('Choose a valid collaboration entity');
}

export async function ensureCollaborationEventWritable(req, event) {
  await collaborationContextForEntity(req, event.entityType, event.entityId);
  if (isAdminRole(req.user) || String(event.authorUserId || '') === String(req.user?.id || '')) return;
  if (event.assignedToUserId && String(event.assignedToUserId) === String(req.user?.id || '')) return;
  throw new NotFoundError('Collaboration event not found');
}

export function normalizeCollaborationEntityType(value) {
  const type = clean(value).toLowerCase();
  if (type === 'application') return 'bid';
  if (['profile', 'job', 'bid'].includes(type)) return type;
  return '';
}

export function normalizeCollaborationEventType(value) {
  const type = clean(value).toLowerCase();
  if (['comment', 'task', 'handoff', 'change'].includes(type)) return type;
  throw new InputError('Choose a valid collaboration event type');
}

export function numericIdOrNull(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function workspaceFilterForUser(user) {
  return workspaceProfileWhereForUser(user) || {};
}

export async function assignedUserIdFromBody(body = {}) {
  const rawUserId = clean(body.assignedToUserId || body.assigneeUserId);
  if (!rawUserId) return null;
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0) throw new InputError('Choose a valid assignee');
  const user = await getWebUserModel().findByPk(userId);
  if (!user) throw new InputError('Choose a valid assignee');
  return user.id;
}

export async function mentionsForBody(body = {}, text = '') {
  const explicitMentions = Array.isArray(body.mentions) ? body.mentions : [];
  const mentionNames = [
    ...explicitMentions.map((mention) => typeof mention === 'string' ? mention : mention?.username),
    ...String(text).matchAll(/@([a-zA-Z0-9._-]+)/g),
  ]
    .map((mention) => clean(Array.isArray(mention) ? mention[1] : mention).toLowerCase())
    .filter(Boolean);
  const uniqueNames = [...new Set(mentionNames)];
  if (!uniqueNames.length) return [];

  const users = await getWebUserModel().findAll({
    where: { username: { [Op.in]: uniqueNames } },
    order: [['username', 'ASC']],
  });
  return users.map((mentionUser) => ({ id: mentionUser.id, username: mentionUser.username }));
}

export async function collaborationEventById(id) {
  return getCollaborationEventModel().findByPk(id, {
    include: [
      { model: getWebUserModel(), as: 'author', required: false },
      { model: getWebUserModel(), as: 'assignedTo', required: false },
    ],
  });
}

export function formatCollaborationEvent(event) {
  return {
    id: event.id,
    entityType: event.entityType,
    entityId: event.entityId,
    profileId: event.profileId,
    jobId: event.jobId,
    bidId: event.bidId,
    eventType: event.eventType,
    body: event.body,
    mentions: Array.isArray(event.mentions) ? event.mentions : [],
    metadata: event.metadata || {},
    resolvedAt: event.resolvedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    author: event.author ? { id: event.author.id, username: event.author.username } : null,
    assignedTo: event.assignedTo ? { id: event.assignedTo.id, username: event.assignedTo.username } : null,
  };
}

export async function listCallers(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireCallerManagementUser(user, res);
    if (res.headersSent) return;
    const WebUser = getWebUserModel();
    const Interview = getInterviewModel();
    const ScrapedJob = getScrapedJobModel();
    const BidProfile = getBidProfileModel();
    const callers = await WebUser.findAll({
      where: { role: 'caller', ...workspaceFilterForUser(user) },
      order: [['username', 'ASC']],
    });
    const callerIds = callers.map((caller) => caller.id);
    const assignments = callerIds.length
      ? await Interview.findAll({
          where: {
            callerUserId: { [Op.in]: callerIds },
            status: 'interviewing',
          },
          include: [
            { model: ScrapedJob, as: 'job', required: false },
            { model: BidProfile, as: 'profile', required: true, where: workspaceFilterForUser(user) },
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

export async function createCaller(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireCallerManagementUser(user, res);
    if (res.headersSent) return;
    const attrs = userAttributesFromBody({ ...req.body, role: 'caller' }, { requirePassword: true });
    const caller = await repositories.createUser({
      username: attrs.username,
      email: attrs.email,
      passwordHash: hashPassword(attrs.password),
      role: 'caller',
      timezone: attrs.timezone,
    });
    res.status(201).json({ caller: publicUser(caller) });
  } catch (error) {
    handleUserWriteError(error, res, next);
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
         OR EXISTS (
           SELECT 1
           FROM profile_share_requests
           WHERE profile_share_requests.recipient_user_id = web_users.id
             AND profile_share_requests.status = 'accepted'
         )
      ORDER BY web_users.username ASC
    `);
    const visibleBidders = isAdminRole(user)
      ? bidderRows
      : bidderRows.filter((bidder) => String(bidder.id) === String(user.id));
    const bidderIds = visibleBidders.map((bidder) => Number(bidder.id)).filter((id) => Number.isFinite(id));
    const viewerTimeZone = user.timezone;
    const bidDaySql = localDaySql('job_bids.bid_at', viewerTimeZone);
    const nowDaySql = localDaySql('now()', viewerTimeZone);

    if (!bidderIds.length) {
      res.json({ bidders: [] });
      return;
    }

    const bidderIdSql = bidderIds.join(',');
    const visibleProfileAccessSql = `
      SELECT bid_profiles.user_id, bid_profiles.id AS profile_id
      FROM bid_profiles
      WHERE bid_profiles.user_id IN (${bidderIdSql})
      UNION
      SELECT profile_share_requests.recipient_user_id AS user_id, profile_share_requests.profile_id
      FROM profile_share_requests
      WHERE profile_share_requests.recipient_user_id IN (${bidderIdSql})
        AND profile_share_requests.status = 'accepted'
    `;
    const [summaryRows, dailyRows, interviewSummaryRows, interviewRows] = await Promise.all([
      sequelize.query(`
        WITH visible_profile_access AS (
          ${visibleProfileAccessSql}
        )
        SELECT
          visible_profile_access.user_id,
          COUNT(*)::int AS total_applications,
          COUNT(*) FILTER (WHERE job_bids.bid_at >= now() - interval '7 days')::int AS weekly_applications,
          COUNT(*) FILTER (WHERE job_bids.bid_at >= now() - interval '30 days')::int AS monthly_applications
        FROM job_bids
        JOIN visible_profile_access ON visible_profile_access.profile_id = job_bids.profile_id
        WHERE job_bids.status NOT IN ('mismatching_bid', 'spam_job')
        GROUP BY visible_profile_access.user_id
      `),
      sequelize.query(`
        WITH visible_profile_access AS (
          ${visibleProfileAccessSql}
        )
        SELECT
          visible_profile_access.user_id,
          to_char(${bidDaySql}, 'YYYY-MM-DD') AS day,
          COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown') AS source,
          COUNT(*)::int AS applications
        FROM job_bids
        JOIN visible_profile_access ON visible_profile_access.profile_id = job_bids.profile_id
        JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
        WHERE ${bidDaySql} >= ${nowDaySql} - interval '13 days'
          AND job_bids.status NOT IN ('mismatching_bid', 'spam_job')
        GROUP BY visible_profile_access.user_id, ${bidDaySql}, COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown')
        ORDER BY ${bidDaySql} ASC, source ASC
      `),
      sequelize.query(`
        WITH visible_profile_access AS (
          ${visibleProfileAccessSql}
        )
        SELECT
          visible_profile_access.user_id,
          COUNT(*)::int AS interview_pass_through,
          COUNT(*) FILTER (WHERE interviews.status = 'won')::int AS won,
          COUNT(*) FILTER (WHERE interviews.status = 'lost')::int AS lost
        FROM interviews
        JOIN visible_profile_access ON visible_profile_access.profile_id = interviews.profile_id
        GROUP BY visible_profile_access.user_id
      `),
      sequelize.query(`
        WITH visible_profile_access AS (
          ${visibleProfileAccessSql}
        )
        SELECT
          interviews.id,
          visible_profile_access.user_id,
          interviews.status,
          interviews.interview_stage,
          interviews.interview_next_at,
          interviews.updated_at,
          interviews.job_id,
          interviews.title,
          interviews.company,
          interviews.location,
          interviews.job_url AS url,
          bid_profiles.id AS profile_id,
          bid_profiles.name AS profile_name
        FROM interviews
        JOIN visible_profile_access ON visible_profile_access.profile_id = interviews.profile_id
        JOIN bid_profiles ON bid_profiles.id = interviews.profile_id
        ORDER BY interviews.updated_at DESC
        LIMIT 200
      `),
    ]);

    const summaryByUserId = new Map(summaryRows[0].map((row) => [String(row.user_id), row]));
    const interviewSummaryByUserId = new Map(interviewSummaryRows[0].map((row) => [String(row.user_id), row]));
    const dailyByUserId = buildDailyApplications(dailyRows[0], viewerTimeZone);
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
        const interviewSummary = interviewSummaryByUserId.get(String(bidder.id)) || {};
        return {
          id: bidder.id,
          username: bidder.username,
          role: bidder.role,
          totalApplications: Number(summary.total_applications || 0),
          weeklyApplications: Number(summary.weekly_applications || 0),
          monthlyApplications: Number(summary.monthly_applications || 0),
          interviewPassThrough: Number(interviewSummary.interview_pass_through || 0),
          won: Number(interviewSummary.won || 0),
          lost: Number(interviewSummary.lost || 0),
          dailyApplications: dailyByUserId.get(String(bidder.id)) || buildEmptyDailyApplications(viewerTimeZone),
          interviews: interviewsByUserId.get(String(bidder.id)) || [],
        };
      }),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listSourceRoi(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const sequelize = getSequelize();
    const restrictedToCurrentBidder = !isAdminRole(user);
    const bidderWhere = restrictedToCurrentBidder ? 'AND job_bids.user_id = :viewerUserId' : '';
    const replacements = restrictedToCurrentBidder ? { viewerUserId: user.id } : {};
    const statusWhere = "job_bids.status NOT IN ('mismatching_bid', 'spam_job')";
    const applicationStatuses = "('submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost')";
    const interviewStatuses = "('interviewing', 'won', 'lost')";

    const [sourceRows, bidderRows, profileRows] = await Promise.all([
      sequelize.query(
        `
          SELECT
            COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown') AS source,
            COUNT(*) FILTER (WHERE job_bids.status IN ${applicationStatuses})::int AS applications,
            COUNT(*) FILTER (WHERE job_bids.status IN ${interviewStatuses})::int AS interviews,
            COUNT(*) FILTER (WHERE job_bids.status = 'won')::int AS offers,
            COUNT(DISTINCT job_bids.user_id) FILTER (WHERE job_bids.status IN ${applicationStatuses})::int AS bidders,
            COUNT(DISTINCT job_bids.profile_id) FILTER (WHERE job_bids.status IN ${applicationStatuses})::int AS profiles
          FROM job_bids
          JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
          WHERE ${statusWhere}
            ${bidderWhere}
          GROUP BY COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown')
          ORDER BY applications DESC, interviews DESC, source ASC
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `
          SELECT
            COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown') AS source,
            web_users.id AS bidder_id,
            web_users.username AS bidder_username,
            COUNT(*) FILTER (WHERE job_bids.status IN ${applicationStatuses})::int AS applications,
            COUNT(*) FILTER (WHERE job_bids.status IN ${interviewStatuses})::int AS interviews,
            COUNT(*) FILTER (WHERE job_bids.status = 'won')::int AS offers
          FROM job_bids
          JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
          JOIN web_users ON web_users.id = job_bids.user_id
          WHERE ${statusWhere}
            ${bidderWhere}
          GROUP BY COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown'), web_users.id, web_users.username
          ORDER BY applications DESC, interviews DESC, bidder_username ASC
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `
          SELECT
            COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown') AS source,
            bid_profiles.id AS profile_id,
            bid_profiles.name AS profile_name,
            web_users.username AS owner_username,
            COUNT(*) FILTER (WHERE job_bids.status IN ${applicationStatuses})::int AS applications,
            COUNT(*) FILTER (WHERE job_bids.status IN ${interviewStatuses})::int AS interviews,
            COUNT(*) FILTER (WHERE job_bids.status = 'won')::int AS offers
          FROM job_bids
          JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
          JOIN bid_profiles ON bid_profiles.id = job_bids.profile_id
          LEFT JOIN web_users ON web_users.id = bid_profiles.user_id
          WHERE ${statusWhere}
            ${bidderWhere}
          GROUP BY COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown'), bid_profiles.id, bid_profiles.name, web_users.username
          ORDER BY applications DESC, interviews DESC, profile_name ASC
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
    ]);

    const biddersBySource = groupSourceAttributionRows(bidderRows, formatSourceBidderRoi);
    const profilesBySource = groupSourceAttributionRows(profileRows, formatSourceProfileRoi);

    res.json({
      roi: {
        sources: sourceRows.map((row) => formatSourceRoi(row, {
          bidders: biddersBySource.get(row.source) || [],
          profiles: profilesBySource.get(row.source) || [],
        })),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export function groupSourceAttributionRows(rows, formatter) {
  const groups = new Map();
  for (const row of rows) {
    const source = row.source || 'Unknown';
    const items = groups.get(source) || [];
    items.push(formatter(row));
    groups.set(source, items);
  }
  return groups;
}

export function formatSourceRoi(row, attribution) {
  const applications = Number(row.applications || 0);
  const interviews = Number(row.interviews || 0);
  const offers = Number(row.offers || 0);

  return {
    source: jobSourceLabel(row.source),
    sourceKey: normalizeJobSource(row.source || 'Unknown'),
    applications,
    interviews,
    offers,
    bidders: Number(row.bidders || 0),
    profiles: Number(row.profiles || 0),
    interviewRate: applications ? Number((interviews / applications).toFixed(4)) : 0,
    offerRate: applications ? Number((offers / applications).toFixed(4)) : 0,
    bidderAttribution: attribution.bidders,
    profileAttribution: attribution.profiles,
  };
}

export function formatSourceBidderRoi(row) {
  const applications = Number(row.applications || 0);
  const interviews = Number(row.interviews || 0);
  const offers = Number(row.offers || 0);
  return {
    bidderId: row.bidder_id,
    bidderUsername: row.bidder_username || 'Unknown bidder',
    applications,
    interviews,
    offers,
    interviewRate: applications ? Number((interviews / applications).toFixed(4)) : 0,
    offerRate: applications ? Number((offers / applications).toFixed(4)) : 0,
  };
}

export function formatSourceProfileRoi(row) {
  const applications = Number(row.applications || 0);
  const interviews = Number(row.interviews || 0);
  const offers = Number(row.offers || 0);
  return {
    profileId: row.profile_id,
    profileName: row.profile_name || 'Unknown profile',
    ownerUsername: row.owner_username || null,
    applications,
    interviews,
    offers,
    interviewRate: applications ? Number((interviews / applications).toFixed(4)) : 0,
    offerRate: applications ? Number((offers / applications).toFixed(4)) : 0,
  };
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
    const blockedRecipient = recipients.find((recipient) => !canUserAccessWorkspace(recipient, profile.workspaceId));
    if (blockedRecipient) {
      return res.status(400).json({ error: `${blockedRecipient.username} does not have access to this workspace` });
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

export function recipientUsernamesFromBody(body = {}) {
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
