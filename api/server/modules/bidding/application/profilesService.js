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
import {
  APPLIED_PROFILE_FILTER_ROLES,
  BIDDER_ROLES,
  PRIVILEGED_USER_ROLES,
  isAdminRole,
  isSuperadmin,
} from '../../../utils/roles.js';
import { dailyGoalRangeForUserBidFilter } from './biddingService.js';

const DAILY_BID_GOAL_STATUSES = ['submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost'];
const FORWARDING_ALIAS_LOCAL_PART = 'service';
const FORWARDING_ALIAS_DOMAIN = 'co-bounce.com';

export async function currentDbUser(req) {
  const user = await repositories.findUserByUsername(req.user.username);
  if (!user) throw new InputError('Current user is not available');
  return user;
}

export async function ownedProfile(req, profileId) {
  const user = await currentDbUser(req);
  const id = clean(profileId);
  if (!id) throw new InputError('Profile is required');
  const profile = await repositories.findProfileForUser({ id, userId: user.id, workspaceId: user.workspaceId ?? null });
  if (!profile) throw new NotFoundError('Profile not found');
  return profile;
}

export async function accessibleProfile(req, profileId) {
  const user = await currentDbUser(req);
  const id = clean(profileId);
  if (!id) throw new InputError('Profile is required');

  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  if (!isProfileInUserWorkspace(profile, user)) throw new NotFoundError('Profile not found');
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
  if (!isProfileInUserWorkspace(appliedProfile, user)) throw new NotFoundError('Profile not found');

  if (!APPLIED_PROFILE_FILTER_ROLES.includes(user.role)) return accessibleProfile(req, profileId);
  if ((appliedProfile.profileStatus || 'active') !== 'active') throw new NotFoundError('Profile not found');
  if (String(appliedProfile.workspaceId ?? '') !== String(profile.workspaceId ?? '')) throw new NotFoundError('Profile not found');
  if ((appliedProfile.profileBadge || 'SWE') !== (profile.profileBadge || 'SWE')) throw new NotFoundError('Profile not found');

  return appliedProfile;
}

export function isProfileInUserWorkspace(profile, user) {
  if (isSuperadmin(user)) return true;
  if (!profile) return false;
  return workspaceIdsForUser(user).some((workspaceId) => String(profile.workspaceId ?? '') === String(workspaceId ?? ''));
}

export function workspaceProfileWhereForUser(user) {
  if (isSuperadmin(user)) return undefined;
  const workspaceIds = workspaceIdsForUser(user);
  if (workspaceIds.length === 1) return { workspaceId: workspaceIds[0] ?? null };
  const nonNullWorkspaceIds = workspaceIds.filter((workspaceId) => workspaceId !== null && workspaceId !== undefined);
  const hasNullWorkspace = workspaceIds.some((workspaceId) => workspaceId === null || workspaceId === undefined);
  if (!nonNullWorkspaceIds.length) return { workspaceId: null };
  if (hasNullWorkspace) {
    return {
      [Op.or]: [
        { workspaceId: { [Op.in]: nonNullWorkspaceIds } },
        { workspaceId: null },
      ],
    };
  }
  return { workspaceId: { [Op.in]: nonNullWorkspaceIds } };
}

