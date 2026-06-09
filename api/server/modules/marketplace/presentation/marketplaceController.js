import {
  ensureWebModels,
  getMarketplaceCallerProfileModel,
  getMarketplaceInterviewOpportunityModel,
  getMarketplaceMatchModel,
  getMarketplaceParticipantModel,
} from '../../../../db.js';
import { handleInputError } from '../../../utils/errors.js';
import {
  callerProfileAttributes,
  callerReviewAttributes,
  canManageMarketplace,
  createMatchAttributes,
  findCallerProfile,
  findInterviewOpportunity,
  findMatch,
  formatCallerProfile,
  formatInterviewOpportunity,
  formatMatch,
  formatParticipant,
  interviewOpportunityAttributes,
  interviewReviewAttributes,
  marketplaceIncludes,
  matchUpdateAttributes,
  matchVisibilityWhere,
  participantAttributes,
  participantReviewAttributes,
} from '../application/marketplaceService.js';

export async function getMarketplaceDashboard(req, res, next) {
  try {
    await ensureWebModels();
    const user = req.user;
    const internal = canManageMarketplace(user);
    const MarketplaceParticipant = getMarketplaceParticipantModel();
    const MarketplaceInterviewOpportunity = getMarketplaceInterviewOpportunityModel();
    const MarketplaceCallerProfile = getMarketplaceCallerProfileModel();
    const MarketplaceMatch = getMarketplaceMatchModel();
    const includes = await marketplaceIncludes();

    const [participant, participants, interviews, callers, matches] = await Promise.all([
      MarketplaceParticipant.findOne({ where: { userId: user.id }, include: includes.participant }),
      internal
        ? MarketplaceParticipant.findAll({ include: includes.participant, order: [['updatedAt', 'DESC']] })
        : Promise.resolve([]),
      MarketplaceInterviewOpportunity.findAll({
        where: internal ? {} : { ownerUserId: user.id },
        include: includes.interview,
        order: [['updatedAt', 'DESC']],
      }),
      MarketplaceCallerProfile.findAll({
        where: internal ? {} : { ownerUserId: user.id },
        include: includes.caller,
        order: [['updatedAt', 'DESC']],
      }),
      MarketplaceMatch.findAll({
        where: matchVisibilityWhere(user),
        include: includes.match,
        order: [
          ['scheduledAt', 'ASC NULLS LAST'],
          ['updatedAt', 'DESC'],
        ],
      }),
    ]);

    res.json({
      canManage: internal,
      participant: formatParticipant(participant, { internal }),
      participants: participants.map((row) => formatParticipant(row, { internal })),
      interviews: interviews.map((row) => formatInterviewOpportunity(row, { internal })),
      callers: callers.map((row) => formatCallerProfile(row, { internal })),
      matches: matches.map((row) => formatMatch(row, { internal, viewerUserId: user.id })),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function upsertMarketplaceParticipant(req, res, next) {
  try {
    await ensureWebModels();
    const MarketplaceParticipant = getMarketplaceParticipantModel();
    const attrs = participantAttributes(req.body);
    const [participant] = await MarketplaceParticipant.findOrCreate({
      where: { userId: req.user.id },
      defaults: { ...attrs, userId: req.user.id },
    });
    if (!participant.isNewRecord) await participant.update(attrs);
    res.status(201).json({ participant: formatParticipant(participant) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function reviewMarketplaceParticipant(req, res, next) {
  try {
    await ensureWebModels();
    requireMarketplaceManager(req, res);
    if (res.headersSent) return;
    const MarketplaceParticipant = getMarketplaceParticipantModel();
    const participant = await MarketplaceParticipant.findByPk(req.params.id);
    if (!participant) {
      res.status(404).json({ error: 'Participant not found' });
      return;
    }
    await participant.update(participantReviewAttributes(req.body, req.user.id));
    res.json({ participant: formatParticipant(participant, { internal: true }) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createInterviewOpportunity(req, res, next) {
  try {
    await ensureWebModels();
    const MarketplaceInterviewOpportunity = getMarketplaceInterviewOpportunityModel();
    const interview = await MarketplaceInterviewOpportunity.create({
      ...interviewOpportunityAttributes(req.body),
      ownerUserId: req.user.id,
    });
    res.status(201).json({ interview: formatInterviewOpportunity(interview) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function reviewInterviewOpportunity(req, res, next) {
  try {
    await ensureWebModels();
    requireMarketplaceManager(req, res);
    if (res.headersSent) return;
    const interview = await findInterviewOpportunity(req.params.id);
    await interview.update(interviewReviewAttributes(req.body, req.user.id));
    res.json({ interview: formatInterviewOpportunity(interview, { internal: true }) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createCallerProfile(req, res, next) {
  try {
    await ensureWebModels();
    const MarketplaceCallerProfile = getMarketplaceCallerProfileModel();
    const caller = await MarketplaceCallerProfile.create({
      ...callerProfileAttributes(req.body),
      ownerUserId: req.user.id,
    });
    res.status(201).json({ caller: formatCallerProfile(caller) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function reviewCallerProfile(req, res, next) {
  try {
    await ensureWebModels();
    requireMarketplaceManager(req, res);
    if (res.headersSent) return;
    const caller = await findCallerProfile(req.params.id);
    await caller.update(callerReviewAttributes(req.body, req.user.id));
    res.json({ caller: formatCallerProfile(caller, { internal: true }) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createMarketplaceMatch(req, res, next) {
  try {
    await ensureWebModels();
    requireMarketplaceManager(req, res);
    if (res.headersSent) return;
    const MarketplaceMatch = getMarketplaceMatchModel();
    const attrs = await createMatchAttributes(req.body, req.user.id);
    const match = await MarketplaceMatch.create(attrs);
    await syncMatchedAssets(match);
    const includes = await marketplaceIncludes();
    const reloaded = await MarketplaceMatch.findByPk(match.id, { include: includes.match });
    res.status(201).json({ match: formatMatch(reloaded, { internal: true, viewerUserId: req.user.id }) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateMarketplaceMatch(req, res, next) {
  try {
    await ensureWebModels();
    const match = await findMatch(req.params.id);
    if (!canManageMarketplace(req.user)) {
      const includes = await marketplaceIncludes();
      const hydrated = await getMarketplaceMatchModel().findByPk(match.id, { include: includes.match });
      if (!userCanSeeMatch(req.user, hydrated)) {
        res.status(403).json({ error: 'Marketplace match access required' });
        return;
      }
      await updateUserVisibleMatch(hydrated, req, res);
      return;
    }

    await match.update(matchUpdateAttributes(req.body, req.user.id));
    await syncMatchedAssets(match);
    const includes = await marketplaceIncludes();
    const reloaded = await getMarketplaceMatchModel().findByPk(match.id, { include: includes.match });
    res.json({ match: formatMatch(reloaded, { internal: true, viewerUserId: req.user.id }) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

async function updateUserVisibleMatch(match, req, res) {
  const isInterviewOwner = String(match.interviewOpportunity?.ownerUserId) === String(req.user.id);
  const isCallerOwner = String(match.callerProfile?.ownerUserId) === String(req.user.id);
  const attrs = {};

  if (isInterviewOwner && Object.prototype.hasOwnProperty.call(req.body, 'interviewConfirmationStatus')) {
    attrs.interviewConfirmationStatus = req.body.interviewConfirmationStatus;
  }
  if (isInterviewOwner && Object.prototype.hasOwnProperty.call(req.body, 'interviewOwnerNotes')) {
    attrs.interviewOwnerNotes = req.body.interviewOwnerNotes;
  }
  if (isCallerOwner && Object.prototype.hasOwnProperty.call(req.body, 'callerConfirmationStatus')) {
    attrs.callerConfirmationStatus = req.body.callerConfirmationStatus;
  }
  if (isCallerOwner && Object.prototype.hasOwnProperty.call(req.body, 'callerOwnerNotes')) {
    attrs.callerOwnerNotes = req.body.callerOwnerNotes;
  }

  const updateAttrs = matchUpdateAttributes(attrs, match.assignedInternalUserId || req.user.id);
  delete updateAttrs.assignedInternalUserId;
  await match.update(updateAttrs);
  res.json({ match: formatMatch(match, { viewerUserId: req.user.id }) });
}

async function syncMatchedAssets(match) {
  const updates = {};
  if (['confirmed', 'scheduled', 'in_progress', 'completed', 'offer_tracking'].includes(match.status)) {
    updates.matchStatus = match.status === 'confirmed' ? 'matched' : match.status;
  }
  if (match.status === 'closed') updates.matchStatus = 'closed';
  if (match.status === 'cancelled' || match.status === 'failed') updates.matchStatus = 'cancelled';
  if (Object.keys(updates).length) {
    const interview = await findInterviewOpportunity(match.interviewOpportunityId);
    await interview.update(updates);
  }

  const callerUpdates = {};
  if (['confirmed', 'scheduled', 'in_progress'].includes(match.status)) callerUpdates.availabilityStatus = match.status === 'confirmed' ? 'matched' : match.status;
  if (['completed', 'closed', 'cancelled', 'failed'].includes(match.status)) callerUpdates.availabilityStatus = 'available';
  if (Object.keys(callerUpdates).length) {
    const caller = await findCallerProfile(match.callerProfileId);
    await caller.update(callerUpdates);
  }
}

function requireMarketplaceManager(req, res) {
  if (!canManageMarketplace(req.user)) {
    res.status(403).json({ error: 'Internal marketplace access required' });
  }
}

function userCanSeeMatch(user, match) {
  return (
    String(match?.interviewOpportunity?.ownerUserId) === String(user.id) ||
    String(match?.callerProfile?.ownerUserId) === String(user.id)
  );
}
