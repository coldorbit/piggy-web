import { getBidProfileModel, getProfileShareRequestModel, getWebUserModel, repositories } from '../../db.js';
import { clean, parseJsonArray } from '../utils/index.js';
import { InputError, NotFoundError } from '../utils/errors.js';

export async function currentDbUser(req) {
  const user = await repositories.findUserByUsername(req.user.username);
  if (!user) throw new InputError('Current user is not available');
  return user;
}

export async function ownedProfile(req, profileId) {
  const user = await currentDbUser(req);
  const id = clean(profileId);
  if (!id) throw new InputError('Profile is required');
  const profile = await repositories.findProfileForUser({ id, userId: user.id });
  if (!profile) throw new NotFoundError('Profile not found');
  return profile;
}

export async function accessibleProfile(req, profileId) {
  const user = await currentDbUser(req);
  const id = clean(profileId);
  if (!id) throw new InputError('Profile is required');

  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  if (String(profile.userId) === String(user.id)) return profile;

  const share = await getProfileShareRequestModel().findOne({
    where: {
      profileId: profile.id,
      recipientUserId: user.id,
      status: 'accepted',
    },
  });
  if (!share) throw new NotFoundError('Profile not found');

  profile.setDataValue('shareStatus', 'accepted');
  return profile;
}

export function formatProfile(row) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    location: row.location,
    phone: row.phone,
    email: row.email,
    linkedin: row.linkedin,
    yearsOfExperience: row.yearsOfExperience,
    companies: row.companies || [],
    education: row.education || [],
    resumeText: row.resumeText,
    colorScheme: row.colorScheme,
    profileBadge: row.profileBadge || 'SWE',
    profileStatus: row.profileStatus || 'active',
    closedReason: row.closedReason || null,
    closedAt: row.closedAt || null,
    isShared: Boolean(row.get?.('shareStatus')),
    shareStatus: row.get?.('shareStatus') || null,
    sharedBy: row.get?.('sharedBy') || null,
    ownerUsername: row.user?.username || row.get?.('ownerUsername') || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function profilesManagedByUser(user) {
  const BidProfile = getBidProfileModel();
  const WebUser = getWebUserModel();

  if (user.role === 'admin') {
    return BidProfile.findAll({
      include: [{ model: WebUser, as: 'user', required: false }],
      order: [['createdAt', 'ASC']],
    });
  }

  return profilesVisibleToUser(user);
}

export async function profilesVisibleToUser(user) {
  const BidProfile = getBidProfileModel();
  const ProfileShareRequest = getProfileShareRequestModel();
  const WebUser = getWebUserModel();

  const [ownedProfiles, acceptedShares] = await Promise.all([
    BidProfile.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'ASC']],
    }),
    ProfileShareRequest.findAll({
      where: { recipientUserId: user.id, status: 'accepted' },
      include: [
        { model: BidProfile, as: 'profile', required: true },
        { model: WebUser, as: 'owner', required: true },
      ],
      order: [['updatedAt', 'ASC']],
    }),
  ]);

  for (const share of acceptedShares) {
    share.profile.setDataValue('shareStatus', 'accepted');
    share.profile.setDataValue('sharedBy', share.owner?.username || '');
  }

  return [...ownedProfiles, ...acceptedShares.map((share) => share.profile)];
}

export function profileAttributesFromBody(body) {
  const name = clean(body?.name);
  const colorScheme = clean(body?.colorScheme || 'green');
  const companies = parseJsonArray(body?.companies, 'Companies');
  const education = parseJsonArray(body?.education, 'Education');
  const profileBadge = profileBadgeFromBody(body?.profileBadge);
  const allowedColors = new Set(['green', 'blue', 'violet', 'amber', 'rose', 'slate']);

  if (!name) throw new InputError('Profile name is required');
  if (!allowedColors.has(colorScheme)) throw new InputError('Choose a valid profile color');

  return {
    name,
    location: clean(body?.location) || null,
    phone: clean(body?.phone) || null,
    email: clean(body?.email) || null,
    linkedin: clean(body?.linkedin) || null,
    yearsOfExperience: clean(body?.yearsOfExperience) || null,
    companies,
    education,
    resumeText: clean(body?.resumeText) || null,
    colorScheme,
    profileBadge,
  };
}

export function profileStatusAttributesFromBody(body) {
  const status = clean(body?.status || body?.profileStatus).toLowerCase();
  const reason = clean(body?.reason || body?.closedReason);

  if (!['active', 'closed'].includes(status)) throw new InputError('Profile status must be active or closed');
  if (status === 'closed' && !reason) throw new InputError('Closed profiles require a reason');

  return {
    profileStatus: status,
    closedReason: status === 'closed' ? reason : null,
    closedAt: status === 'closed' ? new Date() : null,
  };
}

function profileBadgeFromBody(value) {
  const profileBadge = clean(value || 'SWE').toUpperCase();
  const allowedBadges = new Set(['ML', 'DE', 'SWE']);

  if (!allowedBadges.has(profileBadge)) throw new InputError('Choose a valid profile badge');
  return profileBadge;
}