export function workspaceIdsForUser(user) {
  if (isSuperadmin(user)) return [];
  const ids = [user?.workspaceId ?? null];
  const memberships = user?.workspaceMemberships || user?.get?.('workspaceMemberships') || [];
  for (const membership of memberships) {
    if ((membership.status || 'active') !== 'active') continue;
    ids.push(membership.workspaceId ?? null);
  }
  const seen = new Set();
  return ids.filter((workspaceId) => {
    const key = String(workspaceId ?? '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function canUserAccessWorkspace(user, workspaceId) {
  if (isSuperadmin(user)) return true;
  return workspaceIdsForUser(user).some((candidateId) => String(candidateId ?? '') === String(workspaceId ?? ''));
}

export function formatProfile(row) {
  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId || null,
    name: row.name,
    location: row.location,
    phone: row.phone,
    email: row.email,
    forwardingEmail: row.forwardingEmail,
    linkedin: row.linkedin,
    yearsOfExperience: row.yearsOfExperience,
    resumeText: row.resumeText,
    resumeTemplate: row.resumeTemplate || 'classic',
    isStatic: Boolean(row.isStatic),
    hasStaticResume: Boolean(row.staticResumeData && row.staticResumeFilename),
    staticResumeFilename: row.staticResumeFilename || null,
    staticResumeContentType: row.staticResumeContentType || null,
    staticResumeUploadedAt: row.staticResumeUploadedAt || null,
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

export function isDraftProfile(profile) {
  return (profile?.profileStatus || 'active') === 'draft';
}

export function sortProfilesForDisplay(profiles) {
  return [...profiles].sort(compareProfilesForDisplay);
}

export async function profilesWithProgress(profiles, { user, dailyGoalFilters, dailyGoalRange } = {}) {
  const profileIds = [...new Set(profiles.map((profile) => String(profile.id)).filter(Boolean))];
  if (!profileIds.length) return profiles;
  const isCaller = user?.role === 'caller';
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

  const [bidRows, tailoredRows, interviewRows, dailyContributorRows] = await Promise.all([
    getJobBidModel().findAll({
      attributes: [
        'profileId',
        [getSequelize().fn('COUNT', getSequelize().col('id')), 'bids'],
        [
          getSequelize().fn(
            'SUM',
            getSequelize().literal("CASE WHEN status IN ('planned', 'queued', 'tailoring', 'ready') THEN 1 ELSE 0 END"),
          ),
          'planned',
        ],
        [
          getSequelize().fn(
            'SUM',
            getSequelize().literal("CASE WHEN status IN ('submitted', 'needs_follow_up', 'stale', 'blocked', 'won', 'lost') THEN 1 ELSE 0 END"),
          ),
          'done',
        ],
      ],
      where: { profileId: profileIds, ...(isCaller ? { callerUserId: user.id } : {}) },
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
    getJobBidModel().findAll({
      attributes: ['profileId', 'userId'],
      where: {
        profileId: profileIds,
        status: { [Op.in]: DAILY_BID_GOAL_STATUSES },
        ...(isCaller ? { callerUserId: user.id } : {}),
      },
      group: ['profileId', 'userId'],
      raw: true,
    }),
  ]);

  for (const row of dailyContributorRows) {
    const userIds = profileUserIdsByProfileId.get(String(row.profileId));
    if (userIds && row.userId) userIds.add(String(row.userId));
  }

  const goalUserIds = [...new Set([...profileUserIdsByProfileId.values()].flatMap((userIds) => [...userIds]))];
  const goalUserRows = goalUserIds.length
    ? await getWebUserModel().findAll({
        attributes: ['id', 'username', 'role', 'dailyBidGoal', 'timezone'],
        where: { id: goalUserIds },
        raw: true,
      })
    : [];
  const goalUserById = new Map(goalUserRows.map((row) => [String(row.id), row]));
  const dailyGoalRangeByUserId = dailyGoalRangesByUserId(goalUserRows, dailyGoalFilters, dailyGoalRange, user);
  const dailyBidRows = await dailyBidRowsForGoalRanges({
    profileIds,
    rangeByUserId: dailyGoalRangeByUserId,
    user,
  });

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
        dailyGoalTimezone: user?.timezone || '',
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
    const count = Number(row.dailyFinished || 0);
    const goalUser = goalUserById.get(String(row.userId));
    if (!isDailyGoalUserRole(goalUser?.role)) continue;
    progress.dailyUsers.push({
      userId: row.userId,
      username: goalUser?.username || `User ${row.userId}`,
      role: goalUser?.role || '',
      timezone: goalUser?.timezone || '',
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
      const dailyGoal = Number(profile.dailyBidGoal || 0);
      progress.dailyGoals = [...(profileUserIdsByProfileId.get(String(profile.id)) || [])]
        .map((userId) => {
          const goalUser = goalUserById.get(String(userId));
          if (!isDailyGoalUserRole(goalUser?.role)) return null;
          return {
            userId: goalUser?.id || userId,
            username: goalUser?.username || `User ${userId}`,
            role: goalUser?.role || '',
            timezone: goalUser?.timezone || '',
            goal: Number(goalUser?.dailyBidGoal || 0),
            finished: progress.dailyUsers
              .filter((row) => String(row.userId) === String(userId))
              .reduce((sum, row) => sum + Number(row.finished || 0), 0),
          };
        })
        .filter(Boolean)
        .filter((goal) => goal.goal > 0 || goal.finished > 0)
        .sort(compareDailyGoalProgress);
      progress.dailyGoal = dailyGoal || null;
      progress.dailyFinished = progress.dailyGoals.reduce((sum, goal) => sum + Number(goal.finished || 0), 0);
      progress.dailyUsers = progress.dailyGoals
        .filter((goal) => Number(goal.finished || 0) > 0)
        .map((goal) => ({
          userId: goal.userId,
          username: goal.username,
          role: goal.role,
          timezone: goal.timezone,
          finished: goal.finished,
        }));
    }
    profile.setDataValue('progress', progress);
  }

  return profiles;
}

function dailyGoalRangesByUserId(users, filters, fallbackRange, viewerUser) {
  const ranges = new Map();
  const viewerRange = filters ? dailyGoalRangeForUserBidFilter(filters, viewerUser) : fallbackRange || dailyGoalRangeForUserBidFilter({}, viewerUser);
  for (const goalUser of users) {
    if (!isDailyGoalUserRole(goalUser?.role)) continue;
    ranges.set(String(goalUser.id), viewerRange);
  }
  return ranges;
}

async function dailyBidRowsForGoalRanges({ profileIds, rangeByUserId, user }) {
  const userIds = [...rangeByUserId.keys()];
  const range = unionDateRange([...rangeByUserId.values()]);
  if (!profileIds.length || !userIds.length || !range) return [];

  const rows = await getJobBidModel().findAll({
    attributes: ['profileId', 'userId', 'bidAt'],
    where: {
      profileId: profileIds,
      userId: userIds,
      status: { [Op.in]: DAILY_BID_GOAL_STATUSES },
      bidAt: { [Op.gte]: range.from, [Op.lt]: range.to },
      ...(user?.role === 'caller' ? { callerUserId: user.id } : {}),
    },
    raw: true,
  });

  const counts = new Map();
  for (const row of rows) {
    const userRange = rangeByUserId.get(String(row.userId));
    if (!isDateInRange(row.bidAt, userRange)) continue;
    const key = `${row.profileId}:${row.userId}`;
    const current = counts.get(key) || { profileId: row.profileId, userId: row.userId, dailyFinished: 0 };
    current.dailyFinished += 1;
    counts.set(key, current);
  }
  return [...counts.values()];
}

function unionDateRange(ranges) {
  let from = null;
  let to = null;
  for (const range of ranges) {
    if (!range?.from || !range?.to) continue;
    if (!from || range.from < from) from = range.from;
    if (!to || range.to > to) to = range.to;
  }
  return from && to ? { from, to } : null;
}

function isDateInRange(value, range) {
  if (!range?.from || !range?.to) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.from && date < range.to;
}

function compareDailyGoalProgress(left, right) {
  const roleDelta = dailyGoalRoleWeight(left.role) - dailyGoalRoleWeight(right.role);
  if (roleDelta) return roleDelta;
  return String(left.username || '').localeCompare(String(right.username || ''));
}

function dailyGoalRoleWeight(role) {
  if (BIDDER_ROLES.includes(role)) return 0;
  if (role === 'user') return 1;
  if (PRIVILEGED_USER_ROLES.includes(role)) return 2;
  return 3;
}

function isDailyGoalUserRole(role) {
  return PRIVILEGED_USER_ROLES.includes(role) || BIDDER_ROLES.includes(role);
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
      where: workspaceProfileWhereForUser(user),
      include: [{ model: WebUser, as: 'user', required: false }],
      order: [['createdAt', 'ASC']],
    });
  }

  return profilesVisibleToUser(user);
}

export async function profilesForAppliedFilter(user, { profileBadge, workspaceId } = {}) {
  if (!APPLIED_PROFILE_FILTER_ROLES.includes(user?.role)) return [];
  const BidProfile = getBidProfileModel();
  const WebUser = getWebUserModel();

  return BidProfile.findAll({
    where: appliedFilterProfileWhere({ profileBadge, workspaceId: workspaceId ?? user.workspaceId ?? null }),
    include: [
      {
        model: WebUser,
        as: 'user',
        required: true,
      },
    ],
    order: [
      ['profileBadge', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}

export function appliedFilterProfileWhere(options = {}) {
  const { profileBadge, workspaceId } = options;
  const where = { profileStatus: 'active' };
  if (hasWorkspaceId(options)) {
    where.workspaceId = workspaceId ?? null;
  }
  const badge = clean(profileBadge).toUpperCase();
  if (badge) where.profileBadge = badge;
  return where;
}

function hasWorkspaceId(value) {
  return Object.prototype.hasOwnProperty.call(value || {}, 'workspaceId');
}

export async function profilesVisibleToUser(user) {
  const BidProfile = getBidProfileModel();
  const Interview = getInterviewModel();
  const ProfileShareRequest = getProfileShareRequestModel();
  const WebUser = getWebUserModel();
  const workspaceWhere = workspaceProfileWhereForUser(user);
  const workspaceScope = workspaceWhere || {};

  if (user.role === 'caller') {
    const assignments = await Interview.findAll({
      where: { callerUserId: user.id },
      include: [{ model: BidProfile, as: 'profile', required: true, where: workspaceWhere }],
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
      where: { userId: user.id, ...workspaceScope },
      order: [['createdAt', 'ASC']],
    }),
    ProfileShareRequest.findAll({
      where: { recipientUserId: user.id, status: 'accepted' },
      include: [
        { model: BidProfile, as: 'profile', required: true, where: workspaceWhere },
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
const MAX_STATIC_RESUME_BYTES = 8 * 1024 * 1024;
const ALLOWED_PROFILE_COLORS = new Set(['green', 'blue', 'violet', 'amber', 'rose', 'slate', 'teal', 'cyan', 'pink', 'indigo', 'lime', 'orange']);

export function profileAttributesFromBody(body, { canSetDailyBidGoal = false, currentDailyBidGoal = DEFAULT_PROFILE_DAILY_BID_GOAL } = {}) {
  const name = clean(body?.name);
  const colorScheme = clean(body?.colorScheme || 'green');
  const profileBadge = profileBadgeFromBody(body?.profileBadge);
  const resumeTemplate = clean(body?.resumeTemplate || 'classic');
  const isStatic = booleanFromBody(body?.isStatic || body?.staticProfile);
  const staticResume = staticResumeFromBody(body);
  const allowedResumeTemplates = new Set(['classic', 'compact', 'modern']);

  if (!name) throw new InputError('Profile name is required');
  if (!ALLOWED_PROFILE_COLORS.has(colorScheme)) throw new InputError('Choose a valid profile color');
  if (!allowedResumeTemplates.has(resumeTemplate)) throw new InputError('Choose a valid resume template');
  if (staticResume && !isStatic) throw new InputError('Mark the profile as static before uploading a static resume');
  const dailyBidGoal = canSetDailyBidGoal
    ? dailyBidGoalFromBody(body?.dailyBidGoal)
    : Number(currentDailyBidGoal ?? DEFAULT_PROFILE_DAILY_BID_GOAL);

  const attrs = {
    name,
    location: clean(body?.location) || null,
    phone: clean(body?.phone) || null,
    email: clean(body?.email) || null,
    forwardingEmail: clean(body?.forwardingEmail) || forwardingAliasForProfileName(name),
    linkedin: clean(body?.linkedin) || null,
    yearsOfExperience: clean(body?.yearsOfExperience) || null,
    resumeText: clean(body?.resumeText) || null,
    resumeTemplate,
    isStatic,
    colorScheme,
    profileBadge,
    dailyBidGoal,
  };
  if (staticResume) {
    attrs.staticResumeData = staticResume.data;
    attrs.staticResumeFilename = staticResume.filename;
    attrs.staticResumeContentType = staticResume.contentType;
    attrs.staticResumeUploadedAt = new Date();
  }
  return attrs;
}

export function forwardingAliasForProfileName(name) {
  const firstName = clean(name).split(/\s+/)[0] || '';
  const tag = firstName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

  return tag ? `${FORWARDING_ALIAS_LOCAL_PART}+${tag}@${FORWARDING_ALIAS_DOMAIN}` : null;
}

export function profileStatusAttributesFromBody(body) {
  const status = clean(body?.status || body?.profileStatus).toLowerCase();
  const reason = clean(body?.reason || body?.closedReason);

  if (!['active', 'closed', 'draft', 'legacy'].includes(status)) throw new InputError('Profile status must be active, closed, draft, or legacy');
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
  if (isLegacyProfile(profile)) return 2;
  if (isDraftProfile(profile)) return 1;
  return 0;
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

function booleanFromBody(value) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  return false;
}

function staticResumeFromBody(body = {}) {
  const upload = body.staticResumeUpload || body.staticResume || null;
  if (!upload || typeof upload !== 'object' || Array.isArray(upload)) return null;
  const filename = clean(upload.filename || upload.name);
  const contentType = clean(upload.contentType || upload.type) || 'application/octet-stream';
  const rawBase64 = clean(upload.dataBase64 || upload.base64 || upload.data);
  const dataBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '');

  if (!filename) throw new InputError('Static resume filename is required');
  if (!dataBase64) throw new InputError('Static resume file is required');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) throw new InputError('Static resume file is invalid');

  const data = Buffer.from(dataBase64, 'base64');
  if (!data.length) throw new InputError('Static resume file is empty');
  if (data.length > MAX_STATIC_RESUME_BYTES) throw new InputError('Static resume file must be 8 MB or smaller');

  return { data, filename: filenameFromUpload(filename), contentType };
}

function filenameFromUpload(value) {
  return clean(value).replace(/[\\/]+/g, '-').replace(/[^\w.\- ()]+/g, '').trim() || 'static-resume';
}
