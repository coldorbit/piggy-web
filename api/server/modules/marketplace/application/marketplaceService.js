import { Op } from 'sequelize';
import {
  getMarketplaceCallerProfileModel,
  getMarketplaceInterviewOpportunityModel,
  getMarketplaceMatchModel,
  getMarketplaceParticipantModel,
  getWebUserModel,
} from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';
import { INTERNAL_DATA_ROLES } from '../../../utils/roles.js';

export const PARTICIPANT_ROLES = new Set(['interview_owner', 'caller_owner', 'both']);
export const REVIEW_STATUSES = new Set(['pending', 'approved', 'needs_info', 'rejected', 'suspended']);
export const RISK_STATUSES = new Set(['normal', 'watch', 'blocked']);
export const INTERVIEW_MATCH_STATUSES = new Set(['submitted', 'matching', 'matched', 'scheduled', 'completed', 'closed', 'cancelled', 'rejected']);
export const CALLER_AVAILABILITY_STATUSES = new Set(['available', 'matched', 'scheduled', 'in_progress', 'unavailable', 'suspended']);
export const MATCH_STATUSES = new Set([
  'suggested',
  'internal_review',
  'pending_caller_confirmation',
  'pending_interview_confirmation',
  'confirmed',
  'scheduled',
  'in_progress',
  'completed',
  'offer_tracking',
  'closed',
  'cancelled',
  'failed',
]);
export const CONFIRMATION_STATUSES = new Set(['pending', 'confirmed', 'declined']);
export const OUTCOME_STATUSES = new Set(['pending', 'completed', 'next_round', 'rejected', 'offer_received', 'offer_accepted', 'offer_declined', 'cancelled', 'no_show']);
export const OFFER_STATUSES = new Set(['none', 'pending', 'confirmed', 'accepted', 'declined']);
export const PAYMENT_STATUSES = new Set(['not_started', 'pending_confirmation', 'requested', 'paid', 'closed']);
export const PAYOUT_STATUSES = new Set(['not_started', 'pending', 'completed', 'closed']);

export function canManageMarketplace(user) {
  return INTERNAL_DATA_ROLES.includes(user?.role);
}

export function participantAttributes(body = {}) {
  const participantRole = enumValue(body.participantRole, PARTICIPANT_ROLES, 'participantRole') || 'both';
  const displayName = clean(body.displayName);
  if (!displayName) throw new InputError('displayName is required');

  return {
    participantRole,
    displayName,
    timezone: clean(body.timezone) || null,
    publicNotes: clean(body.publicNotes) || null,
  };
}

export function participantReviewAttributes(body = {}, reviewerId) {
  return {
    reviewStatus: enumValue(body.reviewStatus, REVIEW_STATUSES, 'reviewStatus') || 'pending',
    riskStatus: enumValue(body.riskStatus, RISK_STATUSES, 'riskStatus') || 'normal',
    internalNotes: clean(body.internalNotes) || null,
    reviewedByUserId: reviewerId,
    reviewedAt: new Date(),
  };
}

export function interviewOpportunityAttributes(body = {}) {
  const title = clean(body.title);
  if (!title) throw new InputError('title is required');

  return {
    title,
    company: clean(body.company) || null,
    stage: clean(body.stage) || 'screen',
    format: clean(body.format) || null,
    timezone: clean(body.timezone) || null,
    availabilityWindows: clean(body.availabilityWindows) || null,
    requiredSkills: clean(body.requiredSkills) || null,
    budget: clean(body.budget) || null,
    jobUrl: clean(body.jobUrl) || null,
    notes: clean(body.notes) || null,
  };
}

export function callerProfileAttributes(body = {}) {
  const callerName = clean(body.callerName);
  if (!callerName) throw new InputError('callerName is required');

  return {
    callerName,
    skills: clean(body.skills) || null,
    languages: clean(body.languages) || null,
    experience: clean(body.experience) || null,
    timezone: clean(body.timezone) || null,
    availabilityWindows: clean(body.availabilityWindows) || null,
    preferredCategories: clean(body.preferredCategories) || null,
    rateExpectation: clean(body.rateExpectation) || null,
    constraints: clean(body.constraints) || null,
  };
}

export function interviewReviewAttributes(body = {}, reviewerId) {
  return {
    reviewStatus: enumValue(body.reviewStatus, REVIEW_STATUSES, 'reviewStatus') || 'pending',
    matchStatus: enumValue(body.matchStatus, INTERVIEW_MATCH_STATUSES, 'matchStatus') || matchStatusForReview(body.reviewStatus),
    internalNotes: clean(body.internalNotes) || null,
    reviewedByUserId: reviewerId,
    reviewedAt: new Date(),
  };
}

