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
import { escapeHeaderValue } from './biddingApplicationsController.js';

export async function createProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const user = await currentDbUser(req);
    const attrs = profileAttributesFromBody(req.body, { canSetDailyBidGoal: isAdminRole(req.user) });
    const profile = await getBidProfileModel().create({
      ...attrs,
      userId: user.id,
      workspaceId: user.workspaceId ?? null,
      profileStatus: 'active',
    });
    res.status(201).json({ profile: formatProfile(profile) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const profile = await manageableProfile(req, req.params.id);
    await profile.update(profileAttributesFromBody(req.body, {
      canSetDailyBidGoal: isAdminRole(req.user),
      currentDailyBidGoal: profile.dailyBidGoal,
    }));
    res.json({ profile: formatProfile(profile) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function changeProfileOwner(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const profile = await manageableProfile(req, req.params.id);
    const owner = await profileOwnerFromBody(req.body, req.user);
    const ProfileShareRequest = getProfileShareRequestModel();

    await getSequelize().transaction(async (transaction) => {
      await ProfileShareRequest.destroy({
        where: {
          profileId: profile.id,
          recipientUserId: owner.id,
        },
        transaction,
      });
      await ProfileShareRequest.update(
        { ownerUserId: owner.id },
        {
          where: { profileId: profile.id },
          transaction,
        },
      );
      await profile.update({ userId: owner.id, workspaceId: owner.workspaceId ?? profile.workspaceId ?? null }, { transaction });
    });

    profile.setDataValue('user', owner);
    res.json({ profile: formatProfile(profile) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateProfileStatus(req, res, next) {
  try {
    await ensureWebModels();
    const attrs = profileStatusAttributesFromBody(req.body);
    const profile = await manageableProfile(req, req.params.id);
    if (!canUpdateProfileStatus(req, res, profile, attrs.profileStatus)) return;
    await profile.update(attrs);
    res.json({ profile: formatProfile(profile) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const profile = await manageableProfile(req, req.params.id);
    await getJobBidModel().destroy({ where: { profileId: profile.id } });
    await getProfileShareRequestModel().destroy({ where: { profileId: profile.id } });
    await deleteProfileHubRecords(profile.id);
    await profile.destroy();
    res.json({ ok: true });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function downloadProfileStaticResume(req, res, next) {
  try {
    await ensureWebModels();
    const profile = await accessibleProfile(req, req.params.id);
    if (!profile.isStatic || !profile.staticResumeData || !profile.staticResumeFilename) {
      res.status(404).json({ error: 'Static resume not found' });
      return;
    }

    const data = Buffer.isBuffer(profile.staticResumeData)
      ? profile.staticResumeData
      : Buffer.from(profile.staticResumeData);
    res.setHeader('content-type', profile.staticResumeContentType || 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${escapeHeaderValue(profile.staticResumeFilename)}"`);
    res.setHeader('content-length', String(data.length));
    res.send(data);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export function canManageProfiles(req, res) {
  if (!BIDDER_ROLES.includes(req.user?.role)) return true;
  res.status(403).json({ error: 'Bidders cannot add, edit, share, or remove profiles' });
  return false;
}

export function canUpdateProfileStatus(req, res, profile, status) {
  if (status === 'legacy' || isLegacyProfile(profile)) {
    if (isSuperadmin(req.user)) return true;
    res.status(403).json({ error: 'Only superadmins can mark or restore legacy profiles' });
    return false;
  }

  if (status === 'draft' || isDraftProfile(profile)) {
    if (PRIVILEGED_USER_ROLES.includes(req.user?.role)) return true;
    res.status(403).json({ error: 'Only user and admin roles can mark or restore draft profiles' });
    return false;
  }

  if (status === 'active') {
    if (isAdminRole(req.user)) return true;
    res.status(403).json({ error: 'Only admins can restore closed profiles' });
    return false;
  }

  if (PRIVILEGED_USER_ROLES.includes(req.user?.role)) return true;
  res.status(403).json({ error: 'Only user and admin roles can close profiles' });
  return false;
}

export async function profileOwnerFromBody(body = {}, currentUser = null) {
  const userId = clean(body.ownerUserId || body.userId);
  const username = clean(body.ownerUsername || body.username);
  if (!userId && !username) throw new InputError('Choose a new owner');

  const user = userId
    ? await getWebUserModel().findByPk(userId)
    : await repositories.findUserByUsernameCaseInsensitive(username);
  if (!user) throw new NotFoundError('User not found');
  if (!isSuperadmin(currentUser) && String(currentUser?.workspaceId ?? '') !== String(user.workspaceId ?? '')) {
    throw new NotFoundError('User not found');
  }
  if (!ADMIN_MANAGED_PROFILE_OWNER_ROLES.includes(user.role)) {
    throw new InputError('Choose a user or admin account to own this profile');
  }

  return user;
}

export async function manageableProfile(req, profileId) {
  if (isAdminRole(req.user)) return adminManagedProfile(req, profileId);
  return ownedProfile(req, profileId);
}

export async function adminManagedProfile(req, profileId) {
  if (!isAdminRole(req.user)) return ownedProfile(req, profileId);
  const id = clean(profileId);
  if (!id) throw new NotFoundError('Profile not found');
  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  if (!isProfileInUserWorkspace(profile, req.user)) {
    throw new NotFoundError('Profile not found');
  }
  return profile;
}
