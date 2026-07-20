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
import { col, fn, Op, QueryTypes, where as sequelizeWhere } from 'sequelize';
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
  canAccessAssignedWorkspace,
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
import { requireInterviewAccessUser } from './biddingQueriesController.js';
import { calendarOwnerUserId, dateValue, formatInterviewAsJob, interviewCallsByInterviewId, interviewLogsByInterviewId, meetingLinkForStage } from './biddingInterviewDomainController.js';

export async function listCalendarInterviews(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireInterviewAccessUser(user, res);
    if (res.headersSent) return;

    const range = calendarRangeFromQuery(req.query);
    const workspaceId = calendarWorkspaceIdFromQuery(req.query, user);
    const userWorkspaceWhere = {
      ...workspaceFilterForUser(user),
      ...(workspaceId === undefined ? {} : { workspaceId }),
    };
    const interviews = calendarEventsInRange(
      calendarEventsForInterviews(await calendarInterviewsForUser(user, { range, workspaceId })),
      range,
    );
    const ownerUserIds = [...new Set(interviews.map(calendarOwnerUserId).filter(Boolean).map(String))];
    const jobBidIds = [...new Set(interviews.map((interview) => interview.jobBidId).filter(Boolean).map(String))];
    const [tailoredResumesByEvent, applicationBids, callerUsers] = await Promise.all([
      tailoredResumesForCalendarEvents(interviews),
      jobBidIds.length
        ? getJobBidModel().findAll({ where: { id: { [Op.in]: jobBidIds } }, attributes: ['id', 'userId'] })
        : [],
      canRegisterManualInterviewCalls(user)
        ? getWebUserModel().findAll({ where: { role: 'caller', ...userWorkspaceWhere }, order: [['username', 'ASC']] })
        : [],
    ]);
    const applicationUserIds = applicationBids.map((bid) => String(bid.userId)).filter(Boolean);
    const calendarUserIds = [...new Set([...ownerUserIds, ...applicationUserIds])];
    const calendarUsers = calendarUserIds.length
      ? await getWebUserModel().findAll({
        where: { id: { [Op.in]: calendarUserIds }, ...workspaceFilterForUser(user) },
        order: [['username', 'ASC']],
      })
      : [];
    const ownerUsersById = new Map(calendarUsers.map((owner) => [String(owner.id), owner]));
    const applicationActorsByJobBidId = new Map(applicationBids.map((bid) => [
      String(bid.id),
      ownerUsersById.get(String(bid.userId)) || null,
    ]));
    const callerUsersForDisplay = user.role === 'caller' && !callerUsers.some((caller) => String(caller.id) === String(user.id))
      ? [...callerUsers, user]
      : callerUsers;
    const callerUsersById = new Map(callerUsersForDisplay.map((caller) => [String(caller.id), { id: caller.id, username: caller.username }]));

    const profilesById = new Map();
    for (const interview of interviews) {
      if (!interview.profile) continue;
      if (user.role === 'caller') interview.profile.setDataValue('shareStatus', 'caller');
      profilesById.set(String(interview.profile.id), interview.profile);
    }

    res.json({
      profiles: sortProfilesForDisplay([...profilesById.values()]).map(formatProfile),
      jobs: interviews.map((interview) => (
        formatCalendarInterviewAsJob(
          interview,
          ownerUsersById,
          callerUsersById,
          tailoredResumesByEvent.get(calendarResumeKey(interview)) || null,
          applicationActorsByJobBidId,
        )
      )),
      callerUsers: callerUsersForDisplay.map((caller) => ({ id: caller.id, username: caller.username })),
      calendar: {
        generatedAt: new Date().toISOString(),
        icsUrl: '/api/bid/calendar.ics',
        reminders: calendarReminders(interviews),
        conflicts: calendarConflicts(interviews),
        integrations: calendarIntegrationStatus(),
      },
      currentUser: { id: user.id, username: user.username, role: user.role },
      total: interviews.length,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listRelatedCalendarCalls(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireInterviewAccessUser(user, res);
    if (res.headersSent) return;

    const interviewId = calendarInterviewId(req.params.id);
    const [sourceInterview] = await calendarInterviewsForUser(user, { interviewId });
    if (!sourceInterview) throw new NotFoundError('Calendar call not found');

    const companyKey = calendarCompanyKey(sourceInterview.company);
    const relatedInterviews = companyKey
      ? await calendarInterviewsForUser(user, {
          company: sourceInterview.company,
          profileId: sourceInterview.profileId,
        })
      : [sourceInterview];
    const calls = calendarEventsForInterviews(relatedInterviews).map(formatCalendarRelatedCall);

    res.json({
      profile: {
        id: sourceInterview.profile?.id ? String(sourceInterview.profile.id) : null,
        name: sourceInterview.profile?.name || 'Profile',
      },
      company: sourceInterview.company || 'Unknown company',
      calls,
      total: calls.length,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function exportCalendarIcs(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireInterviewAccessUser(user, res);
    if (res.headersSent) return;

    const interviews = calendarEventsForInterviews(await calendarInterviewsForUser(user));
    const ics = buildInterviewCalendarIcs(interviews);
    res.setHeader('content-type', 'text/calendar; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="applypilot-interviews.ics"');
    res.send(ics);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function calendarInterviewsForUser(user, {
  company = '',
  interviewId = null,
  profileId = null,
  range = null,
  workspaceId = undefined,
} = {}) {
  const Interview = getInterviewModel();
  const InterviewCall = getInterviewCallModel();
  const BidProfile = getBidProfileModel();
  const WebUser = getWebUserModel();
  const callerCallInterviewIds = user.role === 'caller'
    ? (await InterviewCall.findAll({
        where: { callerUserId: user.id },
        attributes: ['interviewId'],
        group: ['interviewId'],
      })).map((call) => call.interviewId)
    : [];
  const accessWhere = {
    ...(user.role === 'caller'
      ? {
          [Op.or]: [
            { callerUserId: user.id },
            ...(callerCallInterviewIds.length ? [{ id: { [Op.in]: callerCallInterviewIds } }] : []),
          ],
        }
      : {}),
  };

  const rangeInterviewIds = range ? await calendarRangeInterviewIds(range) : [];
  const rangeWhere = range
    ? {
        [Op.or]: [
          { interviewNextAt: { [Op.gte]: range.from, [Op.lt]: range.to } },
          ...(rangeInterviewIds.length ? [{ id: { [Op.in]: rangeInterviewIds } }] : []),
        ],
      }
    : {};
  const profileWhere = {
    ...workspaceFilterForUser(user),
    ...(workspaceId === undefined ? {} : { workspaceId }),
    ...(profileId ? { id: profileId } : {}),
  };
  const relatedWhere = {
    ...(interviewId ? { id: interviewId } : {}),
    ...(calendarCompanyKey(company)
      ? {
          [Op.and]: sequelizeWhere(
            fn('lower', fn('btrim', col('Interview.company'))),
            calendarCompanyKey(company),
          ),
        }
      : {}),
  };

  const interviews = await Interview.findAll({
    where: { [Op.and]: [accessWhere, rangeWhere, relatedWhere] },
    include: [
      {
        model: BidProfile,
        as: 'profile',
        required: true,
        where: profileWhere,
        include: [{ model: WebUser, as: 'user', required: false }],
      },
    ],
    order: [
      ['interviewNextAt', 'ASC'],
      ['updatedAt', 'DESC'],
    ],
  });
  const [logsByInterviewId, callsByInterviewId] = await Promise.all([
    interviewLogsByInterviewId(interviews, range),
    interviewCallsByInterviewId(interviews, user, range),
  ]);
  for (const interview of interviews) {
    interview.setDataValue('logs', logsByInterviewId.get(String(interview.id)) || []);
    interview.setDataValue('calls', callsByInterviewId.get(String(interview.id)) || []);
  }
  return interviews;
}

export function calendarCompanyKey(value) {
  return clean(value).toLowerCase();
}

export function calendarInterviewId(value) {
  const id = Number(clean(value));
  if (!Number.isSafeInteger(id) || id <= 0) throw new InputError('Choose a valid calendar call');
  return id;
}

async function calendarRangeInterviewIds(range) {
  const isoRange = { [Op.gte]: range.from.toISOString(), [Op.lt]: range.to.toISOString() };
  const [calls, logs] = await Promise.all([
    getInterviewCallModel().findAll({
      where: { scheduledAt: { [Op.gte]: range.from, [Op.lt]: range.to } },
      attributes: ['interviewId'],
      group: ['interviewId'],
    }),
    getInterviewLogModel().findAll({
      where: { eventType: 'interview_occurrence', toValue: isoRange },
      attributes: ['interviewId'],
      group: ['interviewId'],
    }),
  ]);
  return [...new Set([...calls, ...logs].map((row) => row.interviewId).filter(Boolean))];
}

export function calendarRangeFromQuery(query = {}) {
  const rawFrom = clean(query.from);
  const rawTo = clean(query.to);
  if (!rawFrom && !rawTo) return null;
  if (!rawFrom || !rawTo) throw new InputError('Calendar range requires both from and to');

  const from = new Date(rawFrom);
  const to = new Date(rawTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw new InputError('Choose a valid calendar range');
  }
  if (to.getTime() - from.getTime() > 62 * DAY_MS) {
    throw new InputError('Calendar range cannot exceed 62 days');
  }
  return { from, to };
}

export function calendarWorkspaceIdFromQuery(query = {}, user = {}) {
  const value = clean(query.workspaceId);
  if (!value || value === 'all') return undefined;
  if (value === 'unassigned') return isSuperadmin(user) ? null : undefined;
  const workspaceId = Number(value);
  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) throw new InputError('Choose a valid workspace');
  return canAccessAssignedWorkspace(user, workspaceId) ? workspaceId : undefined;
}

export function calendarEventsInRange(interviews = [], range = null) {
  if (!range) return interviews;
  return interviews.filter((interview) => {
    const scheduledAt = new Date(interview.interviewNextAt).getTime();
    return scheduledAt >= range.from.getTime() && scheduledAt < range.to.getTime();
  });
}

export function formatCalendarInterviewAsJob(
  interview,
  bidUsersById = new Map(),
  callerUsersById = new Map(),
  tailoredResume = null,
  applicationActorsByJobBidId = new Map(),
) {
  const job = formatInterviewAsJob(interview, bidUsersById, callerUsersById, tailoredResume);
  const bid = job.bid || {};
  const applicationActor = calendarApplicationActor(
    applicationActorsByJobBidId.get(String(interview.jobBidId || '')),
    interview.jobBidId,
  );
  return {
    id: job.id,
    interviewId: job.interviewId,
    interviewCallId: job.interviewCallId,
    occurrenceLogId: job.occurrenceLogId,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    sourceUrl: job.sourceUrl,
    tailoredResume: job.tailoredResume,
    bid: {
      id: bid.id,
      isInterview: true,
      parentInterviewId: bid.parentInterviewId,
      interviewCallId: bid.interviewCallId,
      occurrenceLogId: bid.occurrenceLogId,
      userId: bid.userId,
      profileOwnerUserId: bid.profileOwnerUserId,
      profileOwnerUsername: bid.profileOwnerUsername,
      callerUserId: bid.callerUserId,
      profileId: bid.profileId,
      jobId: bid.jobId,
      jobBidId: bid.jobBidId,
      status: bid.status,
      interviewStage: bid.interviewStage,
      interviewNextAt: bid.interviewNextAt,
      interviewDurationMinutes: bid.interviewDurationMinutes,
      interviewNotes: bid.interviewNotes,
      stageMeetingLinks: bid.stageMeetingLinks,
      meetingLink: bid.meetingLink,
      ...(applicationActor ? { applicationActor } : {}),
      ...(bid.user ? { user: bid.user } : {}),
      ...(bid.callerUser ? { callerUser: bid.callerUser } : {}),
    },
  };
}

export function calendarApplicationActor(user, jobBidId) {
  if (!jobBidId) return null;
  const classification = calendarApplicationClassification(user?.role);
  return {
    id: user?.id || null,
    username: user?.username || '',
    role: user?.role || '',
    classification,
    label: calendarApplicationClassificationLabel(classification),
  };
}

export function calendarApplicationClassification(role) {
  if (BIDDER_ROLES.includes(role)) return 'bidder';
  if (role === 'finance_manager') return 'finance_manager';
  if (role === 'user') return 'user';
  return 'other';
}

function calendarApplicationClassificationLabel(classification) {
  if (classification === 'bidder') return 'Bidder';
  if (classification === 'finance_manager') return 'Finance manager';
  if (classification === 'user') return 'User';
  return 'Applicant';
}

export async function tailoredResumesForCalendarEvents(interviews = []) {
  const jobUrls = [...new Set(interviews.map((interview) => clean(interview.jobUrl)).filter(Boolean))];
  const profileIds = [...new Set(interviews.map((interview) => clean(interview.profileId)).filter(Boolean))];
  if (!jobUrls.length || !profileIds.length) return new Map();

  const rows = await getTailoredResumeModel().findAll({
    where: {
      jobUrl: { [Op.in]: jobUrls },
      profileId: { [Op.in]: profileIds },
      status: { [Op.in]: ACTIVE_TAILORED_RESUME_STATUSES },
    },
    order: [
      ['status', 'ASC'],
      ['updatedAt', 'DESC'],
    ],
  });
  const priority = { ready: 4, processing: 3, requested: 2, dead_letter: 1 };
  const byEvent = new Map();

  for (const row of rows) {
    const formatted = formatTailoredResume(row);
    const key = calendarResumeKey(formatted);
    const current = byEvent.get(key);
    const currentPriority = priority[current?.status] || 0;
    const rowPriority = priority[formatted.status] || 0;
    if (!current || rowPriority > currentPriority) {
      byEvent.set(key, { id: formatted.id, status: formatted.status, filePath: formatted.filePath });
    }
  }

  return byEvent;
}

export function calendarResumeKey(value) {
  return `${clean(value?.profileId)}:${clean(value?.jobUrl)}`;
}

export function calendarEventsForInterviews(interviews = []) {
  return interviews
    .flatMap((interview) => {
      const callEvents = interviewCallEvents(interview);
      if (callEvents.length) return callEvents;
      return [
        ...interviewOccurrenceEvents(interview),
        ...(interview.interviewNextAt ? [currentInterviewCalendarEvent(interview)] : []),
      ];
    })
    .sort((left, right) => new Date(left.interviewNextAt || 0) - new Date(right.interviewNextAt || 0));
}

export function formatCalendarRelatedCall(event) {
  return {
    id: String(event.calendarEventId || event.id),
    interviewId: event.parentInterviewId ? String(event.parentInterviewId) : null,
    interviewCallId: event.interviewCallId ? String(event.interviewCallId) : null,
    occurrenceLogId: event.occurrenceLogId ? String(event.occurrenceLogId) : null,
    title: event.title || 'Untitled role',
    company: event.company || 'Unknown company',
    location: event.location || '',
    jobUrl: event.jobUrl || '',
    status: event.status || '',
    stage: event.interviewStage || '',
    startsAt: event.interviewNextAt ? new Date(event.interviewNextAt).toISOString() : null,
    durationMinutes: Number(event.interviewDurationMinutes || 60),
    meetingLink: meetingLinkForStage(event.stageMeetingLinks, event.interviewStage),
    notes: event.interviewNotes || '',
    isHistoricalOccurrence: Boolean(event.isHistoricalOccurrence),
  };
}

export function interviewCallEvents(interview) {
  const calls = interview.calls || interview.get?.('calls') || [];
  const seen = new Set();
  return [...calls]
    .sort(compareInterviewCallsForCalendar)
    .map((call) => interviewCallEvent(interview, call))
    .filter(Boolean)
    .filter((event) => {
      const key = `${event.parentInterviewId}:${event.interviewStage}:${dateValue(event.interviewNextAt)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function compareInterviewCallsForCalendar(left, right) {
  const leftTime = new Date(left.scheduledAt || 0).getTime();
  const rightTime = new Date(right.scheduledAt || 0).getTime();
  if (leftTime !== rightTime) return leftTime - rightTime;
  const priorityDiff = interviewCallSourcePriority(right.sourceType) - interviewCallSourcePriority(left.sourceType);
  if (priorityDiff) return priorityDiff;
  return Number(right.id || 0) - Number(left.id || 0);
}

export function interviewCallSourcePriority(sourceType) {
  if (['current_schedule', 'stage_changed', 'schedule_update', 'created'].includes(sourceType)) return 3;
  if (sourceType === 'schedule_changed') return 2;
  if (sourceType === 'first_scheduled') return 1;
  return 0;
}

export function interviewCallEvent(interview, call) {
  const scheduledAt = dateValue(call.scheduledAt);
  if (!scheduledAt) return null;
  const stage = call.interviewStage || interview.interviewStage || 'todo';
  const meetingLink = clean(call.meetingLink);
  const notes = clean(call.notes);

  return {
    calendarEventId: `interview-${interview.id}-call-${call.id}`,
    parentInterviewId: interview.id,
    interviewCallId: call.id,
    profile: interview.profile,
    profileId: interview.profileId,
    userId: calendarOwnerUserId(interview),
    callerUserId: call.callerUserId || interview.callerUserId,
    jobId: interview.jobId,
    jobBidId: interview.jobBidId,
    title: interview.title,
    company: interview.company,
    location: interview.location,
    jobUrl: interview.jobUrl,
    status: interview.status,
    interviewStage: stage,
    interviewNextAt: new Date(scheduledAt),
    interviewDurationMinutes: Number(call.durationMinutes || interview.interviewDurationMinutes || 60),
    interviewNotes: notes || interview.interviewNotes,
    stageNotes: notes ? { [stage]: notes } : interview.stageNotes || {},
    stageMeetingLinks: meetingLink ? { [stage]: meetingLink } : interview.stageMeetingLinks || {},
    createdAt: call.createdAt || interview.createdAt,
    updatedAt: call.updatedAt || interview.updatedAt,
    isHistoricalOccurrence: dateValue(interview.interviewNextAt) !== scheduledAt || stage !== interview.interviewStage,
  };
}

export function currentInterviewCalendarEvent(interview) {
  return {
    calendarEventId: `interview-${interview.id}-current`,
    parentInterviewId: interview.id,
    profile: interview.profile,
    profileId: interview.profileId,
    userId: calendarOwnerUserId(interview),
    callerUserId: interview.callerUserId,
    jobId: interview.jobId,
    jobBidId: interview.jobBidId,
    title: interview.title,
    company: interview.company,
    location: interview.location,
    jobUrl: interview.jobUrl,
    status: interview.status,
    interviewStage: interview.interviewStage,
    interviewNextAt: interview.interviewNextAt,
    interviewDurationMinutes: interview.interviewDurationMinutes || 60,
    interviewNotes: interview.interviewNotes,
    stageNotes: interview.stageNotes || {},
    stageMeetingLinks: interview.stageMeetingLinks || {},
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
    isHistoricalOccurrence: false,
  };
}

export function interviewOccurrenceEvents(interview) {
  const logs = interview.logs || interview.get?.('logs') || [];
  return logs
    .filter((log) => log.eventType === 'interview_occurrence')
    .map((log) => interviewOccurrenceEvent(interview, log))
    .filter(Boolean);
}

export function interviewOccurrenceEvent(interview, log) {
  const metadata = log.metadata || {};
  const scheduledAt = dateValue(metadata.scheduledAt || log.toValue);
  if (!scheduledAt) return null;
  const stage = metadata.stage || interview.interviewStage;
  const meetingLink = clean(metadata.meetingLink);

  return {
    calendarEventId: `interview-${interview.id}-occurrence-${log.id}`,
    parentInterviewId: interview.id,
    occurrenceLogId: log.id,
    profile: interview.profile,
    profileId: interview.profileId,
    userId: calendarOwnerUserId(interview),
    callerUserId: interview.callerUserId,
    jobId: interview.jobId,
    jobBidId: interview.jobBidId,
    title: interview.title,
    company: interview.company,
    location: interview.location,
    jobUrl: interview.jobUrl,
    status: interview.status,
    interviewStage: stage,
    interviewNextAt: new Date(scheduledAt),
    interviewDurationMinutes: Number(metadata.durationMinutes || interview.interviewDurationMinutes || 60),
    interviewNotes: clean(metadata.notes) || null,
    stageNotes: metadata.notes ? { [stage]: metadata.notes } : {},
    stageMeetingLinks: meetingLink ? { [stage]: meetingLink } : {},
    createdAt: log.createdAt || interview.createdAt,
    updatedAt: log.createdAt || interview.updatedAt,
    isHistoricalOccurrence: true,
  };
}

export function calendarIntegrationStatus() {
  return {
    google: { supported: true, mode: 'event-link' },
    outlook: { supported: true, mode: 'event-link' },
    ics: { supported: true, mode: 'export' },
    sync: { supported: false, reason: 'oauth_not_configured' },
  };
}

export function calendarReminders(interviews) {
  const now = Date.now();
  return interviews
    .filter((interview) => interview.interviewNextAt)
    .map((interview) => {
      const startsAt = new Date(interview.interviewNextAt).getTime();
      const minutesUntilStart = Math.round((startsAt - now) / 60000);
      return {
        id: String(interview.calendarEventId || interview.id),
        profileId: interview.profileId ? String(interview.profileId) : null,
        title: interview.title,
        company: interview.company,
        startsAt: new Date(interview.interviewNextAt).toISOString(),
        reminderAt: new Date(startsAt - 30 * 60000).toISOString(),
        minutesUntilStart,
        missingMeetingLink: !meetingLinkForStage(interview.stageMeetingLinks, interview.interviewStage),
      };
    })
    .filter((reminder) => reminder.minutesUntilStart >= 0 && reminder.minutesUntilStart <= 24 * 60)
    .slice(0, 20);
}

export function calendarConflicts(interviews) {
  const events = interviews
    .filter((interview) => interview.interviewNextAt)
    .map((interview) => ({
      id: String(interview.calendarEventId || interview.id),
      profileId: interview.profileId ? String(interview.profileId) : null,
      profileName: interview.profile?.name || '',
      title: interview.title,
      company: interview.company,
      startsAt: new Date(interview.interviewNextAt),
      endsAt: new Date(new Date(interview.interviewNextAt).getTime() + Number(interview.interviewDurationMinutes || 60) * 60000),
    }))
    .sort((left, right) => left.startsAt - right.startsAt);
  const conflicts = [];

  for (let index = 0; index < events.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < events.length; nextIndex += 1) {
      const left = events[index];
      const right = events[nextIndex];
      if (right.startsAt >= left.endsAt) break;
      conflicts.push({
        id: `${left.id}:${right.id}`,
        startsAt: right.startsAt.toISOString(),
        events: [left, right].map(formatCalendarConflictEvent),
      });
    }
  }

  return conflicts.slice(0, 50);
}

export function formatCalendarConflictEvent(event) {
  return {
    id: event.id,
    profileId: event.profileId,
    profileName: event.profileName,
    title: event.title,
    company: event.company,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
  };
}

export function buildInterviewCalendarIcs(interviews) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ApplyPilot//Interview Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const interview of interviews) {
    if (!interview.interviewNextAt) continue;
    const start = new Date(interview.interviewNextAt);
    const end = new Date(start.getTime() + Number(interview.interviewDurationMinutes || 60) * 60000);
    const meetingLink = meetingLinkForStage(interview.stageMeetingLinks, interview.interviewStage);
    const description = [
      interview.interviewNotes,
      meetingLink ? `Meeting link: ${meetingLink}` : '',
      interview.jobUrl ? `Job link: ${interview.jobUrl}` : '',
      interview.profile?.name ? `Profile: ${interview.profile.name}` : '',
    ].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:applypilot-interview-${interview.calendarEventId || interview.id}@applypilot`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape([interview.company, interview.title].filter(Boolean).join(' - ') || 'Interview')}`,
      `DESCRIPTION:${icsEscape(description || 'ApplyPilot interview')}`,
      `LOCATION:${icsEscape(meetingLink || interview.location || '')}`,
      `URL:${icsEscape(meetingLink || interview.jobUrl || '')}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(`Upcoming interview: ${interview.title || 'Interview'}`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

export function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function foldIcsLine(line) {
  const value = String(line);
  if (value.length <= 74) return value;
  const parts = [];
  for (let index = 0; index < value.length; index += 74) {
    parts.push(`${index ? ' ' : ''}${value.slice(index, index + 74)}`);
  }
  return parts.join('\r\n');
}
