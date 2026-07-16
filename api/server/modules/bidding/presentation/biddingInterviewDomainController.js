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
import { canAccessInterviews, isInterviewBidStatus } from './biddingQueriesController.js';
import { interviewFailureFeedbackValues } from '../application/interviewFailureFeedbackService.js';

export async function ensureBidBatchWritable({ req, res, user, bid, attrs }) {
  if (!isAdminRole(req.user)) {
    const profile = await accessibleProfile(req, bid.profileId);
    if (isLegacyProfile(profile) && !isInterviewBidStatus(attrs.status || bid.status)) {
      res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding' });
      return;
    }
    if (!PRIVILEGED_USER_ROLES.includes(user.role) && String(bid.userId) !== String(user.id)) {
      throw new NotFoundError('Bid not found');
    }
    return;
  }

  const profile = await getBidProfileModel().findByPk(bid.profileId);
  if (!isProfileInUserWorkspace(profile, req.user)) {
    throw new NotFoundError('Bid not found');
  }
  if (isLegacyProfile(profile) && !isInterviewBidStatus(attrs.status || bid.status)) {
    res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding' });
  }
  return profile;
}

export async function createBidForBatch({ user, profile, job, attrs }) {
  const now = new Date();
  const createAttrs = { ...attrs, status: attrs.status || 'queued' };
  return getJobBidModel().create({
    ...bidUpdateValuesFromAttrs(createAttrs),
    userId: user.id,
    profileId: profile.id,
    jobId: job.id,
    bidAt: now,
    ...(createAttrs.status === 'interviewing' ? { interviewAt: now } : {}),
    updatedAt: now,
  });
}

export async function applyBidUpdates({ bid, attrs }) {
  const now = new Date();
  const updates = { ...bidUpdateValuesFromAttrs(attrs), updatedAt: now };
  if (shouldRefreshBidAtForStatus(attrs.status, bid.status)) {
    updates.bidAt = now;
  }
  if (shouldSetInterviewAtForStatus(attrs.status, bid.status, bid.interviewAt)) {
    updates.interviewAt = now;
  }
  await bid.update(updates);
  return bid;
}

export async function interviewWriteProfileForUser(user, profileId, notFoundMessage = 'Profile not found') {
  const id = clean(profileId);
  if (!id) throw new InputError('Profile is required');

  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError(notFoundMessage);
  if (canWriteInterviewForProfile(user, profile)) return profile;
  throw new NotFoundError(notFoundMessage);
}

export function canWriteInterviewForProfile(user, profile) {
  if (!canAccessInterviews(user)) return false;
  if (isAdminRole(user)) return true;
  if (user?.role === 'caller') return false;
  return String(profile?.userId || '') === String(user?.id || '');
}

export function formatCallerAssignment(row) {
  return {
    id: row.id,
    profileId: row.profileId,
    jobId: row.jobId,
    status: row.status,
    interviewStage: row.interviewStage,
    interviewNextAt: row.interviewNextAt,
    interviewDurationMinutes: row.interviewDurationMinutes || 60,
    interviewNotes: row.interviewNotes,
    stageMeetingLinks: row.stageMeetingLinks || {},
    meetingLink: meetingLinkForStage(row.stageMeetingLinks, row.interviewStage),
    updatedAt: row.updatedAt,
    job: row.job ? formatJob(row.job) : {
      id: row.jobId,
      title: row.title,
      company: row.company,
      location: row.location,
      url: row.jobUrl,
    },
    profile: row.profile ? formatProfile(row.profile) : null,
  };
}

