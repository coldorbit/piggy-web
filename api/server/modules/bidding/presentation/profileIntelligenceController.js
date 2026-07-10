import {
  ensureWebModels,
  getBidProfileModel,
  getInterviewModel,
  getProfileIntelligenceModel,
  getProfilePrepPlanModel,
  getProfileStoryModel,
} from '../../../../db.js';
import { accessibleProfile, currentDbUser, formatProfile } from '../application/profilesService.js';
import {
  STAFF_ML_PLAYBOOK,
  formatProfileIntelligence,
  formatProfilePrepPlan,
  formatProfileStory,
  geocodeUsResidentAddress,
  profileIntelligenceAttributesFromBody,
  profilePrepAttributesFromBody,
  profileStoryAttributesFromBody,
  readinessForProfile,
} from '../application/profileIntelligenceService.js';
import { clean } from '../../../utils/index.js';
import { ForbiddenError, InputError, NotFoundError, handleInputError } from '../../../utils/errors.js';
import { canAccessProfileHub, isAdminRole } from '../../../utils/roles.js';

export async function getProfileHub(req, res, next) {
  try {
    await ensureWebModels();
    const access = await profileHubAccess(req, req.params.id);
    const [intelligenceRow, storyRows, prepPlan, interviewRows] = await Promise.all([
      getProfileIntelligenceModel().findOne({ where: { profileId: access.profile.id } }),
      getProfileStoryModel().findAll({
        where: {
          profileId: access.profile.id,
          ...(access.isCaller ? { verificationStatus: 'verified' } : {}),
        },
        order: [['updatedAt', 'DESC']],
      }),
      getProfilePrepPlanModel().findOne({ where: { profileId: access.profile.id } }),
      getInterviewModel().findAll({
        where: {
          profileId: access.profile.id,
          ...(access.isCaller ? { callerUserId: access.user.id } : {}),
        },
        order: [['interviewNextAt', 'ASC'], ['updatedAt', 'DESC']],
        limit: 20,
      }),
    ]);
    const intelligence = formatProfileIntelligence(intelligenceRow);
    const stories = storyRows.map(formatProfileStory);
    const formattedPrepPlan = formatProfilePrepPlan(prepPlan);
    res.json({
      hub: {
        profile: access.isCaller ? callerSafeProfile(access.profile, intelligence) : formatProfile(access.profile),
        intelligence: access.isCaller ? callerSafeIntelligence(intelligence) : intelligence,
        stories,
        prepPlan: formattedPrepPlan,
        readiness: readinessForProfile({ intelligence, stories, prepPlan: formattedPrepPlan }),
        interviews: interviewRows.map(formatHubInterview),
        playbook: STAFF_ML_PLAYBOOK,
        canEdit: access.canEdit,
        privacy: {
          addressStored: false,
          exactCoordinatesStored: false,
          statement: 'Street addresses are used only for lookup and are not retained. Saved coordinates are rounded.',
        },
      },
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateProfileIntelligence(req, res, next) {
  try {
    await ensureWebModels();
    const { profile, user } = await editableProfileHubAccess(req, req.params.id);
    const [row] = await getProfileIntelligenceModel().findOrCreate({
      where: { profileId: profile.id },
      defaults: { profileId: profile.id, updatedByUserId: user.id },
    });
    await row.update({
      ...profileIntelligenceAttributesFromBody(req.body, row),
      updatedByUserId: user.id,
    });
    res.json({ intelligence: formatProfileIntelligence(row) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function geocodeProfileLocation(req, res, next) {
  try {
    await ensureWebModels();
    const { profile, user } = await editableProfileHubAccess(req, req.params.id);
    const countryCode = clean(req.body?.countryCode || 'US').toUpperCase();
    if (countryCode !== 'US') {
      throw new InputError('Automatic address lookup currently supports U.S. addresses. Save city, region, country, and timezone manually for other countries.');
    }
    const geocode = await geocodeUsResidentAddress(req.body?.address);
    const [row] = await getProfileIntelligenceModel().findOrCreate({
      where: { profileId: profile.id },
      defaults: { profileId: profile.id, updatedByUserId: user.id },
    });
    await row.update({ ...geocode, updatedByUserId: user.id });
    res.json({ intelligence: formatProfileIntelligence(row), matchedAddress: geocode.matchedAddress });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createProfileStory(req, res, next) {
  try {
    await ensureWebModels();
    const { profile, user } = await editableProfileHubAccess(req, req.params.id);
    const story = await getProfileStoryModel().create({
      ...profileStoryAttributesFromBody(req.body),
      profileId: profile.id,
      createdByUserId: user.id,
    });
    res.status(201).json({ story: formatProfileStory(story) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateProfileStory(req, res, next) {
  try {
    await ensureWebModels();
    const { profile } = await editableProfileHubAccess(req, req.params.id);
    const story = await getProfileStoryModel().findOne({ where: { id: req.params.storyId, profileId: profile.id } });
    if (!story) throw new NotFoundError('Profile story not found');
    await story.update(profileStoryAttributesFromBody(req.body, story));
    res.json({ story: formatProfileStory(story) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteProfileStory(req, res, next) {
  try {
    await ensureWebModels();
    const { profile } = await editableProfileHubAccess(req, req.params.id);
    const count = await getProfileStoryModel().destroy({ where: { id: req.params.storyId, profileId: profile.id } });
    if (!count) throw new NotFoundError('Profile story not found');
    res.json({ ok: true });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateProfilePrepPlan(req, res, next) {
  try {
    await ensureWebModels();
    const { profile, user } = await editableProfileHubAccess(req, req.params.id);
    const [row] = await getProfilePrepPlanModel().findOrCreate({
      where: { profileId: profile.id },
      defaults: { profileId: profile.id, updatedByUserId: user.id },
    });
    await row.update({
      ...profilePrepAttributesFromBody(req.body, row),
      updatedByUserId: user.id,
    });
    res.json({ prepPlan: formatProfilePrepPlan(row) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteProfileHubRecords(profileId, options = {}) {
  await Promise.all([
    getProfileStoryModel().destroy({ where: { profileId }, ...options }),
    getProfilePrepPlanModel().destroy({ where: { profileId }, ...options }),
    getProfileIntelligenceModel().destroy({ where: { profileId }, ...options }),
  ]);
}

async function profileHubAccess(req, profileId) {
  const user = await currentDbUser(req);
  if (!canAccessProfileHub(user)) throw new ForbiddenError('Profile Hub access requires an internal role or a superadmin grant');
  if (user.role !== 'caller') {
    const profile = await accessibleProfile(req, profileId);
    return { profile, user, isCaller: false, canEdit: isAdminRole(user) || String(profile.userId) === String(user.id) };
  }
  const id = clean(profileId);
  if (!id) throw new NotFoundError('Profile not found');
  const assignedInterview = await getInterviewModel().findOne({ where: { profileId: id, callerUserId: user.id } });
  if (!assignedInterview) throw new NotFoundError('Profile not found');
  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  return { profile, user, isCaller: true, canEdit: false };
}

async function editableProfileHubAccess(req, profileId) {
  const access = await profileHubAccess(req, profileId);
  if (!access.canEdit) throw new ForbiddenError('Only the profile owner or an administrator can edit profile intelligence');
  return access;
}

function callerSafeProfile(profile, intelligence) {
  return {
    id: profile.id,
    name: profile.name,
    profileBadge: profile.profileBadge || 'SWE',
    profileStatus: profile.profileStatus || 'active',
    yearsOfExperience: profile.yearsOfExperience || '',
    location: [intelligence.city, intelligence.region, intelligence.countryCode].filter(Boolean).join(', ') || profile.location || '',
  };
}

function callerSafeIntelligence(intelligence) {
  return {
    ...intelligence,
    workAuthorization: '',
    postalCode: '',
    relocationPreference: '',
    coarseLatitude: null,
    coarseLongitude: null,
    regionalContextSources: [],
  };
}

function formatHubInterview(row) {
  return {
    id: row.id,
    jobBidId: row.jobBidId || null,
    title: row.title || '',
    company: row.company || '',
    location: row.location || '',
    status: row.status || 'interviewing',
    interviewStage: row.interviewStage || 'todo',
    interviewNextAt: row.interviewNextAt || null,
    updatedAt: row.updatedAt,
  };
}
