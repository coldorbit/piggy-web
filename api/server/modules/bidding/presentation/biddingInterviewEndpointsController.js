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
import { isInterviewBidStatus } from './biddingQueriesController.js';
import { bidStatusFromInterviewStatus, bidUpdateValuesFromAttrs, canAssignInterviewCaller, dateValue, formatInterviewBid, formatInterviewCall, interviewSnapshot, interviewValuesFromAttrs, interviewWriteProfileForUser, logInterviewChanges, manualInterviewCallAttributes, rejectReviewStatusForNonAdmin, syncInterviewCallForCurrentSchedule, syncInterviewCallerToCalls, upsertInterviewForBid } from './biddingInterviewDomainController.js';

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
    if (rejectReviewStatusForNonAdmin(req, res, attrs)) return;
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    let bidProfile = null;
    if (!isAdminRole(req.user)) {
      bidProfile = await accessibleProfile(req, bid.profileId);
      if (isLegacyProfile(bidProfile) && !isInterviewBidStatus(attrs.status || bid.status)) {
        res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding' });
        return;
      }
      if (!PRIVILEGED_USER_ROLES.includes(user.role) && String(bid.userId) !== String(user.id)) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }
      if (!canAssignInterviewCaller(user)) delete attrs.callerUserId;
    } else {
      bidProfile = await getBidProfileModel().findByPk(bid.profileId);
      if (!isProfileInUserWorkspace(bidProfile, req.user)) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }
      if (isLegacyProfile(bidProfile) && !isInterviewBidStatus(attrs.status || bid.status)) {
        res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding' });
        return;
      }
    }
    const now = new Date();
    const previousBid = formatBid(bid);
    const updates = { ...bidUpdateValuesFromAttrs(attrs), updatedAt: now };
    if (shouldRefreshBidAtForStatus(attrs.status, bid.status)) {
      updates.bidAt = now;
    }
    if (shouldSetInterviewAtForStatus(attrs.status, bid.status, bid.interviewAt)) {
      updates.interviewAt = now;
    }
    await bid.update(updates);
    if (['interviewing', 'won', 'lost'].includes(attrs.status)) {
      const job = await getScrapedJobModel().findByPk(bid.jobId);
      await upsertInterviewForBid({ bid, job, attrs, userId: bid.userId });
    }
    await recordBidChangeEvent({
      bid,
      userId: user.id,
      body: bidChangeSummary(previousBid, bid),
      metadata: { action: 'updated', previous: previousBid, current: formatBid(bid) },
    });
    res.json({ bid: formatBid(bid) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function recordBidChangeEvent({ bid, job = null, userId, body, metadata = {} }) {
  if (!bid?.id) return;
  await getCollaborationEventModel().create({
    entityType: 'bid',
    entityId: bid.id,
    profileId: bid.profileId,
    jobId: bid.jobId || job?.id || null,
    bidId: bid.id,
    authorUserId: userId || null,
    eventType: 'change',
    body: body || 'Application changed.',
    mentions: [],
    metadata,
  });
}

export function bidChangeSummary(previousBid, currentBid) {
  const changes = [];
  if (previousBid.status !== currentBid.status) changes.push(`status ${previousBid.status} -> ${currentBid.status}`);
  if (String(previousBid.callerUserId || '') !== String(currentBid.callerUserId || '')) changes.push('caller assignment changed');
  if ((previousBid.interviewStage || '') !== (currentBid.interviewStage || '')) changes.push(`stage ${previousBid.interviewStage || 'none'} -> ${currentBid.interviewStage || 'none'}`);
  if (String(previousBid.interviewNextAt || '') !== String(currentBid.interviewNextAt || '')) changes.push('next interview time changed');
  if ((previousBid.notes || '') !== (currentBid.notes || '')) changes.push('notes changed');
  if ((previousBid.interviewNotes || '') !== (currentBid.interviewNotes || '')) changes.push('interview notes changed');
  return changes.length ? `Application changed: ${changes.join(', ')}.` : 'Application updated.';
}

export async function updateInterview(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const interview = await getInterviewModel().findByPk(req.params.id);
    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }
    const attrs = bidAttributesFromBody(
      {
        ...req.body,
        status: req.body?.status || interview.status,
        ...(!Object.prototype.hasOwnProperty.call(req.body || {}, 'failureFeedback')
          ? { failureFeedback: interview.failureFeedback }
          : {}),
        ...(!Object.prototype.hasOwnProperty.call(req.body || {}, 'failureFeedbackNotes')
          ? { failureFeedbackNotes: interview.failureFeedbackNotes }
          : {}),
      },
      { allowInterviewTodoStatus: true },
    );
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (!isAdminRole(req.user)) {
      await interviewWriteProfileForUser(user, interview.profileId, 'Interview not found');
      if (!canAssignInterviewCaller(user)) delete attrs.callerUserId;
    }
    const previous = interviewSnapshot(interview);
    const now = new Date();
    await interview.update({ ...interviewValuesFromAttrs(attrs, interview), updatedAt: now });
    await logInterviewChanges({ interview, previous, attrs, userId: user.id });
    await syncInterviewCallForCurrentSchedule(interview, { sourceType: 'schedule_update' });
    if (String(previous.callerUserId || '') !== String(interview.callerUserId || '')) {
      await syncInterviewCallerToCalls(interview);
    }
    if (interview.jobBidId) {
      const bid = await getJobBidModel().findByPk(interview.jobBidId);
      if (bid) {
        const bidAttrs = { ...attrs, status: bidStatusFromInterviewStatus(attrs.status) };
        const bidUpdates = { ...bidUpdateValuesFromAttrs(bidAttrs), updatedAt: now };
        if (shouldRefreshBidAtForStatus(bidAttrs.status, bid.status)) bidUpdates.bidAt = now;
        if (shouldSetInterviewAtForStatus(bidAttrs.status, bid.status, bid.interviewAt)) bidUpdates.interviewAt = now;
        await bid.update(bidUpdates);
      }
    }
    res.json({ bid: formatInterviewBid(interview) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteInterview(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const interview = await getInterviewModel().findByPk(req.params.id);
    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }
    if (!isAdminRole(req.user)) {
      await interviewWriteProfileForUser(user, interview.profileId, 'Interview not found');
    }
    if (interview.jobBidId) {
      const bid = await getJobBidModel().findByPk(interview.jobBidId);
      if (bid) {
        await bid.update({
          callerUserId: null,
          status: 'submitted',
          interviewStage: null,
          interviewNextAt: null,
          interviewNotes: null,
          updatedAt: new Date(),
        });
      }
    }
    await interview.destroy();
    res.status(204).send();
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateInterviewCall(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const call = await getInterviewCallModel().findByPk(req.params.id);
    if (!call) {
      res.status(404).json({ error: 'Interview call not found' });
      return;
    }

    const interview = await getInterviewModel().findByPk(call.interviewId);
    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }
    if (!isAdminRole(user)) {
      await interviewWriteProfileForUser(user, interview.profileId, 'Interview not found');
    }

    const attrs = manualInterviewCallAttributes({
      ...req.body,
      interviewStage: call.interviewStage || interview.interviewStage || 'todo',
    }, interview);
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);

    const syncCurrentSchedule = callMatchesCurrentInterviewSchedule(call, interview);
    const durationMinutes = attrs.durationMinutes || call.durationMinutes || interview.interviewDurationMinutes || 60;
    const callerUserId = attrs.callerUserIdProvided ? attrs.callerUserId ?? null : call.callerUserId;
    const now = new Date();
    const metadata = attrs.callerUserIdProvided
      ? { ...(call.metadata || {}), callerUserIdManuallyAssigned: true }
      : call.metadata || {};
    await call.update({
      callerUserId,
      scheduledAt: attrs.scheduledAt,
      durationMinutes,
      meetingLink: attrs.meetingLink || null,
      notes: attrs.notes || null,
      metadata,
      updatedAt: now,
    });

    if (syncCurrentSchedule) {
      await interview.update({
        interviewNextAt: attrs.scheduledAt,
        interviewDurationMinutes: durationMinutes,
        updatedAt: now,
      });
      if (interview.jobBidId) {
        const bid = await getJobBidModel().findByPk(interview.jobBidId);
        if (bid) {
          await bid.update({
            interviewNextAt: attrs.scheduledAt,
            interviewDurationMinutes: durationMinutes,
            updatedAt: now,
          });
        }
      }
    }

    res.json({ call: formatInterviewCall(call) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteInterviewCall(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const call = await getInterviewCallModel().findByPk(req.params.id);
    if (!call) {
      res.status(404).json({ error: 'Interview call not found' });
      return;
    }

    const interview = await getInterviewModel().findByPk(call.interviewId);
    const profile = interview ? await getBidProfileModel().findByPk(interview.profileId) : null;
    if (!canDeleteInterviewCall(user, call, interview, profile)) {
      res.status(403).json({ error: 'Only the call owner, interview owner, or a superadmin can delete interview calls' });
      return;
    }
    const clearsCurrentSchedule = interview && callMatchesCurrentInterviewSchedule(call, interview);
    await call.destroy();

    if (clearsCurrentSchedule) {
      await interview.update({ interviewNextAt: null, updatedAt: new Date() });
      if (interview.jobBidId) {
        const bid = await getJobBidModel().findByPk(interview.jobBidId);
        if (bid) await bid.update({ interviewNextAt: null, updatedAt: new Date() });
      }
    }

    res.status(204).send();
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export function callMatchesCurrentInterviewSchedule(call, interview) {
  return dateValue(call.scheduledAt) === dateValue(interview.interviewNextAt)
    && String(call.interviewStage || '') === String(interview.interviewStage || '');
}

export function canDeleteInterviewCall(user, call, interview = null, profile = null) {
  if (isSuperadmin(user)) return true;
  const userId = String(user?.id || '');
  if (!userId) return false;
  return String(call?.userId || '') === userId
    || String(interview?.userId || '') === userId
    || String(profile?.userId || '') === userId;
}

export async function ensureCallerUser(callerUserId) {
  const caller = await getWebUserModel().findOne({ where: { id: callerUserId, role: 'caller' } });
  if (!caller) throw new NotFoundError('Caller not found');
  return caller;
}

export function batchApplicationItems(value) {
  const items = Array.isArray(value) ? value : [];
  const normalized = items
    .map((item) => ({
      jobId: numericBatchId(item?.jobId || item?.id),
      bidId: numericBatchId(item?.bidId),
    }))
    .filter((item) => item.jobId || item.bidId);
  const deduped = [];
  const seen = new Set();
  for (const item of normalized) {
    const key = `${item.bidId || ''}:${item.jobId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  if (!deduped.length) throw new InputError('items must include at least one application or job');
  if (deduped.length > BATCH_LIMIT) throw new InputError(`items cannot include more than ${BATCH_LIMIT} applications`);
  return deduped;
}

export function numericBatchIds(value, label) {
  const ids = Array.isArray(value) ? value.map(numericBatchId).filter(Boolean) : [];
  const deduped = [...new Set(ids)];
  if (!deduped.length) throw new InputError(`${label} must include at least one job`);
  if (deduped.length > BATCH_LIMIT) throw new InputError(`${label} cannot include more than ${BATCH_LIMIT} jobs`);
  return deduped;
}

export function numericBatchId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}