export function interviewValuesFromAttrs(attrs, existing = null) {
  const stage = attrs.interviewStage || existing?.interviewStage || 'todo';
  const stageNotes = normalizeInterviewStageNotes({
    currentStage: stage,
    currentNote: attrs.hasInterviewNotes ? attrs.interviewNotes : undefined,
    existingNotes: existing?.stageNotes,
    incomingNotes: attrs.stageNotes,
  });
  const stageMeetingLinks = normalizeInterviewStageMeetingLinks({
    currentStage: stage,
    currentLink: attrs.interviewMeetingLink,
    existingLinks: existing?.stageMeetingLinks,
    incomingLinks: attrs.stageMeetingLinks,
  });
  const interviewNextAt = attrs.interviewNextAt || null;
  const status = interviewStatusFromAttrs(attrs, existing);
  return {
    callerUserId: Object.prototype.hasOwnProperty.call(attrs, 'callerUserId')
      ? attrs.callerUserId
      : existing?.callerUserId || null,
    status,
    interviewStage: stage,
    interviewNextAt,
    interviewDurationMinutes: attrs.interviewDurationMinutes || existing?.interviewDurationMinutes || 60,
    firstInterviewScheduledAt: existing?.firstInterviewScheduledAt || interviewNextAt,
    interviewNotes: stageNotes[stage] || attrs.interviewNotes || null,
    stageNotes,
    stageMeetingLinks,
    ...interviewFailureFeedbackValues(attrs, existing, status),
  };
}

export function interviewStatusFromAttrs(attrs = {}, existing = null) {
  if (attrs.status === 'won' || attrs.status === 'lost') return attrs.status;
  const stage = attrs.interviewStage || existing?.interviewStage || 'todo';
  return stage === 'todo' ? 'todo' : 'interviewing';
}

export function bidStatusFromInterviewStatus(status) {
  return status === 'won' || status === 'lost' ? status : 'interviewing';
}

export function manualInterviewCallAttributes(body = {}, interview) {
  const hasCallerUserId = Object.prototype.hasOwnProperty.call(body || {}, 'callerUserId');
  const hasMeetingLink = Object.prototype.hasOwnProperty.call(body || {}, 'meetingLink')
    || Object.prototype.hasOwnProperty.call(body || {}, 'interviewMeetingLink');
  const hasNotes = Object.prototype.hasOwnProperty.call(body || {}, 'notes')
    || Object.prototype.hasOwnProperty.call(body || {}, 'interviewNotes');
  const stage = clean(body?.interviewStage) || interview?.interviewStage || 'todo';
  const attrs = bidAttributesFromBody({
    status: 'interviewing',
    interviewStage: stage,
    interviewNextAt: body?.scheduledAt || body?.interviewNextAt,
    interviewDurationMinutes: body?.durationMinutes || body?.interviewDurationMinutes || body?.interviewDuration,
    ...(hasCallerUserId ? { callerUserId: body?.callerUserId } : {}),
    ...(hasMeetingLink ? { interviewMeetingLink: body?.meetingLink || body?.interviewMeetingLink } : {}),
    ...(hasNotes ? { interviewNotes: body?.notes ?? body?.interviewNotes } : {}),
  });
  if (!attrs.interviewNextAt) throw new InputError('Call date is required');

  const callStage = attrs.interviewStage || interview?.interviewStage || 'todo';
  const existingLinks = interview?.stageMeetingLinks && typeof interview.stageMeetingLinks === 'object' ? interview.stageMeetingLinks : {};
  const existingNotes = interview?.stageNotes && typeof interview.stageNotes === 'object' ? interview.stageNotes : {};
  return {
    callerUserId: Object.prototype.hasOwnProperty.call(attrs, 'callerUserId')
      ? attrs.callerUserId
      : interview?.callerUserId || null,
    callerUserIdProvided: hasCallerUserId,
    interviewStage: callStage,
    scheduledAt: attrs.interviewNextAt,
    durationMinutes: attrs.interviewDurationMinutes || interview?.interviewDurationMinutes || 60,
    meetingLink: hasMeetingLink ? attrs.interviewMeetingLink || null : meetingLinkForStage(existingLinks, callStage) || null,
    notes: hasNotes ? attrs.interviewNotes || null : clean(existingNotes[callStage] || interview?.interviewNotes) || null,
  };
}

export function rejectReviewStatusForNonAdmin(req, res, attrs) {
  if (!REVIEW_BID_STATUSES.has(attrs.status) || isAdminRole(req.user)) return false;
  res.status(403).json({ error: 'Admin access is required' });
  return true;
}

export function canAssignInterviewCaller(user) {
  return canRegisterManualInterviewCalls(user);
}

