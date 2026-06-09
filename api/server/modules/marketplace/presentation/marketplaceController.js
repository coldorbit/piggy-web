import {
  ensureWebModels,
  getMarketplaceCallerProfileModel,
  getMarketplaceInterviewOpportunityModel,
  getMarketplaceMatchModel,
  getMarketplaceParticipantModel,
  getWebUserModel,
} from '../../../../db.js';
import { handleInputError } from '../../../utils/errors.js';
import { isAdminRole } from '../../../utils/roles.js';

export async function getMarketplaceDashboard(req, res, next) {
  try {
    await ensureWebModels();
    if (!isAdminRole(req.user)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const internal = true;
    const WebUser = getWebUserModel();
    const Participant = getMarketplaceParticipantModel();
    const Interview = getMarketplaceInterviewOpportunityModel();
    const Caller = getMarketplaceCallerProfileModel();
    const Match = getMarketplaceMatchModel();

    const [participants, interviews, callers, matches] = await Promise.all([
      internal
        ? Participant.findAll({ include: [{ model: WebUser, as: 'user', required: true }], order: [['updatedAt', 'DESC']] })
        : Participant.findAll({ where: { userId: req.user.id }, include: [{ model: WebUser, as: 'user', required: true }] }),
      Interview.findAll({
        where: internal ? {} : { ownerUserId: req.user.id },
        include: [{ model: WebUser, as: 'owner', required: true }],
        order: [['updatedAt', 'DESC']],
      }),
      Caller.findAll({
        where: internal ? {} : { ownerUserId: req.user.id },
        include: [{ model: WebUser, as: 'owner', required: true }],
        order: [['updatedAt', 'DESC']],
      }),
      Match.findAll({
        include: [
          { model: Interview, as: 'interviewOpportunity', required: true, include: [{ model: WebUser, as: 'owner', required: true }] },
          { model: Caller, as: 'callerProfile', required: true, include: [{ model: WebUser, as: 'owner', required: true }] },
          { model: WebUser, as: 'assignedInternalUser', required: false },
        ],
        order: [
          ['scheduledAt', 'ASC NULLS LAST'],
          ['updatedAt', 'DESC'],
        ],
      }),
    ]);

    const visibleMatches = internal
      ? matches
      : matches.filter(
          (match) =>
            String(match.interviewOpportunity?.ownerUserId) === String(req.user.id) ||
            String(match.callerProfile?.ownerUserId) === String(req.user.id),
        );

    res.json({
      canManage: internal,
      participants: participants.map(formatParticipant),
      interviews: interviews.map((row) => formatInterview(row, internal)),
      callers: callers.map((row) => formatCaller(row, internal)),
      matches: visibleMatches.map((row) => formatMatch(row, internal)),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

function formatParticipant(row) {
  return {
    id: row.id,
    userId: row.userId,
    username: row.user?.username,
    participantRole: row.participantRole,
    displayName: row.displayName,
    timezone: row.timezone,
    reviewStatus: row.reviewStatus,
    riskStatus: row.riskStatus,
    publicNotes: row.publicNotes,
    internalNotes: row.internalNotes,
  };
}

function formatInterview(row, internal) {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    ownerUsername: internal ? row.owner?.username : undefined,
    title: row.title,
    company: row.company,
    stage: row.stage,
    format: row.format,
    timezone: row.timezone,
    availabilityWindows: row.availabilityWindows,
    requiredSkills: row.requiredSkills,
    budget: row.budget,
    jobUrl: row.jobUrl,
    notes: row.notes,
    reviewStatus: row.reviewStatus,
    matchStatus: row.matchStatus,
  };
}

function formatCaller(row, internal) {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    ownerUsername: internal ? row.owner?.username : undefined,
    callerName: row.callerName,
    skills: row.skills,
    languages: row.languages,
    experience: row.experience,
    timezone: row.timezone,
    availabilityWindows: row.availabilityWindows,
    preferredCategories: row.preferredCategories,
    rateExpectation: row.rateExpectation,
    constraints: row.constraints,
    reviewStatus: row.reviewStatus,
    availabilityStatus: row.availabilityStatus,
  };
}

function formatMatch(row, internal) {
  return {
    id: row.id,
    status: row.status,
    callerConfirmationStatus: row.callerConfirmationStatus,
    interviewConfirmationStatus: row.interviewConfirmationStatus,
    scheduledAt: row.scheduledAt,
    meetingLink: internal ? row.meetingLink : null,
    outcomeStatus: row.outcomeStatus,
    offerStatus: row.offerStatus,
    offerAmount: row.offerAmount,
    offerTerms: row.offerTerms,
    platformFee: internal ? row.platformFee : undefined,
    callerPayout: row.callerPayout,
    paymentStatus: row.paymentStatus,
    payoutStatus: row.payoutStatus,
    assignedInternalUsername: internal ? row.assignedInternalUser?.username : undefined,
    interviewOpportunity: row.interviewOpportunity ? formatInterview(row.interviewOpportunity, internal) : null,
    callerProfile: row.callerProfile ? formatCaller(row.callerProfile, internal) : null,
  };
}