export function callerReviewAttributes(body = {}, reviewerId) {
  return {
    reviewStatus: enumValue(body.reviewStatus, REVIEW_STATUSES, 'reviewStatus') || 'pending',
    availabilityStatus: enumValue(body.availabilityStatus, CALLER_AVAILABILITY_STATUSES, 'availabilityStatus') || 'available',
    performanceNotes: clean(body.performanceNotes) || null,
    internalNotes: clean(body.internalNotes) || null,
    reviewedByUserId: reviewerId,
    reviewedAt: new Date(),
  };
}

export async function createMatchAttributes(body = {}, userId) {
  const interviewOpportunityId = numericId(body.interviewOpportunityId, 'interviewOpportunityId');
  const callerProfileId = numericId(body.callerProfileId, 'callerProfileId');
  const [interviewOpportunity, callerProfile] = await Promise.all([
    findInterviewOpportunity(interviewOpportunityId),
    findCallerProfile(callerProfileId),
  ]);
  if (interviewOpportunity.reviewStatus !== 'approved') throw new InputError('Interview opportunity must be approved before matching');
  if (callerProfile.reviewStatus !== 'approved') throw new InputError('Caller profile must be approved before matching');
  if (callerProfile.availabilityStatus === 'suspended') throw new InputError('Suspended caller profiles cannot be matched');

  return {
    interviewOpportunityId,
    callerProfileId,
    assignedInternalUserId: userId,
    status: enumValue(body.status, MATCH_STATUSES, 'status') || 'suggested',
    internalNotes: clean(body.internalNotes) || null,
  };
}

export function matchUpdateAttributes(body = {}, userId) {
  const attrs = {
    assignedInternalUserId: body.assignedInternalUserId ? numericId(body.assignedInternalUserId, 'assignedInternalUserId') : userId,
  };

  assignEnum(attrs, body, 'status', MATCH_STATUSES);
  assignEnum(attrs, body, 'callerConfirmationStatus', CONFIRMATION_STATUSES);
  assignEnum(attrs, body, 'interviewConfirmationStatus', CONFIRMATION_STATUSES);
  assignEnum(attrs, body, 'outcomeStatus', OUTCOME_STATUSES);
  assignEnum(attrs, body, 'offerStatus', OFFER_STATUSES);
  assignEnum(attrs, body, 'paymentStatus', PAYMENT_STATUSES);
  assignEnum(attrs, body, 'payoutStatus', PAYOUT_STATUSES);
  assignText(attrs, body, 'meetingLink');
  assignText(attrs, body, 'internalNotes');
  assignText(attrs, body, 'interviewOwnerNotes');
  assignText(attrs, body, 'callerOwnerNotes');
  assignText(attrs, body, 'offerAmount');
  assignText(attrs, body, 'offerTerms');
  assignText(attrs, body, 'platformFee');
  assignText(attrs, body, 'callerPayout');

  if (Object.prototype.hasOwnProperty.call(body, 'scheduledAt')) {
    attrs.scheduledAt = dateValue(body.scheduledAt, 'scheduledAt');
  }
  if (attrs.status === 'closed' && !body.closedAt) attrs.closedAt = new Date();
  if (Object.prototype.hasOwnProperty.call(body, 'closedAt')) attrs.closedAt = dateValue(body.closedAt, 'closedAt');

  return attrs;
}

export async function participantForUser(userId) {
  const MarketplaceParticipant = getMarketplaceParticipantModel();
  return MarketplaceParticipant.findOne({ where: { userId } });
}

export async function findInterviewOpportunity(id) {
  const MarketplaceInterviewOpportunity = getMarketplaceInterviewOpportunityModel();
  const row = await MarketplaceInterviewOpportunity.findByPk(id);
  if (!row) throw new NotFoundError('Interview opportunity not found');
  return row;
}

export async function findCallerProfile(id) {
  const MarketplaceCallerProfile = getMarketplaceCallerProfileModel();
  const row = await MarketplaceCallerProfile.findByPk(id);
  if (!row) throw new NotFoundError('Caller profile not found');
  return row;
}

export async function findMatch(id) {
  const MarketplaceMatch = getMarketplaceMatchModel();
  const row = await MarketplaceMatch.findByPk(id);
  if (!row) throw new NotFoundError('Marketplace match not found');
  return row;
}