export function bidUpdateValuesFromAttrs(attrs) {
  return {
    ...(Object.prototype.hasOwnProperty.call(attrs, 'status') ? { status: attrs.status } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'bidAmount') ? { bidAmount: attrs.bidAmount } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'callerUserId') ? { callerUserId: attrs.callerUserId } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'coverLetter') ? { coverLetter: attrs.coverLetter } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'notes') ? { notes: attrs.notes } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'interviewStage') ? { interviewStage: attrs.interviewStage } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'interviewNextAt') ? { interviewNextAt: attrs.interviewNextAt } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'interviewDurationMinutes')
      ? { interviewDurationMinutes: attrs.interviewDurationMinutes }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'interviewNotes') ? { interviewNotes: attrs.interviewNotes } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'stageMeetingLinks')
      ? { stageMeetingLinks: attrs.stageMeetingLinks }
      : {}),
  };
}

export function pruneAttrsForProvidedBidFields(attrs, body = {}) {
  const optionalFields = [
    'status',
    'bidAmount',
    'coverLetter',
    'notes',
    'interviewStage',
    'interviewNextAt',
    'interviewNotes',
  ];
  optionalFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) delete attrs[field];
  });
  if (
    !Object.prototype.hasOwnProperty.call(body, 'interviewDurationMinutes') &&
    !Object.prototype.hasOwnProperty.call(body, 'interviewDuration')
  ) {
    delete attrs.interviewDurationMinutes;
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'stageMeetingLinks')) delete attrs.stageMeetingLinks;
}

export async function upsertInterviewForBid({ bid, job, attrs, userId }) {
  if (!job) return null;
  const ownerUserId = await interviewOwnerUserIdForBid(bid, userId);
  const values = {
    ...interviewValuesFromAttrs(attrs),
    userId: ownerUserId,
    profileId: bid.profileId,
    jobId: bid.jobId,
    jobBidId: bid.id,
    title: job.title || 'Untitled role',
    company: job.company || 'Unknown company',
    location: job.location || null,
    jobUrl: job.url || null,
  };
  const existing = await getInterviewModel().findOne({ where: { jobBidId: bid.id } });
  if (existing) {
    const previous = interviewSnapshot(existing);
    await existing.update({
      ...interviewValuesFromAttrs(attrs, existing),
      userId: ownerUserId,
    });
    await logInterviewChanges({ interview: existing, previous, attrs, userId });
    await syncInterviewCallForCurrentSchedule(existing, { sourceType: 'schedule_update' });
    if (String(previous.callerUserId || '') !== String(existing.callerUserId || '')) {
      await syncInterviewCallerToCalls(existing);
    }
    return existing;
  }
  ensureInitialInterviewCallSchedule(attrs);
  const interview = await getInterviewModel().create(values);
  await logInterviewCreated(interview, userId);
  await syncInitialInterviewCall(interview, { sourceType: 'created' });
  return interview;
}

export async function interviewOwnerUserIdForBid(bid, fallbackUserId) {
  const profile = bid?.profile || (bid?.profileId ? await getBidProfileModel().findByPk(bid.profileId) : null);
  return profile?.userId || fallbackUserId;
}

export function formatInterviewAsJob(interview, bidUsersById = new Map(), callerUsersById = new Map(), tailoredResume = null) {
  const formattedId = interview.calendarEventId || interview.id;
  return {
    id: `interview-${formattedId}`,
    interviewId: interview.parentInterviewId || interview.id,
    interviewCallId: interview.interviewCallId || null,
    occurrenceLogId: interview.occurrenceLogId || null,
    title: interview.title,
    company: interview.company,
    location: interview.location,
    url: interview.jobUrl,
    source: interview.jobId ? 'Application' : 'Manual',
    sourceUrl: interview.jobUrl,
    listingText: interview.interviewNotes,
    isSpam: false,
    isHidden: false,
    updatedAt: interview.updatedAt,
    tailoredResume,
    bid: formatInterviewBid(interview, bidUsersById, callerUsersById),
  };
}

