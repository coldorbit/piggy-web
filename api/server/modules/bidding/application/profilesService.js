import {
  getBidProfileModel,
  getInterviewModel,
  getJobBidModel,
  getProfileShareRequestModel,
  getSequelize,
  getTailoredResumeModel,
  getWebUserModel,
  repositories,
} from '../../../../db.js';
import { Op } from 'sequelize';
import { clean } from '../../../utils/index.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';
import { addBusinessDays, businessDayStart } from '../../../utils/businessTime.js';
import {
  ADMIN_MANAGED_PROFILE_OWNER_ROLES,
  APPLIED_FILTER_BIDDER_PROFILE_VIEWER_ROLES,
  BIDDER_ROLES,
  PRIVILEGED_USER_ROLES,
  isAdminRole,
} from '../../../utils/roles.js';

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
  if (isAdminRole(user)) return profile;
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

export async function accessibleAppliedProfile(req, profileId, activeProfileId) {
  const user = await currentDbUser(req);
  const profile = await accessibleProfile(req, activeProfileId);
  const appliedProfile = await getBidProfileModel().findByPk(clean(profileId), {
    include: [{ model: getWebUserModel(), as: 'user', required: false }],
  });
  if (!appliedProfile) throw new NotFoundError('Profile not found');

  if (!PRIVILEGED_USER_ROLES.includes(user.role)) return accessibleProfile(req, profileId);
  if ((appliedProfile.profileStatus || 'active') !== 'active') throw new NotFoundError('Profile not found');
  if ((appliedProfile.profileBadge || 'SWE') !== (profile.profileBadge || 'SWE')) throw new NotFoundError('Profile not found');
  if (!appliedFilterOwnerRoles(user).includes(appliedProfile.user?.role)) throw new NotFoundError('Profile not found');

  return appliedProfile;
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
    resumeTemplate: row.resumeTemplate || 'classic',
    colorScheme: row.colorScheme,
    profileBadge: row.profileBadge || 'SWE',
    profileStatus: row.profileStatus || 'active',
    dailyBidGoal: row.dailyBidGoal ?? null,
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
      dailyGoal: null,
      dailyFinished: 0,
      dailyGoals: [],
      dailyUsers: [],
      totalInterviews: 0,
      activeInterviews: 0,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function isLegacyProfile(profile) {
  return (profile?.profileStatus || 'active') === 'legacy';
}

export function sortProfilesForDisplay(profiles) {
  return [...profiles].sort(compareProfilesForDisplay);
}

export async function profilesWithProgress(profiles, { user } = {}) {
  const profileIds = [...new Set(profiles.map((profile) => String(profile.id)).filter(Boolean))];
  if (!profileIds.length) return profiles;
  const isCaller = user?.role === 'caller';
  const today = businessDayStart(new Date());
  const tomorrow = addBusinessDays(today, 1);
  const profileUserIdsByProfileId = new Map(
    profiles.map((profile) => [String(profile.id), new Set([String(profile.userId)].filter(Boolean))]),
  );
  const acceptedShares = await getProfileShareRequestModel().findAll({
    where: { profileId: profileIds, status: 'accepted' },
    include: [{ model: getWebUserModel(), as: 'recipient', required: true }],
  });

  for (const share of acceptedShares) {
    const userIds = profileUserIdsByProfileId.get(String(share.profileId));
    if (userIds && share.recipientUserId) userIds.add(String(share.recipientUserId));
  }
  const goalUserIds = [...new Set([...profileUserIdsByProfileId.values()].flatMap((userIds) => [...userIds]))];

  const [bidRows, dailyBidRows, tailoredRows, interviewRows, goalUserRows] = await Promise.all([
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
            getSequelize().literal("CASE WHEN status IN ('submitted', 'interviewing', 'won', 'lost', 'mismatching_bid', 'spam_job') THEN 1 ELSE 0 END"),
          ),
          'done',
        ],
      ],
      where: { profileId: profileIds, ...(isCaller ? { callerUserId: user.id } : {}) },
      group: ['profileId'],
      raw: true,
    }),
    getJobBidModel().findAll({
      attributes: [
        'profileId',
        'userId',
        [getSequelize().fn('COUNT', getSequelize().col('id')), 'dailyFinished'],
      ],
      where: {
        profileId: profileIds,
        status: { [Op.in]: ['submitted', 'interviewing', 'won', 'lost'] },
        bidAt: { [Op.gte]: today, [Op.lt]: tomorrow },
        ...(isCaller ? { callerUserId: user.id } : {}),
      },
      group: ['profileId', 'userId'],
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
    getInterviewModel().findAll({
      attributes: [
        'profileId',
        [getSequelize().fn('COUNT', getSequelize().col('id')), 'totalInterviews'],
        [
          getSequelize().fn(
            'SUM',
            getSequelize().literal("CASE WHEN status = 'interviewing' THEN 1 ELSE 0 END"),
          ),
          'activeInterviews',
        ],
      ],
      where: { profileId: profileIds, ...(isCaller ? { callerUserId: user.id } : {}) },
      group: ['profileId'],
      raw: true,
    }),
    getWebUserModel().findAll({
      attributes: ['id', 'username', 'role', 'dailyBidGoal'],
      where: { id: goalUserIds },
      raw: true,
    }),
  ]);
  const goalUserById = new Map(goalUserRows.map((row) => [String(row.id), row]));
  const dailyFinishedByProfileId = new Map();

  const progressByProfileId = new Map(
    profileIds.map((profileId) => [
      profileId,
      {
        tailored: 0,
        bids: 0,
        planned: 0,
        done: 0,
        dailyGoal: null,
        dailyFinished: 0,
        dailyGoals: [],
        dailyUsers: [],
        totalInterviews: 0,
        activeInterviews: 0,
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

  for (const row of dailyBidRows) {
    const progress = progressByProfileId.get(String(row.profileId));
    if (!progress) continue;
    const profileId = String(row.profileId);
    const count = Number(row.dailyFinished || 0);
    dailyFinishedByProfileId.set(profileId, (dailyFinishedByProfileId.get(profileId) || 0) + count);
    const goalUser = goalUserById.get(String(row.userId));
    progress.dailyUsers.push({
      userId: row.userId,
      username: goalUser?.username || `User ${row.userId}`,
      role: goalUser?.role || '',
      finished: count,
    });
  }

  for (const row of tailoredRows) {
    const progress = progressByProfileId.get(String(row.profileId));
    if (!progress) continue;
    progress.tailored = Number(row.tailored || 0);
  }

  for (const row of interviewRows) {
    const progress = progressByProfileId.get(String(row.profileId));
    if (!progress) continue;
    progress.totalInterviews = Number(row.totalInterviews || 0);
    progress.activeInterviews = Number(row.activeInterviews || 0);
  }

  for (const profile of profiles) {
    const progress = progressByProfileId.get(String(profile.id));
    if (progress) {
      const dailyFinished = dailyFinishedByProfileId.get(String(profile.id)) || 0;
      const dailyGoal = Number(profile.dailyBidGoal || 0);
      progress.dailyGoal = dailyGoal || null;
      progress.dailyGoals = [...(profileUserIdsByProfileId.get(String(profile.id)) || [])]
        .map((userId) => {
          const goalUser = goalUserById.get(String(userId));
          return {
            userId: goalUser?.id || userId,
            username: goalUser?.username || `User ${userId}`,
            role: goalUser?.role || '',
            goal: dailyGoal || Number(goalUser?.dailyBidGoal || 0),
            finished: progress.dailyUsers
              .filter((row) => String(row.userId) === String(userId))
              .reduce((sum, row) => sum + Number(row.finished || 0), 0),
          };
        })
        .filter((goal) => goal.goal > 0 || goal.finished > 0)
        .sort(compareDailyGoalProgress);
      progress.dailyFinished = dailyFinished;
      progress.dailyUsers = progress.dailyUsers.sort(compareDailyGoalProgress);
    }
    profile.setDataValue('progress', progress);
  }

  return profiles;
}

function compareDailyGoalProgress(left, right) {
  const roleDelta = dailyGoalRoleWeight(left.role) - dailyGoalRoleWeight(right.role);
  if (roleDelta) return roleDelta;
  return String(left.username || '').localeCompare(String(right.username || ''));
}

function dailyGoalRoleWeight(role) {
  if (BIDDER_ROLES.includes(role)) return 0;
  if (role === 'user') return 1;
  return 2;
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

  if (isAdminRole(user)) {
    return BidProfile.findAll({
      include: [{ model: WebUser, as: 'user', required: false }],
      order: [['createdAt', 'ASC']],
    });
  }

  return profilesVisibleToUser(user);
}

export async function profilesForAppliedFilter(user) {
  if (!PRIVILEGED_USER_ROLES.includes(user?.role)) return [];
  const BidProfile = getBidProfileModel();
  const WebUser = getWebUserModel();

  return BidProfile.findAll({
    where: { profileStatus: 'active' },
    include: [
      {
        model: WebUser,
        as: 'user',
        required: true,
        where: { role: appliedFilterOwnerRoles(user) },
      },
    ],
    order: [
      ['profileBadge', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}

export function appliedFilterOwnerRoles(user) {
  const managedRoles = isAdminRole(user) ? ADMIN_MANAGED_PROFILE_OWNER_ROLES : ['user'];
  if (!APPLIED_FILTER_BIDDER_PROFILE_VIEWER_ROLES.includes(user?.role)) return managedRoles;
  return [...new Set([...managedRoles, ...BIDDER_ROLES])];
}

export async function profilesVisibleToUser(user) {
  const BidProfile = getBidProfileModel();
  const Interview = getInterviewModel();
  const ProfileShareRequest = getProfileShareRequestModel();
  const WebUser = getWebUserModel();

  if (user.role === 'caller') {
    const assignments = await Interview.findAll({
      where: { callerUserId: user.id },
      include: [{ model: BidProfile, as: 'profile', required: true }],
      order: [['updatedAt', 'DESC']],
    });
    const profilesById = new Map();
    for (const assignment of assignments) {
      if (!assignment.profile) continue;
      assignment.profile.setDataValue('shareStatus', 'caller');
      profilesById.set(String(assignment.profile.id), assignment.profile);
    }
    return [...profilesById.values()];
  }

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

const DEFAULT_PROFILE_DAILY_BID_GOAL = 60;

export function profileAttributesFromBody(body, { canSetDailyBidGoal = false, currentDailyBidGoal = DEFAULT_PROFILE_DAILY_BID_GOAL } = {}) {
  const name = clean(body?.name);
  const colorScheme = clean(body?.colorScheme || 'green');
  const profileBadge = profileBadgeFromBody(body?.profileBadge);
  const resumeTemplate = clean(body?.resumeTemplate || 'classic');
  const allowedColors = new Set(['green', 'blue', 'violet', 'amber', 'rose', 'slate']);
  const allowedResumeTemplates = new Set(['classic', 'compact', 'modern']);

  if (!name) throw new InputError('Profile name is required');
  if (!allowedColors.has(colorScheme)) throw new InputError('Choose a valid profile color');
  if (!allowedResumeTemplates.has(resumeTemplate)) throw new InputError('Choose a valid resume template');
  const dailyBidGoal = canSetDailyBidGoal
    ? dailyBidGoalFromBody(body?.dailyBidGoal)
    : Number(currentDailyBidGoal ?? DEFAULT_PROFILE_DAILY_BID_GOAL);

  return {
    name,
    location: clean(body?.location) || null,
    phone: clean(body?.phone) || null,
    email: clean(body?.email) || null,
    linkedin: clean(body?.linkedin) || null,
    yearsOfExperience: clean(body?.yearsOfExperience) || null,
    resumeText: clean(body?.resumeText) || null,
    resumeTemplate,
    colorScheme,
    profileBadge,
    dailyBidGoal,
  };
}

export function profileStatusAttributesFromBody(body) {
  const status = clean(body?.status || body?.profileStatus).toLowerCase();
  const reason = clean(body?.reason || body?.closedReason);

  if (!['active', 'closed', 'legacy'].includes(status)) throw new InputError('Profile status must be active, closed, or legacy');
  if (status === 'closed' && !reason) throw new InputError('Closed profiles require a reason');

  return {
    profileStatus: status,
    closedReason: status === 'closed' ? reason : null,
    closedAt: status === 'closed' ? new Date() : null,
  };
}

function compareProfilesForDisplay(left, right) {
  const statusDelta = profileStatusWeight(left) - profileStatusWeight(right);
  if (statusDelta) return statusDelta;
  const leftCreatedAt = Date.parse(left.createdAt || 0) || 0;
  const rightCreatedAt = Date.parse(right.createdAt || 0) || 0;
  return leftCreatedAt - rightCreatedAt || String(left.name || '').localeCompare(String(right.name || ''));
}

function profileStatusWeight(profile) {
  return isLegacyProfile(profile) ? 1 : 0;
}

function profileBadgeFromBody(value) {
  const profileBadge = clean(value || 'SWE').toUpperCase();
  const allowedBadges = new Set(['ML', 'DE', 'SWE']);

  if (!allowedBadges.has(profileBadge)) throw new InputError('Choose a valid profile badge');
  return profileBadge;
}

function dailyBidGoalFromBody(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_PROFILE_DAILY_BID_GOAL;
  const goal = Number(value);
  if (!Number.isInteger(goal) || goal < 0 || goal > 10000) {
    throw new InputError('Daily bid goal must be a whole number between 0 and 10000');
  }
  return goal;
}