export async function marketplaceIncludes() {
  const WebUser = getWebUserModel();
  const MarketplaceInterviewOpportunity = getMarketplaceInterviewOpportunityModel();
  const MarketplaceCallerProfile = getMarketplaceCallerProfileModel();
  return {
    participant: [{ model: WebUser, as: 'user', required: true }],
    interview: [{ model: WebUser, as: 'owner', required: true }],
    caller: [{ model: WebUser, as: 'owner', required: true }],
    match: [
      { model: MarketplaceInterviewOpportunity, as: 'interviewOpportunity', required: true, include: [{ model: WebUser, as: 'owner', required: true }] },
      { model: MarketplaceCallerProfile, as: 'callerProfile', required: true, include: [{ model: WebUser, as: 'owner', required: true }] },
      { model: WebUser, as: 'assignedInternalUser', required: false },
    ],
  };
}

export function matchVisibilityWhere(user) {
  if (canManageMarketplace(user)) return {};
  return {
    [Op.or]: [
      { '$interviewOpportunity.owner.id$': user.id },
      { '$callerProfile.owner.id$': user.id },
    ],
  };
}

export function formatParticipant(row, { internal = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    username: row.user?.username,
    participantRole: row.participantRole,
    displayName: row.displayName,
    timezone: row.timezone,
    reviewStatus: row.reviewStatus,
    riskStatus: internal ? row.riskStatus : undefined,
    publicNotes: row.publicNotes,
    internalNotes: internal ? row.internalNotes : undefined,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function formatInterviewOpportunity(row, { internal = false } = {}) {
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
    internalNotes: internal ? row.internalNotes : undefined,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function formatCallerProfile(row, { internal = false } = {}) {
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
    performanceNotes: internal ? row.performanceNotes : undefined,
    internalNotes: internal ? row.internalNotes : undefined,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function formatMatch(row, { internal = false, viewerUserId = null } = {}) {
  const interviewOwnerId = String(row.interviewOpportunity?.ownerUserId || '');
  const callerOwnerId = String(row.callerProfile?.ownerUserId || '');
  const viewerId = String(viewerUserId || '');
  const showInterviewSide = internal || viewerId === interviewOwnerId;
  const showCallerSide = internal || viewerId === callerOwnerId;

  return {
    id: row.id,
    status: row.status,
    callerConfirmationStatus: row.callerConfirmationStatus,
    interviewConfirmationStatus: row.interviewConfirmationStatus,
    scheduledAt: row.scheduledAt,
    meetingLink: internal ? row.meetingLink : null,
    internalNotes: internal ? row.internalNotes : undefined,
    interviewOwnerNotes: showInterviewSide ? row.interviewOwnerNotes : undefined,
    callerOwnerNotes: showCallerSide ? row.callerOwnerNotes : undefined,
    outcomeStatus: row.outcomeStatus,
    offerStatus: row.offerStatus,
    offerAmount: internal || showInterviewSide ? row.offerAmount : undefined,
    offerTerms: internal || showInterviewSide ? row.offerTerms : undefined,
    platformFee: internal ? row.platformFee : undefined,
    callerPayout: internal || showCallerSide ? row.callerPayout : undefined,
    paymentStatus: internal || showInterviewSide ? row.paymentStatus : undefined,
    payoutStatus: internal || showCallerSide ? row.payoutStatus : undefined,
    closedAt: row.closedAt,
    assignedInternalUsername: internal ? row.assignedInternalUser?.username : undefined,
    interviewOpportunity: row.interviewOpportunity ? formatInterviewOpportunity(row.interviewOpportunity, { internal }) : null,
    callerProfile: row.callerProfile ? formatCallerProfile(row.callerProfile, { internal }) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function matchStatusForReview(reviewStatus) {
  if (reviewStatus === 'approved') return 'matching';
  if (reviewStatus === 'rejected') return 'rejected';
  return 'submitted';
}

function enumValue(value, allowed, label) {
  const normalized = clean(value);
  if (!normalized) return '';
  if (!allowed.has(normalized)) throw new InputError(`${label} is invalid`);
  return normalized;
}

function numericId(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new InputError(`${label} is required`);
  return number;
}

function assignEnum(attrs, body, key, allowed) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return;
  attrs[key] = enumValue(body[key], allowed, key);
}

function assignText(attrs, body, key) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return;
  attrs[key] = clean(body[key]) || null;
}

function dateValue(value, label) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new InputError(`${label} must be a valid date`);
  return date;
}