export function formatInterviewBid(interview, bidUsersById = new Map(), callerUsersById = new Map()) {
  const ownerUserId = calendarOwnerUserId(interview);
  const profileOwner = interview.profile?.user || null;
  const bidUser = bidUsersById.get?.(String(ownerUserId)) || profileOwner;
  const callerUser = callerUsersById.get?.(String(interview.callerUserId));
  return {
    id: interview.calendarEventId || interview.id,
    isInterview: true,
    parentInterviewId: interview.parentInterviewId || interview.id,
    interviewCallId: interview.interviewCallId || null,
    occurrenceLogId: interview.occurrenceLogId || null,
    isHistoricalOccurrence: Boolean(interview.isHistoricalOccurrence),
    userId: ownerUserId,
    profileOwnerUserId: ownerUserId,
    profileOwnerUsername: profileOwner?.username || bidUser?.username || null,
    callerUserId: interview.callerUserId,
    profileId: interview.profileId,
    jobId: interview.jobId,
    jobBidId: interview.jobBidId,
    status: interview.status,
    bidAmount: null,
    coverLetter: null,
    notes: null,
    interviewStage: interview.interviewStage,
    interviewNextAt: interview.interviewNextAt,
    interviewDurationMinutes: interview.interviewDurationMinutes || 60,
    firstInterviewScheduledAt: interview.firstInterviewScheduledAt,
    interviewNotes: interview.interviewNotes,
    failureFeedback: interview.failureFeedback || null,
    failureFeedbackNotes: interview.failureFeedbackNotes || null,
    stageNotes: interview.stageNotes || {},
    stageMeetingLinks: interview.stageMeetingLinks || {},
    meetingLink: meetingLinkForStage(interview.stageMeetingLinks, interview.interviewStage),
    calls: (interview.calls || interview.get?.('calls') || []).map(formatInterviewCall),
    logs: (interview.logs || interview.get?.('logs') || []).map(formatInterviewLog),
    bidAt: interview.createdAt,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
    ...(bidUser ? { user: { id: bidUser.id, username: bidUser.username, role: bidUser.role } } : {}),
    ...(callerUser ? { callerUser } : {}),
  };
}

export function calendarOwnerUserId(interview) {
  return interview?.profile?.userId || interview?.profile?.user?.id || interview?.userId;
}

export function formatInterviewCall(call) {
  return {
    id: call.id,
    interviewId: call.interviewId,
    userId: call.userId,
    callerUserId: call.callerUserId,
    interviewStage: call.interviewStage,
    scheduledAt: call.scheduledAt,
    durationMinutes: call.durationMinutes || 60,
    meetingLink: call.meetingLink,
    notes: call.notes,
    sourceType: call.sourceType,
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
  };
}

