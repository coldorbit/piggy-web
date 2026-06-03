import {
  getBidProfileModel,
  getJobBidModel,
  getProfileShareRequestModel,
  getSequelize,
  getTailoredResumeModel,
  getWebUserModel,
  repositories,
} from '../../db.js';
import { clean } from '../utils/index.js';
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
  if (user.role === 'admin') return profile;
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
    resumeText: row.resumeText,
    colorScheme: row.colorScheme,
    profileBadge: row.profileBadge || 'SWE',
    profileStatus: row.profileStatus || 'active',
    closedReason: row.closedReason || null,
    closedAt: row.closedAt || null,
    isShared: Boolean(row.get?.('shareStatus')),
    shareStatus: row.get?.('shareStatus') || null,
    sharedBy: row.get?.('sharedBy') || null,
    sharedWith: row.get?.('sharedWith') || [],
    ownerUsername: row.user?.username || row.get?.('ownerUsername') || null,
    progress: row.get?.('progress') || {
      tailored: 0,
      bids: 0,
      planned: 0,
      done: 0,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function profilesWithProgress(profiles) {
  const profileIds = [...new Set(profiles.map((profile) => String(profile.id)).filter(Boolean))];
  if (!profileIds.length) return profiles;

  const [bidRows, tailoredRows] = await Promise.all([
    getJobBidModel().findAll({
      attributes: [
        'profileId',
        [getSequelize().fn('COUNT', getSequelize().col('id')), 'bids'],
        [
          getSequelize().fn(
            'SUM',
            getSequelize().literal("CASE WHEN status = 'planned' THEN 1 ELSE 0 END"),
          ),
          'planned',
        ],
        [
          getSequelize().fn(
            'SUM',
            getSequelize().literal("CASE WHEN status IN ('submitted', 'interviewing', 'won', 'lost') THEN 1 ELSE 0 END"),
          ),
          'done',
        ],
      ],
      where: { profileId: profileIds },
      group: ['profileId'],
      raw: true,
    }),
    getTailoredResumeModel().findAll({
      attributes: [
        'profileId',
        [getSequelize().fn('COUNT', getSequelize().fn('DISTINCT', getSequelize().col('job_url'))), 'tailored'],
      ],
      where: {
        profileId: profileIds,
        status: ['requested', 'processing', 'ready', 'dead_letter'],
      },
      group: ['profileId'],
      raw: true,
    }),
  ]);

  const progressByProfileId = new Map(
    profileIds.map((profileId) => [
      profileId,
      {
        tailored: 0,
        bids: 0,
        planned: 0,
        done: 0,
      },
    ]),
  );

  for (const row of bidRows) {
    const progress = progressByProfileId.get(String(row.profileId));
    if (!progress) continue;
    progress.bids = Number(row.bids || 0);
    progress.planned = Number(row.planned || 0);
    progress.done = Number(row.done || 0);
  }

  for (const row of tailoredRows) {
    const progress = progressByProfileId.get(String(row.profileId));
    if (!progress) continue;
    progress.tailored = Number(row.tailored || 0);
  }

  for (const profile of profiles) {
    profile.setDataValue('progress', progressByProfileId.get(String(profile.id)));
  }

  return profiles;
}

export async function profilesWithSharing(profiles) {
  const profileIds = [
    ...new Set(
      profiles
        .filter((profile) => !profile.get?.('shareStatus'))
        .map((profile) => String(profile.id))
        .filter(Boolean),
    ),
  ];
  if (!profileIds.length) return profiles;

  const shares = await getProfileShareRequestModel().findAll({
    where: { profileId: profileIds, status: ['accepted', 'pending'] },
    include: [{ model: getWebUserModel(), as: 'recipient', required: true }],
    order: [['createdAt', 'ASC']],
  });
  const sharesByProfileId = new Map(profileIds.map((profileId) => [profileId, []]));

  for (const share of shares) {
    const profileShares = sharesByProfileId.get(String(share.profileId));
    if (!profileShares) continue;
    profileShares.push({
      id: share.id,
      userId: share.recipientUserId,
      username: share.recipient?.username || '',
      status: share.status,
    });
  }

  for (const profile of profiles) {
    profile.setDataValue('sharedWith', sharesByProfileId.get(String(profile.id)) || []);
  }

  return profiles;
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