export async function interviewLogsByInterviewId(interviews, range = null) {
  const interviewIds = interviews.map((interview) => interview.id).filter(Boolean);
  if (!interviewIds.length) return new Map();
  const logs = await getInterviewLogModel().findAll({
    where: {
      interviewId: interviewIds,
      ...(range
        ? {
            eventType: 'interview_occurrence',
            toValue: { [Op.gte]: range.from.toISOString(), [Op.lt]: range.to.toISOString() },
          }
        : {}),
    },
    order: [
      ['interviewId', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
  const byInterviewId = new Map(interviewIds.map((id) => [String(id), []]));
  for (const log of logs) {
    byInterviewId.get(String(log.interviewId))?.push(log);
  }
  return byInterviewId;
}

export async function interviewCallsByInterviewId(interviews, user = null, range = null) {
  const interviewIds = interviews.map((interview) => interview.id).filter(Boolean);
  if (!interviewIds.length) return new Map();
  const currentCallerInterviewIds = user?.role === 'caller'
    ? interviews
        .filter((interview) => String(interview.callerUserId || '') === String(user.id))
        .map((interview) => interview.id)
    : [];
  const calls = await getInterviewCallModel().findAll({
    where: {
      interviewId: interviewIds,
      ...(range ? { scheduledAt: { [Op.gte]: range.from, [Op.lt]: range.to } } : {}),
      ...(user?.role === 'caller'
        ? {
            [Op.or]: [
              { callerUserId: user.id },
              ...(currentCallerInterviewIds.length ? [{ interviewId: { [Op.in]: currentCallerInterviewIds } }] : []),
            ],
          }
        : {}),
    },
    order: [
      ['interviewId', 'ASC'],
      ['scheduledAt', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  const byInterviewId = new Map(interviewIds.map((id) => [String(id), []]));
  for (const call of calls) {
    byInterviewId.get(String(call.interviewId))?.push(call);
  }
  return byInterviewId;
}

export function normalizeInterviewStageNotes({ currentStage, currentNote, existingNotes, incomingNotes }) {
  const notes = { ...((existingNotes && typeof existingNotes === 'object') ? existingNotes : {}) };
  if (incomingNotes && typeof incomingNotes === 'object') {
    for (const [stage, note] of Object.entries(incomingNotes)) {
      const cleaned = clean(note);
      if (cleaned) notes[stage] = cleaned;
      else delete notes[stage];
    }
  }
  if (currentNote !== undefined) {
    const cleaned = clean(currentNote);
    if (cleaned) notes[currentStage] = cleaned;
    else if (currentNote !== undefined) delete notes[currentStage];
  }
  return notes;
}

export function normalizeInterviewStageMeetingLinks({ currentStage, currentLink, existingLinks, incomingLinks }) {
  const links = { ...((existingLinks && typeof existingLinks === 'object') ? existingLinks : {}) };
  if (incomingLinks && typeof incomingLinks === 'object') {
    for (const [stage, link] of Object.entries(incomingLinks)) {
      const cleaned = clean(link);
      if (cleaned) links[stage] = cleaned;
      else delete links[stage];
    }
  }
  if (currentLink !== undefined) {
    const cleaned = clean(currentLink);
    if (cleaned) links[currentStage] = cleaned;
    else delete links[currentStage];
  }
  return links;
}

export function interviewSnapshot(interview) {
  const stage = interview.interviewStage;
  const stageNotes = { ...((interview.stageNotes && typeof interview.stageNotes === 'object') ? interview.stageNotes : {}) };
  const stageMeetingLinks = { ...((interview.stageMeetingLinks && typeof interview.stageMeetingLinks === 'object') ? interview.stageMeetingLinks : {}) };
  return {
    status: interview.status,
    interviewStage: stage,
    interviewNextAt: interview.interviewNextAt,
    interviewDurationMinutes: interview.interviewDurationMinutes || 60,
    interviewNotes: interview.interviewNotes,
    firstInterviewScheduledAt: interview.firstInterviewScheduledAt,
    stageNotes,
    stageMeetingLinks,
    meetingLink: meetingLinkForStage(stageMeetingLinks, stage),
    failureFeedback: interview.failureFeedback || null,
    failureFeedbackNotes: interview.failureFeedbackNotes || null,
  };
}

export async function logInterviewCreated(interview, userId) {
  await getInterviewLogModel().create({
    interviewId: interview.id,
    userId,
    eventType: 'created',
    toValue: interview.interviewStage,
    metadata: { stage: interview.interviewStage },
  });
  if (interview.firstInterviewScheduledAt) {
    await getInterviewLogModel().create({
      interviewId: interview.id,
      userId,
      eventType: 'first_scheduled',
      toValue: interview.firstInterviewScheduledAt.toISOString(),
      metadata: { stage: interview.interviewStage },
    });
  }
}

export async function logInterviewChanges({ interview, previous, attrs, userId }) {
  const logs = [];
  if (previous.status !== interview.status) {
    logs.push({
      eventType: 'status_changed',
      fromValue: previous.status,
      toValue: interview.status,
      metadata: {
        failureFeedback: interview.failureFeedback || null,
        failureFeedbackNotes: interview.failureFeedbackNotes || null,
      },
    });
  } else if (
    previous.failureFeedback !== interview.failureFeedback
    || previous.failureFeedbackNotes !== interview.failureFeedbackNotes
  ) {
    logs.push({
      eventType: 'failure_feedback_changed',
      fromValue: previous.failureFeedback,
      toValue: interview.failureFeedback,
      metadata: { failureFeedbackNotes: interview.failureFeedbackNotes || null },
    });
  }
  if (previous.interviewStage !== interview.interviewStage) {
    const occurrenceLog = interviewOccurrenceLogFromSnapshot(previous, interview);
    if (occurrenceLog) logs.push(occurrenceLog);
    logs.push({
      eventType: 'stage_changed',
      fromValue: previous.interviewStage,
      toValue: interview.interviewStage,
      metadata: {},
    });
  }
  if (dateValue(previous.interviewNextAt) !== dateValue(interview.interviewNextAt)) {
    logs.push({
      eventType: 'schedule_changed',
      fromValue: dateValue(previous.interviewNextAt),
      toValue: dateValue(interview.interviewNextAt),
      metadata: { stage: interview.interviewStage },
    });
  }
  if (!previous.firstInterviewScheduledAt && interview.firstInterviewScheduledAt) {
    logs.push({
      eventType: 'first_scheduled',
      fromValue: null,
      toValue: dateValue(interview.firstInterviewScheduledAt),
      metadata: { stage: interview.interviewStage },
    });
  }
  const changedNoteStages = changedStageNoteKeys(previous.stageNotes, interview.stageNotes || {});
  for (const stage of changedNoteStages) {
    logs.push({
      eventType: 'stage_note_changed',
      fromValue: previous.stageNotes[stage] || null,
      toValue: interview.stageNotes?.[stage] || null,
      metadata: { stage },
    });
  }
  const changedMeetingLinkStages = changedStageNoteKeys(previous.stageMeetingLinks, interview.stageMeetingLinks || {});
  for (const stage of changedMeetingLinkStages) {
    logs.push({
      eventType: 'stage_meeting_link_changed',
      fromValue: previous.stageMeetingLinks[stage] || null,
      toValue: interview.stageMeetingLinks?.[stage] || null,
      metadata: { stage },
    });
  }
  if (!logs.length) return;
  await getInterviewLogModel().bulkCreate(
    logs.map((log) => ({
      ...log,
      interviewId: interview.id,
      userId,
      metadata: { ...(log.metadata || {}), source: attrs.status || interview.status },
    })),
  );
}

export function shouldRegisterInterviewCallForStageChange(previousStage, nextStage, nextStatus = 'interviewing') {
  const fromStage = previousStage || 'todo';
  const toStage = nextStage || 'todo';
  return fromStage !== toStage && shouldRegisterInterviewCallForStage(toStage, nextStatus);
}

export function ensureInitialInterviewCallSchedule(attrs) {
  if (!shouldRegisterInitialInterviewCall(attrs)) return;
  if (!attrs.interviewNextAt) throw new InputError('Screening call date is required');
}

export function shouldRegisterInitialInterviewCall(attrs = {}) {
  const stage = attrs.interviewStage || 'todo';
  return shouldRegisterInterviewCallForStage(stage, interviewStatusFromAttrs(attrs));
}

export async function syncInitialInterviewCall(interview, { sourceType = 'created' } = {}) {
  const scheduledAt = dateValue(interview.interviewNextAt);
  const stage = interview.interviewStage || 'todo';
  if (!scheduledAt || !shouldRegisterInterviewCallForStage(stage, interview.status)) return null;
  const notes = clean(interview.stageNotes?.[stage] || interview.interviewNotes);
  const meetingLink = clean(
    meetingLinkForStage(interview.stageMeetingLinks, stage)
      || meetingLinkForStage(interview.stageMeetingLinks, interview.interviewStage),
  );
  return upsertInterviewCallForStage(interview, {
    callerUserId: interview.callerUserId || null,
    interviewStage: stage,
    scheduledAt: new Date(scheduledAt),
    durationMinutes: Number(interview.interviewDurationMinutes || 60),
    meetingLink: meetingLink || null,
    notes: notes || null,
  }, {
    sourceType,
    metadata: { createdFrom: sourceType, initialStage: stage },
  });
}

export async function syncInterviewCallForCurrentSchedule(interview, { sourceType = 'current_schedule' } = {}) {
  const stage = interview.interviewStage || 'todo';
  if (!shouldRegisterInterviewCallForStage(stage, interview.status)) {
    if (stage === 'todo' || interview.status === 'todo') await deleteGeneratedInterviewCalls(interview);
    return null;
  }
  const scheduledAt = dateValue(interview.interviewNextAt);
  if (!scheduledAt) return null;
  const notes = clean(interview.stageNotes?.[stage] || interview.interviewNotes);
  const meetingLink = clean(meetingLinkForStage(interview.stageMeetingLinks, stage));
  return upsertInterviewCallForStage(interview, {
    callerUserId: interview.callerUserId || null,
    interviewStage: stage,
    scheduledAt: new Date(scheduledAt),
    durationMinutes: Number(interview.interviewDurationMinutes || 60),
    meetingLink: meetingLink || null,
    notes: notes || null,
  }, {
    sourceType,
    metadata: { createdFrom: sourceType },
  });
}

export async function deleteGeneratedInterviewCalls(interview) {
  if (!interview?.id) return 0;
  return getInterviewCallModel().destroy({
    where: {
      interviewId: interview.id,
      sourceType: { [Op.ne]: 'manual' },
    },
  });
}

export async function upsertInterviewCallForStage(interview, attrs, { sourceType = 'current_schedule', metadata = {} } = {}) {
  const stage = attrs.interviewStage || interview?.interviewStage || 'todo';
  const scheduledAt = dateValue(attrs.scheduledAt);
  if (!scheduledAt) throw new InputError('Call date is required');
  if (!shouldRegisterInterviewCallForStage(stage, interview?.status)) throw new InputError('Choose a scheduled interview stage');
  const sourceKey = interviewCallSourceKey({ interviewId: interview.id, stage });
  const existing = await getInterviewCallModel().findOne({
    where: { interviewId: interview.id, interviewStage: stage },
  });
  const keepExplicitCaller = existing?.metadata?.callerUserIdManuallyAssigned && !metadata.callerUserIdManuallyAssigned;
  const values = {
    interviewId: interview.id,
    userId: interview.userId || null,
    callerUserId: keepExplicitCaller ? existing.callerUserId : attrs.callerUserId ?? interview.callerUserId ?? null,
    interviewStage: stage,
    scheduledAt: new Date(scheduledAt),
    durationMinutes: Number(attrs.durationMinutes || interview.interviewDurationMinutes || 60),
    meetingLink: attrs.meetingLink || null,
    notes: attrs.notes || null,
    sourceType,
    sourceKey,
    metadata: { ...(existing?.metadata || {}), ...metadata },
  };

  if (existing) {
    await existing.update(values);
    return existing;
  }
  return getInterviewCallModel().create(values);
}

export async function syncInterviewCallerToCalls(interview) {
  if (!interview?.id) return;
  const calls = await getInterviewCallModel().findAll({ where: { interviewId: interview.id } });
  await Promise.all(
    calls
      .filter((call) => !call.metadata?.callerUserIdManuallyAssigned)
      .map((call) => call.update({ callerUserId: interview.callerUserId || null })),
  );
}

export function shouldRegisterInterviewCallForStage(stage, status = 'interviewing') {
  const normalizedStage = clean(stage || 'todo');
  const normalizedStatus = clean(status || 'interviewing');
  return normalizedStage !== 'todo'
    && normalizedStatus !== 'todo'
    && !['failed', 'lost'].includes(normalizedStage)
    && !['failed', 'lost'].includes(normalizedStatus);
}

export function interviewCallSourceKey({ interviewId, stage }) {
  return `interview:${interviewId}:call:${stage || 'todo'}`;
}

export function interviewOccurrenceLogFromSnapshot(previous, interview) {
  const scheduledAt = dateValue(previous.interviewNextAt);
  if (!scheduledAt) return null;
  const stage = previous.interviewStage || 'todo';
  const notes = clean(previous.stageNotes?.[stage] || previous.interviewNotes);
  const meetingLink = clean(previous.meetingLink || meetingLinkForStage(previous.stageMeetingLinks, stage));
  return {
    eventType: 'interview_occurrence',
    fromValue: null,
    toValue: scheduledAt,
    metadata: {
      stage,
      scheduledAt,
      durationMinutes: Number(previous.interviewDurationMinutes || 60),
      progressedToStage: interview.interviewStage || null,
      ...(notes ? { notes } : {}),
      ...(meetingLink ? { meetingLink } : {}),
    },
  };
}

export function meetingLinkForStage(stageMeetingLinks, stage) {
  if (!stageMeetingLinks || typeof stageMeetingLinks !== 'object') return '';
  return clean(stageMeetingLinks[stage]) || '';
}

export function changedStageNoteKeys(previousNotes, nextNotes) {
  const keys = new Set([...Object.keys(previousNotes || {}), ...Object.keys(nextNotes || {})]);
  return [...keys].filter((key) => clean(previousNotes?.[key]) !== clean(nextNotes?.[key]));
}

export function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatInterviewLog(log) {
  return {
    id: log.id,
    eventType: log.eventType,
    fromValue: log.fromValue,
    toValue: log.toValue,
    metadata: log.metadata || {},
    createdAt: log.createdAt,
  };
}
