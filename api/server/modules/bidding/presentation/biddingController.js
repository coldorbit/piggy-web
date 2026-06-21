import {
  ensureWebModels,
  getBidProfileModel,
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
import { buildJobQuery, formatJob, jobDateFiltersForUser, normalizeJobSource } from '../../jobs/application/jobsService.js';
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
} from '../application/profilesService.js';
import { enqueueTailoredResumeRequest } from '../application/tailoringQueueService.js';
import { userAttributesFromBody } from '../../admin/application/usersService.js';
import { clean } from '../../../utils/index.js';
import { handleInputError, handleUserWriteError, InputError, NotFoundError } from '../../../utils/errors.js';
import {
  BIDDER_ROLES,
  INTERNAL_DATA_ROLES,
  INTERVIEW_ACCESS_ROLES,
  PRIVILEGED_USER_ROLES,
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

export async function listProfiles(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const scope = clean(req.query?.scope);
    const query = jobDateFiltersForUser(req.query, user);
    const profiles =
      scope === 'applied-filter'
        ? await profilesForAppliedFilter(user)
        : scope === 'manage' && isAdminRole(user)
        ? await profilesManagedByUser(user)
        : await profilesVisibleToUser(user);
    const visibleProfiles = sortProfilesForDisplay(await profilesWithSharing(await profilesWithProgress(profiles, { user, dailyGoalFilters: query })));
    res.json({ profiles: visibleProfiles.map(formatProfile) });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'This profile already has a bid for this job' });
      return;
    }
    handleInputError(error, res, next);
  }
}

export async function listProfileShareRequests(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const ProfileShareRequest = getProfileShareRequestModel();
    const BidProfile = getBidProfileModel();
    const WebUser = getWebUserModel();

    const [incoming, outgoing] = await Promise.all([
      ProfileShareRequest.findAll({
        where: { recipientUserId: user.id, status: 'pending' },
        include: [
          { model: BidProfile, as: 'profile', required: true },
          { model: WebUser, as: 'owner', required: true },
        ],
        order: [['createdAt', 'DESC']],
      }),
      ProfileShareRequest.findAll({
        where: { ownerUserId: user.id },
        include: [
          { model: BidProfile, as: 'profile', required: true },
          { model: WebUser, as: 'recipient', required: true },
        ],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    res.json({
      incoming: incoming.map(formatProfileShareRequest),
      outgoing: outgoing.map(formatProfileShareRequest),
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'This profile already has a bid for this job' });
      return;
    }
    handleInputError(error, res, next);
  }
}

export async function listProfileShareRecipients(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const users = await repositories.listUsers();
    res.json({
      users: users
        .filter((row) => String(row.id) !== String(user.id))
        .map((row) => ({
          id: row.id,
          username: row.username,
          role: row.role,
        })),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listCallers(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireCallerManagementUser(user, res);
    if (res.headersSent) return;
    const WebUser = getWebUserModel();
    const Interview = getInterviewModel();
    const ScrapedJob = getScrapedJobModel();
    const BidProfile = getBidProfileModel();
    const callers = await WebUser.findAll({
      where: { role: 'caller' },
      order: [['username', 'ASC']],
    });
    const callerIds = callers.map((caller) => caller.id);
    const assignments = callerIds.length
      ? await Interview.findAll({
          where: {
            callerUserId: { [Op.in]: callerIds },
            status: 'interviewing',
          },
          include: [
            { model: ScrapedJob, as: 'job', required: false },
            { model: BidProfile, as: 'profile', required: true },
          ],
          order: [
            ['callerUserId', 'ASC'],
            ['interviewNextAt', 'ASC'],
            ['updatedAt', 'DESC'],
          ],
        })
      : [];

    const assignmentsByCallerId = new Map(callerIds.map((callerId) => [String(callerId), []]));
    for (const assignment of assignments) {
      const callerAssignments = assignmentsByCallerId.get(String(assignment.callerUserId));
      if (!callerAssignments) continue;
      callerAssignments.push(formatCallerAssignment(assignment));
    }

    res.json({
      callers: callers.map((caller) => {
        const callerAssignments = assignmentsByCallerId.get(String(caller.id)) || [];
        return {
          id: caller.id,
          username: caller.username,
          role: caller.role,
          activeInterviews: callerAssignments.length,
          upcomingInterviews: callerAssignments.filter((assignment) => Boolean(assignment.interviewNextAt)).length,
          assignments: callerAssignments,
        };
      }),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createCaller(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireCallerManagementUser(user, res);
    if (res.headersSent) return;
    const attrs = userAttributesFromBody({ ...req.body, role: 'caller' }, { requirePassword: true });
    const caller = await repositories.createUser({
      username: attrs.username,
      email: attrs.email,
      passwordHash: hashPassword(attrs.password),
      role: 'caller',
      timezone: attrs.timezone,
    });
    res.status(201).json({ caller: publicUser(caller) });
  } catch (error) {
    handleUserWriteError(error, res, next);
  }
}

export async function listBidders(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const sequelize = getSequelize();
    const [bidderRows] = await sequelize.query(`
      SELECT DISTINCT web_users.id, web_users.username, web_users.role
      FROM web_users
      WHERE web_users.role IN ('bidder', 'readonly_bidder', 'editable_bidder')
         OR EXISTS (
           SELECT 1
           FROM job_bids
           WHERE job_bids.user_id = web_users.id
         )
         OR EXISTS (
           SELECT 1
           FROM profile_share_requests
           WHERE profile_share_requests.recipient_user_id = web_users.id
             AND profile_share_requests.status = 'accepted'
         )
      ORDER BY web_users.username ASC
    `);
    const visibleBidders = isAdminRole(user)
      ? bidderRows
      : bidderRows.filter((bidder) => String(bidder.id) === String(user.id));
    const bidderIds = visibleBidders.map((bidder) => Number(bidder.id)).filter((id) => Number.isFinite(id));
    const viewerTimeZone = user.timezone;
    const bidDaySql = localDaySql('job_bids.bid_at', viewerTimeZone);
    const nowDaySql = localDaySql('now()', viewerTimeZone);

    if (!bidderIds.length) {
      res.json({ bidders: [] });
      return;
    }

    const bidderIdSql = bidderIds.join(',');
    const visibleProfileAccessSql = `
      SELECT bid_profiles.user_id, bid_profiles.id AS profile_id
      FROM bid_profiles
      WHERE bid_profiles.user_id IN (${bidderIdSql})
      UNION
      SELECT profile_share_requests.recipient_user_id AS user_id, profile_share_requests.profile_id
      FROM profile_share_requests
      WHERE profile_share_requests.recipient_user_id IN (${bidderIdSql})
        AND profile_share_requests.status = 'accepted'
    `;
    const [summaryRows, dailyRows, interviewSummaryRows, interviewRows] = await Promise.all([
      sequelize.query(`
        WITH visible_profile_access AS (
          ${visibleProfileAccessSql}
        )
        SELECT
          visible_profile_access.user_id,
          COUNT(*)::int AS total_applications,
          COUNT(*) FILTER (WHERE job_bids.bid_at >= now() - interval '7 days')::int AS weekly_applications,
          COUNT(*) FILTER (WHERE job_bids.bid_at >= now() - interval '30 days')::int AS monthly_applications
        FROM job_bids
        JOIN visible_profile_access ON visible_profile_access.profile_id = job_bids.profile_id
        WHERE job_bids.status NOT IN ('mismatching_bid', 'spam_job')
        GROUP BY visible_profile_access.user_id
      `),
      sequelize.query(`
        WITH visible_profile_access AS (
          ${visibleProfileAccessSql}
        )
        SELECT
          visible_profile_access.user_id,
          to_char(${bidDaySql}, 'YYYY-MM-DD') AS day,
          COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown') AS source,
          COUNT(*)::int AS applications
        FROM job_bids
        JOIN visible_profile_access ON visible_profile_access.profile_id = job_bids.profile_id
        JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
        WHERE ${bidDaySql} >= ${nowDaySql} - interval '13 days'
          AND job_bids.status NOT IN ('mismatching_bid', 'spam_job')
        GROUP BY visible_profile_access.user_id, ${bidDaySql}, COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown')
        ORDER BY ${bidDaySql} ASC, source ASC
      `),
      sequelize.query(`
        WITH visible_profile_access AS (
          ${visibleProfileAccessSql}
        )
        SELECT
          visible_profile_access.user_id,
          COUNT(*)::int AS interview_pass_through,
          COUNT(*) FILTER (WHERE interviews.status = 'won')::int AS won,
          COUNT(*) FILTER (WHERE interviews.status = 'lost')::int AS lost
        FROM interviews
        JOIN visible_profile_access ON visible_profile_access.profile_id = interviews.profile_id
        GROUP BY visible_profile_access.user_id
      `),
      sequelize.query(`
        WITH visible_profile_access AS (
          ${visibleProfileAccessSql}
        )
        SELECT
          interviews.id,
          visible_profile_access.user_id,
          interviews.status,
          interviews.interview_stage,
          interviews.interview_next_at,
          interviews.updated_at,
          interviews.job_id,
          interviews.title,
          interviews.company,
          interviews.location,
          interviews.job_url AS url,
          bid_profiles.id AS profile_id,
          bid_profiles.name AS profile_name
        FROM interviews
        JOIN visible_profile_access ON visible_profile_access.profile_id = interviews.profile_id
        JOIN bid_profiles ON bid_profiles.id = interviews.profile_id
        ORDER BY interviews.updated_at DESC
        LIMIT 200
      `),
    ]);

    const summaryByUserId = new Map(summaryRows[0].map((row) => [String(row.user_id), row]));
    const interviewSummaryByUserId = new Map(interviewSummaryRows[0].map((row) => [String(row.user_id), row]));
    const dailyByUserId = buildDailyApplications(dailyRows[0], viewerTimeZone);
    const interviewsByUserId = new Map(bidderIds.map((id) => [String(id), []]));
    for (const row of interviewRows[0]) {
      const interviews = interviewsByUserId.get(String(row.user_id));
      if (!interviews) continue;
      interviews.push({
        id: row.id,
        status: row.status,
        interviewStage: row.interview_stage,
        interviewNextAt: row.interview_next_at,
        updatedAt: row.updated_at,
        job: {
          id: row.job_id,
          title: row.title,
          company: row.company,
          location: row.location,
          url: row.url,
        },
        profile: {
          id: row.profile_id,
          name: row.profile_name,
        },
      });
    }

    res.json({
      bidders: visibleBidders.map((bidder) => {
        const summary = summaryByUserId.get(String(bidder.id)) || {};
        const interviewSummary = interviewSummaryByUserId.get(String(bidder.id)) || {};
        return {
          id: bidder.id,
          username: bidder.username,
          role: bidder.role,
          totalApplications: Number(summary.total_applications || 0),
          weeklyApplications: Number(summary.weekly_applications || 0),
          monthlyApplications: Number(summary.monthly_applications || 0),
          interviewPassThrough: Number(interviewSummary.interview_pass_through || 0),
          won: Number(interviewSummary.won || 0),
          lost: Number(interviewSummary.lost || 0),
          dailyApplications: dailyByUserId.get(String(bidder.id)) || buildEmptyDailyApplications(viewerTimeZone),
          interviews: interviewsByUserId.get(String(bidder.id)) || [],
        };
      }),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function shareProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const profile = await manageableProfile(req, req.params.id);
    const hasRecipientList = Array.isArray(req.body?.usernames) || Array.isArray(req.body?.recipients) || Array.isArray(req.body?.users);
    const recipientUsernames = recipientUsernamesFromBody(req.body);
    if (!hasRecipientList && !recipientUsernames.length) {
      res.status(400).json({ error: 'Choose a user to share with' });
      return;
    }

    const users = await repositories.listUsers();
    const usersByUsername = new Map(users.map((row) => [String(row.username || '').toLowerCase(), row]));
    const recipients = recipientUsernames.map((username) => usersByUsername.get(username.toLowerCase())).filter(Boolean);
    const foundUsernames = new Set(recipients.map((recipient) => String(recipient.username || '').toLowerCase()));
    const missingUsername = recipientUsernames.find((username) => !foundUsernames.has(username.toLowerCase()));
    if (missingUsername) return res.status(404).json({ error: `User not found: ${missingUsername}` });
    if (recipients.some((recipient) => String(recipient.id) === String(profile.userId))) {
      return res.status(400).json({ error: 'You cannot share a profile with its owner' });
    }

    const ProfileShareRequest = getProfileShareRequestModel();
    const existingShares = await ProfileShareRequest.findAll({
      where: { profileId: profile.id },
      include: [{ model: getWebUserModel(), as: 'recipient', required: false }],
    });
    const existingByRecipientId = new Map(existingShares.map((share) => [String(share.recipientUserId), share]));
    const selectedRecipientIds = new Set(recipients.map((recipient) => String(recipient.id)));
    const removedShareIds = [];

    await Promise.all(
      existingShares
        .filter((share) => !selectedRecipientIds.has(String(share.recipientUserId)))
        .map(async (share) => {
          removedShareIds.push(share.id);
          await share.destroy();
        }),
    );

    const shares = [];
    let createdCount = 0;
    for (const recipient of recipients) {
      const existing = existingByRecipientId.get(String(recipient.id));
      const attrs = {
        profileId: profile.id,
        ownerUserId: profile.userId,
        recipientUserId: recipient.id,
        status: existing?.status === 'accepted' ? 'accepted' : 'pending',
        respondedAt: existing?.status === 'accepted' ? existing.respondedAt : null,
      };
      const share = existing ? await existing.update(attrs) : await ProfileShareRequest.create(attrs);
      if (!existing) createdCount += 1;
      share.setDataValue('profile', profile);
      share.setDataValue('recipient', recipient);
      shares.push(share);
    }

    res.status(createdCount ? 201 : 200).json({
      share: shares[0] ? formatProfileShareRequest(shares[0]) : null,
      shares: shares.map(formatProfileShareRequest),
      removedShareIds,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function respondToProfileShare(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const status = clean(req.body?.status).toLowerCase();
    if (!['accepted', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Choose accept or reject' });
      return;
    }

    const share = await getProfileShareRequestModel().findOne({
      where: { id: req.params.id, recipientUserId: user.id, status: 'pending' },
      include: [
        { model: getBidProfileModel(), as: 'profile', required: true },
        { model: getWebUserModel(), as: 'owner', required: true },
      ],
    });
    if (!share) {
      res.status(404).json({ error: 'Share request not found' });
      return;
    }

    await share.update({ status, respondedAt: new Date() });
    res.json({ share: formatProfileShareRequest(share) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

function recipientUsernamesFromBody(body = {}) {
  const values = Array.isArray(body.usernames)
    ? body.usernames
    : Array.isArray(body.recipients)
      ? body.recipients
      : Array.isArray(body.users)
        ? body.users
        : [body.username || body.recipient || body.email];
  const usernames = values.map((value) => clean(value).toLowerCase()).filter(Boolean);
  return [...new Set(usernames)];
}

export async function createProfile(req, res, next) {
  try {
    await ensureWebModels();
    if (!canManageProfiles(req, res)) return;
    const user = await currentDbUser(req);
    const attrs = profileAttributesFromBody(req.body, { canSetDailyBidGoal: isAdminRole(req.user) });
    const profile = await getBidProfileModel().create({
      ...attrs,
      userId: user.id,
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
    await profile.destroy();
    res.json({ ok: true });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

function canManageProfiles(req, res) {
  if (!BIDDER_ROLES.includes(req.user?.role)) return true;
  res.status(403).json({ error: 'Bidders cannot add, edit, share, or remove profiles' });
  return false;
}

function canUpdateProfileStatus(req, res, profile, status) {
  if (status === 'legacy' || isLegacyProfile(profile)) {
    if (isSuperadmin(req.user)) return true;
    res.status(403).json({ error: 'Only superadmins can mark or restore legacy profiles' });
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

async function manageableProfile(req, profileId) {
  if (isAdminRole(req.user)) return adminManagedProfile(req, profileId);
  return ownedProfile(req, profileId);
}

async function adminManagedProfile(req, profileId) {
  if (!isAdminRole(req.user)) return ownedProfile(req, profileId);
  const id = clean(profileId);
  if (!id) throw new NotFoundError('Profile not found');
  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  return profile;
}

export async function listBidJobs(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const bidTab = clean(req.query.bidTab || 'todo');
    const query = jobDateFiltersForUser(req.query, user);
    const profile = user.role === 'caller' && bidTab === 'interviews'
      ? await assignedCallerProfile(user, query.profileId)
      : await accessibleProfile(req, query.profileId);
    const canViewInternalData = isInternalUser(user);
    if (bidTab === 'interviews') {
      requireInterviewAccessUser(user, res);
      if (res.headersSent) return;
      await listInterviewJobs(req, res, { user, profile });
      return;
    }
    if (!ensureProfileBidEligible(profile, res)) return;
    const ScrapedJob = getScrapedJobModel();
    const JobBid = getJobBidModel();
    const TailoredResume = getTailoredResumeModel();
    const WebUser = getWebUserModel();
    const sequelize = getSequelize();
    const activeBidDateRange = bidDateRangeForTab(query, bidTab, user);
    const { where, order: jobOrder, limit, offset } = buildJobQuery({
      ...jobQueryForBidTab(query, bidTab),
      limit: query.limit || 10,
    }, { timeZone: user.timezone });
    const bidUsers = await bidUsersForProfile(profile);
    const appliedProfileId = bidTab === 'todo' ? await appliedProfileFilter(req, req.query.appliedProfileId) : '';
    const activeTabQuery = buildBidTabQuery({
      where,
      tab: bidTab,
      profileId: profile.id,
      appliedProfileId,
      bidDateRange: activeBidDateRange,
      JobBid,
      sequelize,
    });

    const countBidTab = (tab) => {
      const { where: countWhere } = buildJobQuery({
        ...jobQueryForBidTab(query, tab),
        limit: query.limit || 10,
      }, { timeZone: user.timezone });
      const countQuery = buildBidTabQuery({
        where: countWhere,
        tab,
        profileId: profile.id,
        appliedProfileId: tab === 'todo' && tab === bidTab ? appliedProfileId : '',
        bidDateRange: bidDateRangeForTab(query, tab, user),
        JobBid,
        sequelize,
      });
      return ScrapedJob.count({
        where: countQuery.where,
        distinct: true,
        col: 'id',
        subQuery: false,
        include: countQuery.include,
      });
    };

    const [
      rows,
      todoCount,
      tailoredCount,
      doneCount,
      badWorkCount,
      interviewsCount,
      dailyBidProgress,
      profilesWithDateProgress,
    ] = await Promise.all([
      ScrapedJob.findAll({
        where: activeTabQuery.where,
        order: activeTabQuery.order || jobOrder,
        subQuery: false,
        include: activeTabQuery.include,
      }),
      countBidTab('todo'),
      countBidTab('tailored'),
      countBidTab('done'),
      countBidTab('bad_work'),
      canViewInternalData ? countInterviewsForProfile(profile.id) : Promise.resolve(0),
      dailyBidProgressForUser(user, query),
      profilesWithProgress([profile], { user, dailyGoalFilters: query }),
    ]);
    const profileWithDateProgress = profilesWithDateProgress[0] || profile;

    const tailoredResumesByUrl = await tailoredResumesForJobs({
      TailoredResume,
      jobs: rows,
      profileId: profile.id,
    });
    const sameCompanyTailoringByUrl = await sameCompanyTailoringByJobUrl({
      sequelize,
      profileId: profile.id,
      jobs: rows,
    });
    const bidUsersById = new Map(bidUsers.map((bidUser) => [String(bidUser.id), bidUser]));
    const callerUsers = canViewInternalData
      ? await WebUser.findAll({
          where: { role: 'caller' },
          order: [['username', 'ASC']],
        })
      : [];
    const callerUsersById = new Map(callerUsers.map((caller) => [String(caller.id), { id: caller.id, username: caller.username }]));

    const formattedJobs = rows.map((job) => ({
      ...formatJob(job),
      bid: job.bids?.[0] ? formatBidWithUser(job.bids[0], bidUsersById, callerUsersById) : null,
      tailoredResume: tailoredResumesByUrl.get(job.url) || null,
      sameCompanyTailoring: sameCompanyTailoringByUrl.get(job.url) || null,
    }));
    const tabJobs = shouldGroupBidTab(bidTab) ? groupedBidJobs(formattedJobs) : formattedJobs;
    const pagedJobs = tabJobs.slice(offset, offset + limit);

    res.json({
      jobs: pagedJobs,
      bidUsers,
      callerUsers: callerUsers.map((caller) => ({ id: caller.id, username: caller.username })),
      currentUser: {
        id: user.id,
        username: user.username,
        role: user.role,
        dailyBidGoal: dailyBidProgress.goal,
        dailyFinishedBids: dailyBidProgress.finished,
      },
      profile: formatProfile(profileWithDateProgress),
      total: tabJobs.length,
      tabCounts: {
        todo: todoCount,
        tailored: tailoredCount,
        done: doneCount,
        badWork: badWorkCount,
        interviews: interviewsCount,
      },
      limit,
      offset,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listCalendarInterviews(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireInterviewAccessUser(user, res);
    if (res.headersSent) return;

    const interviews = await calendarInterviewsForUser(user);

    const profilesById = new Map();
    for (const interview of interviews) {
      if (!interview.profile) continue;
      if (user.role === 'caller') interview.profile.setDataValue('shareStatus', 'caller');
      profilesById.set(String(interview.profile.id), interview.profile);
    }

    res.json({
      profiles: sortProfilesForDisplay([...profilesById.values()]).map(formatProfile),
      jobs: interviews.map((interview) => formatInterviewAsJob(interview)),
      calendar: {
        generatedAt: new Date().toISOString(),
        icsUrl: '/api/bid/calendar.ics',
        reminders: calendarReminders(interviews),
        conflicts: calendarConflicts(interviews),
        integrations: calendarIntegrationStatus(),
      },
      currentUser: { id: user.id, username: user.username, role: user.role },
      total: interviews.length,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function exportCalendarIcs(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    requireInterviewAccessUser(user, res);
    if (res.headersSent) return;

    const interviews = await calendarInterviewsForUser(user);
    const ics = buildInterviewCalendarIcs(interviews);
    res.setHeader('content-type', 'text/calendar; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="applypilot-interviews.ics"');
    res.send(ics);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

async function calendarInterviewsForUser(user) {
  const Interview = getInterviewModel();
  const BidProfile = getBidProfileModel();
  const WebUser = getWebUserModel();
  const where = {
    interviewNextAt: { [Op.not]: null },
    ...(user.role === 'caller' ? { callerUserId: user.id } : {}),
  };

  return Interview.findAll({
    where,
    include: [
      {
        model: BidProfile,
        as: 'profile',
        required: true,
        include: [{ model: WebUser, as: 'user', required: false }],
      },
    ],
    order: [
      ['interviewNextAt', 'ASC'],
      ['updatedAt', 'DESC'],
    ],
  });
}

function calendarIntegrationStatus() {
  return {
    google: { supported: true, mode: 'event-link' },
    outlook: { supported: true, mode: 'event-link' },
    ics: { supported: true, mode: 'export' },
    sync: { supported: false, reason: 'oauth_not_configured' },
  };
}

function calendarReminders(interviews) {
  const now = Date.now();
  return interviews
    .filter((interview) => interview.interviewNextAt)
    .map((interview) => {
      const startsAt = new Date(interview.interviewNextAt).getTime();
      const minutesUntilStart = Math.round((startsAt - now) / 60000);
      return {
        id: String(interview.id),
        profileId: interview.profileId ? String(interview.profileId) : null,
        title: interview.title,
        company: interview.company,
        startsAt: new Date(interview.interviewNextAt).toISOString(),
        reminderAt: new Date(startsAt - 30 * 60000).toISOString(),
        minutesUntilStart,
        missingMeetingLink: !meetingLinkForStage(interview.stageMeetingLinks, interview.interviewStage),
      };
    })
    .filter((reminder) => reminder.minutesUntilStart >= 0 && reminder.minutesUntilStart <= 24 * 60)
    .slice(0, 20);
}

function calendarConflicts(interviews) {
  const events = interviews
    .filter((interview) => interview.interviewNextAt)
    .map((interview) => ({
      id: String(interview.id),
      profileId: interview.profileId ? String(interview.profileId) : null,
      profileName: interview.profile?.name || '',
      title: interview.title,
      company: interview.company,
      startsAt: new Date(interview.interviewNextAt),
      endsAt: new Date(new Date(interview.interviewNextAt).getTime() + Number(interview.interviewDurationMinutes || 60) * 60000),
    }))
    .sort((left, right) => left.startsAt - right.startsAt);
  const conflicts = [];

  for (let index = 0; index < events.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < events.length; nextIndex += 1) {
      const left = events[index];
      const right = events[nextIndex];
      if (right.startsAt >= left.endsAt) break;
      conflicts.push({
        id: `${left.id}:${right.id}`,
        startsAt: right.startsAt.toISOString(),
        events: [left, right].map(formatCalendarConflictEvent),
      });
    }
  }

  return conflicts.slice(0, 50);
}

function formatCalendarConflictEvent(event) {
  return {
    id: event.id,
    profileId: event.profileId,
    profileName: event.profileName,
    title: event.title,
    company: event.company,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
  };
}

function buildInterviewCalendarIcs(interviews) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ApplyPilot//Interview Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const interview of interviews) {
    if (!interview.interviewNextAt) continue;
    const start = new Date(interview.interviewNextAt);
    const end = new Date(start.getTime() + Number(interview.interviewDurationMinutes || 60) * 60000);
    const meetingLink = meetingLinkForStage(interview.stageMeetingLinks, interview.interviewStage);
    const description = [
      interview.interviewNotes,
      meetingLink ? `Meeting link: ${meetingLink}` : '',
      interview.jobUrl ? `Job link: ${interview.jobUrl}` : '',
      interview.profile?.name ? `Profile: ${interview.profile.name}` : '',
    ].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:applypilot-interview-${interview.id}@applypilot`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape([interview.company, interview.title].filter(Boolean).join(' - ') || 'Interview')}`,
      `DESCRIPTION:${icsEscape(description || 'ApplyPilot interview')}`,
      `LOCATION:${icsEscape(meetingLink || interview.location || '')}`,
      `URL:${icsEscape(meetingLink || interview.jobUrl || '')}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(`Upcoming interview: ${interview.title || 'Interview'}`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldIcsLine(line) {
  const value = String(line);
  if (value.length <= 74) return value;
  const parts = [];
  for (let index = 0; index < value.length; index += 74) {
    parts.push(`${index ? ' ' : ''}${value.slice(index, index + 74)}`);
  }
  return parts.join('\r\n');
}

function jobQueryForBidTab(query, tab) {
  if (!isCompletedBidTab(tab)) return query;
  return { ...query, since: 'all', dateFrom: '', dateTo: '' };
}

function bidDateRangeForTab(query, tab, user) {
  if (!isCompletedBidTab(tab)) return null;
  return bidDateRange({
    since: clean(query?.since || 'all'),
    dateFrom: query?.dateFrom,
    dateTo: query?.dateTo,
    timeZone: user?.timezone,
  });
}

function bidDateRange({ since, dateFrom, dateTo, timeZone }) {
  if (since === 'all') return null;
  if (since === 'custom') {
    const from = localDateRange(dateFrom, { timeZone })?.from || null;
    const to = localDateRange(dateTo, { timeZone })?.from || null;
    return { from, to: to ? addLocalDays(to, 1, { timeZone }) : null };
  }
  return presetBidDateRange(since, timeZone);
}

function presetBidDateRange(since, timeZone) {
  return localPresetRange(since, new Date(), { timeZone });
}

function isCompletedBidTab(tab) {
  return tab === 'done' || tab === 'bad_work';
}

function isBidStrategyTab(tab) {
  return tab === 'todo' || tab === 'tailored';
}

function shouldGroupBidTab(tab) {
  return isBidStrategyTab(tab);
}

export function groupedBidJobs(jobs) {
  const groups = new Map();

  for (const job of jobs) {
    const groupKey = bidJobGroupKey(job);
    const group = groups.get(groupKey);
    const option = bidJobLocationOption(job);
    if (!group) {
      groups.set(groupKey, {
        ...job,
        groupId: `bid-job-group:${groupKey}`,
        representativeJobId: job.id,
        locationOptions: [option],
      });
      continue;
    }

    group.locationOptions.push(option);
    const latestPostedAt = latestDateValue(group.postedAt, job.postedAt);
    const latestScrapedAt = latestDateValue(group.scrapedAt, job.scrapedAt);
    if (shouldPromoteBidJobRepresentative(group, job)) {
      const { groupId, locationOptions } = group;
      Object.assign(group, {
        ...job,
        groupId,
        representativeJobId: job.id,
        locationOptions,
      });
    }
    group.location = groupedBidLocationLabel(group.locationOptions);
    group.postedAt = latestPostedAt;
    group.scrapedAt = latestScrapedAt;
  }

  return [...groups.values()].map((group) => ({
    ...group,
    locationOptions: group.locationOptions.sort(compareBidLocationOptions),
  }));
}

function bidJobGroupKey(job) {
  return [
    normalizeJobSource(job.source || 'Unknown source') || 'unknown source',
    normalizeBidGroupValue(job.title || 'Untitled role'),
    normalizeBidGroupValue(job.company || 'Unknown company'),
  ].join('::');
}

function normalizeBidGroupValue(value) {
  return clean(value).toLowerCase().replace(/\s+/g, ' ') || 'unknown';
}

function bidJobLocationOption(job) {
  return {
    ...job,
    groupJobId: job.id,
    locationLabel: job.location || 'Location not listed',
  };
}

function shouldPromoteBidJobRepresentative(current, candidate) {
  const currentPriority = bidJobRepresentativePriority(current);
  const candidatePriority = bidJobRepresentativePriority(candidate);
  if (candidatePriority !== currentPriority) return candidatePriority > currentPriority;

  const currentTime = Date.parse(current.postedAt || current.scrapedAt || 0) || 0;
  const candidateTime = Date.parse(candidate.postedAt || candidate.scrapedAt || 0) || 0;
  if (candidateTime !== currentTime) return candidateTime > currentTime;

  return Number(candidate.id || 0) > Number(current.id || 0);
}

function bidJobRepresentativePriority(job) {
  const tailoredStatusPriority = {
    ready: 5,
    processing: 4,
    requested: 3,
    dead_letter: 2,
  };
  return tailoredStatusPriority[job.tailoredResume?.status] || 1;
}

function groupedBidLocationLabel(options) {
  const locations = [...new Set(options.map((option) => option.locationLabel).filter(Boolean))];
  if (locations.length <= 1) return locations[0] || '';
  return `${locations[0]} + ${locations.length - 1} more`;
}

function compareBidLocationOptions(left, right) {
  return String(left.locationLabel || '').localeCompare(String(right.locationLabel || '')) || Number(left.id || 0) - Number(right.id || 0);
}

function latestDateValue(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime > leftTime ? right : left;
}

async function listInterviewJobs(req, res, { user, profile }) {
  const Interview = getInterviewModel();
  const TailoredResume = getTailoredResumeModel();
  const WebUser = getWebUserModel();
  const { limit, offset } = paginationFromQuery(req.query);
  const search = clean(req.query.search).toLowerCase();
  const where = {
    profileId: profile.id,
    ...(user.role === 'caller' ? { callerUserId: user.id } : {}),
    ...(search
      ? {
          [Op.or]: [
            { title: { [Op.iLike]: `%${search}%` } },
            { company: { [Op.iLike]: `%${search}%` } },
            { location: { [Op.iLike]: `%${search}%` } },
            { jobUrl: { [Op.iLike]: `%${search}%` } },
            { interviewNotes: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {}),
  };
  const [interviews, count, todoCount, tailoredCount, doneCount, badWorkCount, interviewsCount, bidUsers, callerUsers] = await Promise.all([
    Interview.findAll({
      where,
      order: [
        ['interviewNextAt', 'ASC'],
        ['updatedAt', 'DESC'],
      ],
      limit,
      offset,
    }),
    Interview.count({ where }),
    user.role === 'caller' ? Promise.resolve(0) : countBidTabForProfile({ profile, tab: 'todo', query: req.query, user }),
    user.role === 'caller' ? Promise.resolve(0) : countBidTabForProfile({ profile, tab: 'tailored', query: req.query, user }),
    user.role === 'caller' ? Promise.resolve(0) : countBidTabForProfile({ profile, tab: 'done', query: req.query, user }),
    user.role === 'caller' ? Promise.resolve(0) : countBidTabForProfile({ profile, tab: 'bad_work', query: req.query, user }),
    Interview.count({ where: { profileId: profile.id, ...(user.role === 'caller' ? { callerUserId: user.id } : {}) } }),
    bidUsersForProfile(profile),
    isAdminRole(user) ? WebUser.findAll({ where: { role: 'caller' }, order: [['username', 'ASC']] }) : Promise.resolve([]),
  ]);
  const logsByInterviewId = await interviewLogsByInterviewId(interviews);
  const tailoredResumesByUrl = await tailoredResumesForJobs({
    TailoredResume,
    jobs: interviews.map((interview) => ({ url: interview.jobUrl })).filter((job) => job.url),
    profileId: profile.id,
  });
  const bidUsersById = new Map(bidUsers.map((bidUser) => [String(bidUser.id), bidUser]));
  const callerUsersById = new Map(callerUsers.map((caller) => [String(caller.id), { id: caller.id, username: caller.username }]));

  res.json({
    jobs: interviews.map((interview) => {
      interview.setDataValue('logs', logsByInterviewId.get(String(interview.id)) || []);
      return formatInterviewAsJob(interview, bidUsersById, callerUsersById, tailoredResumesByUrl.get(interview.jobUrl) || null);
    }),
    bidUsers,
    callerUsers: callerUsers.map((caller) => ({ id: caller.id, username: caller.username })),
    currentUser: { id: user.id, username: user.username, role: user.role },
    total: count,
    tabCounts: {
      todo: todoCount,
      tailored: tailoredCount,
      done: doneCount,
      badWork: badWorkCount,
      interviews: interviewsCount,
    },
    limit,
    offset,
  });
}

async function countBidTabForProfile({ profile, tab, query, user, appliedProfileId = '' }) {
  const ScrapedJob = getScrapedJobModel();
  const JobBid = getJobBidModel();
  const sequelize = getSequelize();
  const { where } = buildJobQuery({
    ...jobQueryForBidTab(query, tab),
    bidTab: tab,
    profileId: profile.id,
    limit: query.limit || 10,
  }, { timeZone: user?.timezone });
  const countQuery = buildBidTabQuery({
    where,
    tab,
    profileId: profile.id,
    appliedProfileId,
    bidDateRange: bidDateRangeForTab(query, tab, user),
    JobBid,
    sequelize,
  });
  return ScrapedJob.count({
    where: countQuery.where,
    distinct: true,
    col: 'id',
    subQuery: false,
    include: countQuery.include,
  });
}

function paginationFromQuery(query) {
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 250);
  const page = Math.max(Number(query.page || 1), 1);
  return { limit, offset: (page - 1) * limit };
}

function countInterviewsForProfile(profileId) {
  return getInterviewModel().count({ where: { profileId } });
}

async function assignedCallerProfile(user, profileId) {
  const id = clean(profileId);
  if (!id) throw new NotFoundError('Profile not found');
  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  const assignment = await getInterviewModel().findOne({ where: { profileId: profile.id, callerUserId: user.id } });
  if (!assignment) throw new NotFoundError('Profile not found');
  profile.setDataValue('shareStatus', 'caller');
  return profile;
}

function requireInterviewAccessUser(user, res) {
  if (canAccessInterviews(user)) return;
  res.status(403).json({ error: 'Interview access required' });
}

function isInternalUser(user) {
  return INTERNAL_DATA_ROLES.includes(user?.role);
}

function canAccessInterviews(user) {
  return INTERVIEW_ACCESS_ROLES.includes(user?.role);
}

function requireCallerManagementUser(user, res) {
  if (canManageCallers(user)) return;
  res.status(403).json({ error: 'Caller registration is not available for this role' });
}

function canManageCallers(user) {
  return canManageCallersRole(user);
}

function ensureProfileBidEligible(profile, res) {
  if (!isLegacyProfile(profile)) return true;
  res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding or tailoring' });
  return false;
}

function isInterviewBidStatus(status) {
  return ['interviewing', 'won', 'lost'].includes(status);
}

async function bidUsersForProfile(profile) {
  const WebUser = getWebUserModel();
  const ProfileShareRequest = getProfileShareRequestModel();
  const [owner, acceptedShares] = await Promise.all([
    WebUser.findByPk(profile.userId),
    ProfileShareRequest.findAll({
      where: { profileId: profile.id, status: 'accepted' },
      include: [{ model: WebUser, as: 'recipient', required: true }],
      order: [['updatedAt', 'ASC']],
    }),
  ]);

  const usersById = new Map();
  if (owner) usersById.set(String(owner.id), owner);
  for (const share of acceptedShares) {
    if (share.recipient) usersById.set(String(share.recipient.id), share.recipient);
  }

  return [...usersById.values()]
    .map((row) => ({ id: row.id, username: row.username }))
    .sort((left, right) => String(left.username).localeCompare(String(right.username)));
}

async function appliedProfileFilter(req, value) {
  const profileId = clean(value);
  if (!profileId || profileId === 'all') return '';
  const profile = await accessibleAppliedProfile(req, profileId, req.query.profileId);
  return profile.id;
}

function formatBidWithUser(row, bidUsersById, callerUsersById) {
  const bid = formatBid(row);
  const bidUser = bidUsersById.get(String(row.userId));
  const caller = callerUsersById?.get(String(row.callerUserId || ''));
  return {
    ...bid,
    user: bidUser || null,
    caller: caller || null,
  };
}

async function dailyBidProgressForUser(user, filters = {}) {
  const goal = Number(user.dailyBidGoal || 0);
  if (!goal) return { goal: null, finished: 0 };

  // Goal progress uses the user's local timezone; cumulative presets collapse to a single day.
  const dailyGoalRange = filters?.from && filters?.to ? filters : dailyGoalRangeForUserBidFilter(filters, user);
  const { from, to } = dailyGoalRange;
  const finished = await getJobBidModel().count({
    where: {
      userId: user.id,
      status: { [Op.in]: DAILY_BID_GOAL_STATUSES },
      bidAt: { [Op.gte]: from, [Op.lt]: to },
    },
  });

  return { goal, finished };
}

async function sameCompanyTailoringByJobUrl({ sequelize, profileId, jobs }) {
  const companyByJobUrl = new Map(
    jobs
      .map((job) => [job.url, normalizeCompany(job.company)])
      .filter(([jobUrl, company]) => jobUrl && company),
  );
  const companies = [...new Set(companyByJobUrl.values())];
  if (!companies.length) return new Map();

  const [rows] = await sequelize.query(
    `
      SELECT
        tailored_resumes.id,
        tailored_resumes.job_url,
        tailored_resumes.status,
        tailored_resumes.created_at,
        tailored_resumes.updated_at,
        scraped_jobs.title,
        scraped_jobs.company,
        scraped_jobs.posted_at,
        scraped_jobs.scraped_at,
        scraped_jobs.url
      FROM tailored_resumes
      JOIN scraped_jobs ON scraped_jobs.url = tailored_resumes.job_url
      WHERE tailored_resumes.profile_id = :profileId
        AND tailored_resumes.status IN (:statuses)
        AND lower(regexp_replace(btrim(coalesce(scraped_jobs.company, '')), '\\s+', ' ', 'g')) IN (:companies)
      ORDER BY tailored_resumes.created_at DESC NULLS LAST, tailored_resumes.updated_at DESC NULLS LAST
    `,
    {
      replacements: {
        profileId,
        statuses: ACTIVE_TAILORED_RESUME_STATUSES,
        companies,
      },
    },
  );

  const priorByCompany = new Map();
  for (const row of rows) {
    const company = normalizeCompany(row.company);
    if (!company) continue;
    const entries = priorByCompany.get(company) || [];
    entries.push(row);
    priorByCompany.set(company, entries);
  }

  const now = new Date();
  const result = new Map();
  for (const job of jobs) {
    const company = companyByJobUrl.get(job.url);
    if (!company) continue;
    const prior = (priorByCompany.get(company) || []).find((row) => String(row.job_url) !== String(job.url));
    if (!prior) continue;
    result.set(job.url, sameCompanyTailoringSummary(prior, now));
  }

  return result;
}

async function findSameCompanyTailoringConflicts({ sequelize, profileId, job }) {
  const company = normalizeCompany(job.company);
  if (!company || !job.url) return [];

  const [rows] = await sequelize.query(
    `
      SELECT
        tailored_resumes.id,
        tailored_resumes.job_url,
        tailored_resumes.status,
        tailored_resumes.created_at,
        tailored_resumes.updated_at,
        scraped_jobs.title,
        scraped_jobs.company,
        scraped_jobs.posted_at,
        scraped_jobs.scraped_at,
        scraped_jobs.url
      FROM tailored_resumes
      JOIN scraped_jobs ON scraped_jobs.url = tailored_resumes.job_url
      WHERE tailored_resumes.profile_id = :profileId
        AND tailored_resumes.job_url <> :jobUrl
        AND tailored_resumes.status IN (:statuses)
        AND lower(regexp_replace(btrim(coalesce(scraped_jobs.company, '')), '\\s+', ' ', 'g')) = :company
      ORDER BY tailored_resumes.created_at DESC NULLS LAST, tailored_resumes.updated_at DESC NULLS LAST
    `,
    {
      replacements: {
        profileId,
        jobUrl: job.url,
        statuses: ACTIVE_TAILORED_RESUME_STATUSES,
        company,
      },
    },
  );

  return rows
    .map((row) => sameCompanyTailoringSummary(row))
    .filter((summary) => summary.daysSincePrior <= SAME_COMPANY_TAILORING_WINDOW_DAYS);
}

function sameCompanyTailoringSummary(row, now = new Date()) {
  const priorAt = row.created_at || row.updated_at || null;
  const priorPostedAt = row.posted_at || row.scraped_at || null;
  const daysSincePrior = daysSince(priorAt, now);
  return {
    priorTailoredResumeId: row.id,
    priorJobUrl: row.job_url || row.url,
    priorTitle: row.title || 'Untitled role',
    priorCompany: row.company || 'Unknown company',
    priorStatus: row.status,
    priorAt,
    priorPostedAt,
    daysSincePriorPosting: daysSince(priorPostedAt, now),
    daysSincePrior,
    requiresConfirmation: daysSincePrior <= SAME_COMPANY_TAILORING_WINDOW_DAYS,
  };
}

function normalizeCompany(value) {
  return clean(value).replace(/\s+/g, ' ').toLowerCase();
}

function daysSince(value, now = new Date()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(Math.floor((now.getTime() - timestamp) / DAY_MS), 0);
}

export async function createTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    if (!ensureProfileBidEligible(profile, res)) return;
    const sequelize = getSequelize();
    const job = await getScrapedJobModel().findByPk(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const TailoredResume = getTailoredResumeModel();
    const sameCompanyConflicts = await findSameCompanyTailoringConflicts({
      sequelize,
      profileId: profile.id,
      job,
    });
    if (sameCompanyConflicts.length && req.body?.confirmSameCompany !== true) {
      const prior = sameCompanyConflicts[0];
      res.status(409).json({
        error: `Different role at same company: ${prior.priorTitle} was tailored ${prior.daysSincePrior} day${prior.daysSincePrior === 1 ? '' : 's'} ago.`,
        code: 'same_company_tailoring_conflict',
        sameCompanyTailoring: prior,
      });
      return;
    }

    if (sameCompanyConflicts.length) {
      await TailoredResume.update(
        {
          status: 'invalid',
          lastError: 'Invalidated by newer same-company tailoring request',
          deadLetterAt: new Date(),
        },
        {
          where: {
            id: { [Op.in]: sameCompanyConflicts.map((conflict) => conflict.priorTailoredResumeId) },
            profileId: profile.id,
            status: { [Op.in]: ACTIVE_TAILORED_RESUME_STATUSES },
          },
        },
      );
    }

    const existing = await TailoredResume.findOne({
      where: { profileId: profile.id, jobUrl: job.url },
      order: [['updatedAt', 'DESC']],
    });

    const attrs = tailoredResumeRequestAttrs({ userId: user.id, profileId: profile.id, jobUrl: job.url });
    const tailoredResume = existing ? await existing.update(attrs) : await TailoredResume.create(attrs);
    await enqueueTailoredResumeRequest({ tailoredResumeId: tailoredResume.id });

    res.status(202).json({
      tailoredResume: formatTailoredResume(tailoredResume),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function bulkCreateTailoredResumes(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    if (!ensureProfileBidEligible(profile, res)) return;
    const jobIds = numericBatchIds(req.body?.jobIds || req.body?.ids, 'jobIds');
    const confirmSameCompany = req.body?.confirmSameCompany === true;
    const sequelize = getSequelize();
    const ScrapedJob = getScrapedJobModel();
    const TailoredResume = getTailoredResumeModel();
    const jobs = await ScrapedJob.findAll({ where: { id: { [Op.in]: jobIds } } });
    const jobsById = new Map(jobs.map((job) => [String(job.id), job]));
    const results = [];

    for (const jobId of jobIds) {
      const job = jobsById.get(String(jobId));
      if (!job) {
        results.push({ jobId: String(jobId), ok: false, error: 'Job not found' });
        continue;
      }

      try {
        const sameCompanyConflicts = await findSameCompanyTailoringConflicts({ sequelize, profileId: profile.id, job });
        if (sameCompanyConflicts.length && !confirmSameCompany) {
          const prior = sameCompanyConflicts[0];
          results.push({
            jobId: String(job.id),
            ok: false,
            code: 'same_company_tailoring_conflict',
            error: `Different role at same company: ${prior.priorTitle} was tailored ${prior.daysSincePrior} day${prior.daysSincePrior === 1 ? '' : 's'} ago.`,
            sameCompanyTailoring: prior,
          });
          continue;
        }

        if (sameCompanyConflicts.length) {
          await TailoredResume.update(
            {
              status: 'invalid',
              lastError: 'Invalidated by newer same-company tailoring request',
              deadLetterAt: new Date(),
            },
            {
              where: {
                id: { [Op.in]: sameCompanyConflicts.map((conflict) => conflict.priorTailoredResumeId) },
                profileId: profile.id,
                status: { [Op.in]: ACTIVE_TAILORED_RESUME_STATUSES },
              },
            },
          );
        }

        const existing = await TailoredResume.findOne({
          where: { profileId: profile.id, jobUrl: job.url },
          order: [['updatedAt', 'DESC']],
        });
        const attrs = tailoredResumeRequestAttrs({ userId: user.id, profileId: profile.id, jobUrl: job.url });
        const tailoredResume = existing ? await existing.update(attrs) : await TailoredResume.create(attrs);
        await enqueueTailoredResumeRequest({ tailoredResumeId: tailoredResume.id });
        results.push({ jobId: String(job.id), ok: true, tailoredResume: formatTailoredResume(tailoredResume) });
      } catch (error) {
        results.push({ jobId: String(job.id), ok: false, error: error.message || 'Tailoring request failed' });
      }
    }

    res.status(202).json({
      requested: jobIds.length,
      created: results.filter((result) => result.ok).length,
      results,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createManualTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    if (!ensureProfileBidEligible(profile, res)) return;
    const attrs = manualTailoringAttributesFromBody(req.body);
    const TailoredResume = getTailoredResumeModel();
    const tailoredResume = await TailoredResume.create({
      userId: user.id,
      profileId: profile.id,
      jobUrl: attrs.jobUrl,
      requestType: 'manual',
      manualCompany: attrs.company,
      manualRole: attrs.role,
      manualJobDescription: attrs.jobDescription,
      status: 'requested',
      filePath: null,
      readyAt: null,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      deadLetterAt: null,
      downloadedAt: null,
    });
    await enqueueTailoredResumeRequest({ tailoredResumeId: tailoredResume.id });

    res.status(202).json({
      tailoredResume: formatTailoredResume(tailoredResume),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function cancelTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const tailoredResume = await getTailoredResumeModel().findByPk(req.params.id);
    if (!tailoredResume) {
      res.status(404).json({ error: 'Tailoring request not found' });
      return;
    }
    await ensureTailoredResumeAccess(req, tailoredResume);

    if (!['requested', 'processing'].includes(tailoredResume.status)) {
      res.status(400).json({ error: 'Only queued or processing tailoring requests can be stopped' });
      return;
    }

    await tailoredResume.update({
      status: 'cancelled',
      filePath: null,
      readyAt: null,
      lastError: null,
      deadLetterAt: null,
      downloadedAt: null,
    });

    res.json({ tailoredResume: formatTailoredResume(tailoredResume) });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

function manualTailoringAttributesFromBody(body = {}) {
  const company = clean(body.company || body.companyName);
  const role = clean(body.role || body.title || body.positionTitle);
  const jobUrl = clean(body.url || body.jobUrl);
  const jobDescription = clean(body.jobDescription || body.jdContent || body.listingText);

  if (!company) throw new InputError('Company name is required');
  if (!role) throw new InputError('Role or position title is required');
  if (!jobUrl) throw new InputError('Job URL is required');
  if (!validHttpUrl(jobUrl)) throw new InputError('Job URL must be a valid URL');
  if (!jobDescription) throw new InputError('Job description content is required');

  return { company, role, jobUrl, jobDescription };
}

function tailoredResumeRequestAttrs({ userId, profileId, jobUrl }) {
  return {
    userId,
    profileId,
    jobUrl,
    requestType: 'job',
    manualCompany: null,
    manualRole: null,
    manualJobDescription: null,
    status: 'requested',
    filePath: null,
    readyAt: null,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    deadLetterAt: null,
    downloadedAt: null,
  };
}

export async function listTailoringRequests(req, res, next) {
  try {
    await ensureWebModels();
    const sequelize = getSequelize();
    const user = await currentDbUser(req);
    const canViewAllTailoring = isSuperadmin(user);
    const visibleProfiles = canViewAllTailoring ? [] : await profilesVisibleToUser(user);
    const visibleProfileIds = visibleProfiles.map((profile) => String(profile.id)).filter(Boolean);
    const requestedStatus = clean(req.query?.status || 'all').toLowerCase();
    const status = TAILORED_REQUEST_STATUSES.includes(requestedStatus) ? requestedStatus : 'all';
    const profileId = clean(req.query?.profileId || 'all');
    const search = clean(req.query?.search).toLowerCase();
    const dateRange = tailoringDateRange({
      since: clean(req.query?.since || 'all'),
      dateFrom: req.query?.dateFrom,
      dateTo: req.query?.dateTo,
      timeZone: user.timezone,
    });
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.max(1, Math.min(Number(req.query?.limit) || 50, 100));
    const replacements = {
      status,
      profileId,
      searchPattern: `%${search}%`,
      canViewAllTailoring,
      visibleProfileIds: visibleProfileIds.length ? visibleProfileIds : ['-1'],
      hasDateFrom: Boolean(dateRange?.from),
      hasDateTo: Boolean(dateRange?.to),
      dateFromValue: dateRange?.from || null,
      dateToValue: dateRange?.to || null,
      limit,
      offset: (page - 1) * limit,
    };
    const baseWhereSql = `
      WHERE (:canViewAllTailoring = true OR tailored_resumes.profile_id::text IN (:visibleProfileIds))
        AND (:profileId = 'all' OR tailored_resumes.profile_id::text = :profileId)
        AND (:hasDateFrom = false OR tailored_resumes.created_at >= CAST(:dateFromValue AS timestamptz))
        AND (:hasDateTo = false OR tailored_resumes.created_at < CAST(:dateToValue AS timestamptz))
        AND (
          :searchPattern = '%%'
          OR LOWER(COALESCE(scraped_jobs.title, '')) LIKE :searchPattern
          OR LOWER(COALESCE(scraped_jobs.company, '')) LIKE :searchPattern
          OR LOWER(COALESCE(tailored_resumes.manual_role, '')) LIKE :searchPattern
          OR LOWER(COALESCE(tailored_resumes.manual_company, '')) LIKE :searchPattern
          OR LOWER(COALESCE(tailored_resumes.manual_job_description, '')) LIKE :searchPattern
          OR LOWER(COALESCE(scraped_jobs.location, '')) LIKE :searchPattern
          OR LOWER(COALESCE(bid_profiles.name, '')) LIKE :searchPattern
          OR LOWER(COALESCE(request_user.username, '')) LIKE :searchPattern
          OR LOWER(COALESCE(owner_user.username, '')) LIKE :searchPattern
          OR LOWER(COALESCE(tailored_resumes.job_url, '')) LIKE :searchPattern
        )
    `;
    const whereSql = `
      ${baseWhereSql}
        AND (:status = 'all' OR tailored_resumes.status = :status)
    `;

    const requests = await sequelize.query(
      `
      SELECT
        tailored_resumes.id,
        tailored_resumes.user_id,
        tailored_resumes.profile_id,
        tailored_resumes.job_url,
        tailored_resumes.request_type,
        tailored_resumes.manual_company,
        tailored_resumes.manual_role,
        tailored_resumes.manual_job_description,
        tailored_resumes.status,
        tailored_resumes.file_path,
        tailored_resumes.ready_at,
        tailored_resumes.attempts,
        tailored_resumes.max_attempts,
        tailored_resumes.last_error,
        tailored_resumes.dead_letter_at,
        tailored_resumes.downloaded_at,
        tailored_resumes.created_at,
        tailored_resumes.updated_at,
        request_user.username AS requester_username,
        bid_profiles.name AS profile_name,
        bid_profiles.resume_text AS profile_resume_text,
        bid_profiles.user_id AS profile_owner_user_id,
        owner_user.username AS profile_owner_username,
        scraped_jobs.id AS job_id,
        scraped_jobs.title,
        scraped_jobs.company,
        scraped_jobs.location,
        scraped_jobs.source,
        scraped_jobs.listing_text,
        scraped_jobs.posted_at,
        scraped_jobs.scraped_at
      FROM tailored_resumes
      LEFT JOIN web_users request_user ON request_user.id = tailored_resumes.user_id
      LEFT JOIN bid_profiles ON bid_profiles.id = tailored_resumes.profile_id
      LEFT JOIN web_users owner_user ON owner_user.id = bid_profiles.user_id
      LEFT JOIN scraped_jobs ON scraped_jobs.url = tailored_resumes.job_url
      ${whereSql}
      ORDER BY tailored_resumes.updated_at DESC
      LIMIT :limit
      OFFSET :offset
      `,
      { replacements, type: QueryTypes.SELECT },
    );

    const [totalRows, statusCounts, profileRows] = await Promise.all([
      sequelize.query(
        `
        SELECT COUNT(*)::int AS count
        FROM tailored_resumes
        LEFT JOIN web_users request_user ON request_user.id = tailored_resumes.user_id
        LEFT JOIN bid_profiles ON bid_profiles.id = tailored_resumes.profile_id
        LEFT JOIN web_users owner_user ON owner_user.id = bid_profiles.user_id
        LEFT JOIN scraped_jobs ON scraped_jobs.url = tailored_resumes.job_url
        ${whereSql}
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `
        SELECT status, COUNT(*)::int AS count
        FROM tailored_resumes
        LEFT JOIN web_users request_user ON request_user.id = tailored_resumes.user_id
        LEFT JOIN bid_profiles ON bid_profiles.id = tailored_resumes.profile_id
        LEFT JOIN web_users owner_user ON owner_user.id = bid_profiles.user_id
        LEFT JOIN scraped_jobs ON scraped_jobs.url = tailored_resumes.job_url
        ${baseWhereSql}
        GROUP BY status
        ORDER BY status ASC
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `
        SELECT
          tailored_resumes.profile_id AS id,
          COALESCE(bid_profiles.name, 'Unknown profile') AS name,
          COALESCE(owner_user.username, 'Unknown owner') AS owner_username,
          COUNT(*)::int AS count
        FROM tailored_resumes
        LEFT JOIN bid_profiles ON bid_profiles.id = tailored_resumes.profile_id
        LEFT JOIN web_users owner_user ON owner_user.id = bid_profiles.user_id
        WHERE (:canViewAllTailoring = true OR tailored_resumes.profile_id::text IN (:visibleProfileIds))
        GROUP BY tailored_resumes.profile_id, bid_profiles.name, owner_user.username
        ORDER BY COALESCE(bid_profiles.name, 'Unknown profile') ASC, tailored_resumes.profile_id ASC
        `,
        { replacements, type: QueryTypes.SELECT },
      ),
    ]);

    res.json({
      requests: requests.map(formatTailoringRequest),
      total: Number(totalRows[0]?.count || 0),
      page,
      limit,
      statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, Number(row.count || 0)])),
      profiles: profileRows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerUsername: row.owner_username,
        count: Number(row.count || 0),
      })),
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

function tailoringDateRange({ since, dateFrom, dateTo, timeZone }) {
  if (since === 'all') return null;
  if (since === 'custom') {
    const from = localDateRange(dateFrom, { timeZone })?.from || null;
    const to = localDateRange(dateTo, { timeZone })?.from || null;
    return { from, to: to ? addLocalDays(to, 1, { timeZone }) : null };
  }
  return presetTailoringDateRange(since, timeZone);
}

function presetTailoringDateRange(since, timeZone) {
  return localPresetRange(since, new Date(), { timeZone });
}

export async function downloadTailoredResume(req, res, next) {
  try {
    await ensureWebModels();
    const tailoredResume = await readyTailoredResumeForUser(req, req.params.id);
    const file = await fetchTailoredResumeFile(tailoredResume);
    await markTailoredResumeDownloaded(tailoredResume);

    res.setHeader('content-type', file.contentType);
    res.setHeader('content-disposition', `attachment; filename="${escapeHeaderValue(file.filename)}"`);
    res.setHeader('content-length', String(file.data.length));
    res.send(file.data);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function downloadTailoredResumesZip(req, res, next) {
  try {
    await ensureWebModels();
    const ids = clean(req.query.ids)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (!ids.length) {
      res.status(400).json({ error: 'Choose at least one resume to download' });
      return;
    }

    const files = [];
    const failures = [];
    for (const id of ids) {
      try {
        const tailoredResume = await readyTailoredResumeForUser(req, id);
        const file = await fetchTailoredResumeFile(tailoredResume);
        await markTailoredResumeDownloaded(tailoredResume);
        files.push(file);
      } catch (error) {
        failures.push({ id, message: error.message || 'Download failed' });
      }
    }

    if (!files.length) {
      res.status(404).json({
        error: failures.length ? `No resumes could be downloaded: ${failures.map((failure) => failure.message).join('; ')}` : 'No ready resumes found',
      });
      return;
    }

    const nameCounts = new Map();
    const zipFiles = files.map((file) => ({ name: uniqueZipName(file.filename, nameCounts), data: file.data }));
    if (failures.length) {
      zipFiles.push({
        name: 'download-errors.txt',
        data: Buffer.from(
          [
            'Some resumes could not be included in this download.',
            '',
            ...failures.map((failure) => `Resume ${failure.id}: ${failure.message}`),
            '',
          ].join('\n'),
        ),
      });
    }
    const zip = buildZip(zipFiles);
    res.setHeader('content-type', 'application/zip');
    res.setHeader('content-disposition', 'attachment; filename="tailored-resumes.zip"');
    res.setHeader('content-length', String(zip.length));
    res.send(zip);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

async function markTailoredResumeDownloaded(tailoredResume) {
  if (!tailoredResume.downloadedAt) {
    await tailoredResume.update({ downloadedAt: new Date() });
  }
}

export async function createJobBid(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await accessibleProfile(req, req.body?.profileId);
    if (!ensureProfileBidEligible(profile, res)) return;
    const job = await getScrapedJobModel().findByPk(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const now = new Date();
    const attrs = bidAttributesFromBody(req.body);
    if (rejectReviewStatusForNonAdmin(req, res, attrs)) return;
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (!isAdminRole(req.user)) delete attrs.callerUserId;

    const bid = await getJobBidModel().create({
      ...bidUpdateValuesFromAttrs(attrs),
      userId: user.id,
      profileId: profile.id,
      jobId: job.id,
      bidAt: now,
      ...(attrs.status === 'interviewing' ? { interviewAt: now } : {}),
      updatedAt: now,
    });
    if (['interviewing', 'won', 'lost'].includes(attrs.status)) {
      await upsertInterviewForBid({ bid, job, attrs, userId: user.id });
    }
    res.status(201).json({ bid: formatBid(bid) });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'This profile already has a bid for this job' });
      return;
    }
    handleInputError(error, res, next);
  }
}

export async function bulkUpdateJobBids(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const items = batchApplicationItems(req.body?.items);
    const updatesBody = req.body?.updates || req.body || {};
    const attrs = bidAttributesFromBody(updatesBody);
    pruneAttrsForProvidedBidFields(attrs, updatesBody);
    if (rejectReviewStatusForNonAdmin(req, res, attrs)) return;
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (!isAdminRole(req.user)) delete attrs.callerUserId;

    const profileId = clean(req.body?.profileId);
    const profile = profileId ? await accessibleProfile(req, profileId) : null;
    if (profile && !ensureProfileBidEligible(profile, res)) return;
    const JobBid = getJobBidModel();
    const ScrapedJob = getScrapedJobModel();
    const results = [];

    for (const item of items) {
      try {
        let bid = item.bidId ? await JobBid.findByPk(item.bidId) : null;
        let job = item.jobId ? await ScrapedJob.findByPk(item.jobId) : null;

        if (bid && !job) job = await ScrapedJob.findByPk(bid.jobId);
        if (!bid && !job) {
          results.push({ jobId: item.jobId ? String(item.jobId) : null, bidId: item.bidId ? String(item.bidId) : null, ok: false, error: 'Job or bid not found' });
          continue;
        }

        if (bid) {
          await ensureBidBatchWritable({ req, res, user, bid, attrs });
          if (res.headersSent) return;
          bid = await applyBidUpdates({ bid, attrs });
        } else {
          if (!profile) throw new InputError('profileId is required when creating applications');
          if (attrs.callerUserId && !isAdminRole(req.user)) delete attrs.callerUserId;
          bid = await createBidForBatch({ user, profile, job, attrs });
        }

        if (['interviewing', 'won', 'lost'].includes(attrs.status)) {
          await upsertInterviewForBid({ bid, job, attrs, userId: bid.userId });
        }
        results.push({ jobId: String(bid.jobId), bidId: String(bid.id), ok: true, bid: formatBid(bid) });
      } catch (error) {
        results.push({
          jobId: item.jobId ? String(item.jobId) : null,
          bidId: item.bidId ? String(item.bidId) : null,
          ok: false,
          error: error.message || 'Application update failed',
        });
      }
    }

    res.json({
      requested: items.length,
      updated: results.filter((result) => result.ok).length,
      results,
    });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createManualInterview(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profile = await interviewWriteProfileForUser(user, req.body?.profileId);
    const title = clean(req.body?.title);
    const company = clean(req.body?.company);
    const jobUrl = clean(req.body?.url || req.body?.jobUrl);
    if (!title) {
      res.status(400).json({ error: 'Job title is required' });
      return;
    }
    if (!company) {
      res.status(400).json({ error: 'Company is required' });
      return;
    }
    if (jobUrl && !validHttpUrl(jobUrl)) {
      res.status(400).json({ error: 'Job link must be a valid URL' });
      return;
    }

    const attrs = bidAttributesFromBody({ ...req.body, status: 'interviewing' });
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (!isAdminRole(req.user)) delete attrs.callerUserId;

    const interview = await getInterviewModel().create({
      ...interviewValuesFromAttrs(attrs),
      userId: user.id,
      profileId: profile.id,
      title,
      company,
      location: clean(req.body?.location) || null,
      jobUrl: jobUrl || null,
    });
    await logInterviewCreated(interview, user.id);

    res.status(201).json({
      job: formatInterviewAsJob(interview),
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'This profile already has a bid for this job' });
      return;
    }
    handleInputError(error, res, next);
  }
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function readyTailoredResumeForUser(req, id) {
  const tailoredResume = await getTailoredResumeModel().findOne({
    where: { id, status: 'ready' },
  });

  await logTailoredResumeDownloadRow(id, tailoredResume);
  console.log(
    'Loaded tailored_resume for download:',
    JSON.stringify({
      id: tailoredResume?.id || id,
      status: tailoredResume?.status || null,
      profileId: tailoredResume?.profileId || null,
      jobUrl: tailoredResume?.jobUrl || null,
      filePath: tailoredResume?.filePath || null,
    }),
  );

  if (!tailoredResume || !tailoredResume.filePath) {
    throw new NotFoundError('Ready resume not found');
  }
  await ensureTailoredResumeAccess(req, tailoredResume);

  return tailoredResume;
}

async function ensureTailoredResumeAccess(req, tailoredResume) {
  const user = await currentDbUser(req);
  if (user.role !== 'caller') {
    await accessibleProfile(req, tailoredResume.profileId);
    return;
  }
  const assignment = await getInterviewModel().findOne({
    where: {
      profileId: tailoredResume.profileId,
      jobUrl: tailoredResume.jobUrl,
      callerUserId: user.id,
    },
  });
  if (!assignment) throw new NotFoundError('Ready resume not found');
}

async function logTailoredResumeDownloadRow(id, tailoredResume) {
  const [rows] = await getSequelize().query(
    `
    SELECT to_jsonb(tailored_resumes) AS row
    FROM tailored_resumes
    WHERE id = :id
    LIMIT 1
    `,
    { replacements: { id } },
  );

  console.log(
    'Raw tailored_resumes row for download:',
    JSON.stringify({
      id,
      sequelizeFilePath: tailoredResume?.filePath || null,
      row: rows[0]?.row || null,
    }),
  );
}

async function fetchTailoredResumeFile(tailoredResume) {
  const filePath = String(tailoredResume.filePath);
  const candidates = getTailoredResumeS3Candidates(filePath);

  console.log(
    'Resolved tailored resume S3 candidates:',
    JSON.stringify({
      tailoredResumeId: tailoredResume.id,
      filePath,
      candidates,
    }),
  );

  for (const s3Details of candidates) {
    try {
      return await fetchTailoredResumeFromS3(s3Details.bucket, s3Details.key, tailoredResume);
    } catch (error) {
      if (!isMissingStorageObjectError(error)) throw error;
      console.warn(
        'Tailored resume S3 candidate was not found:',
        JSON.stringify({
          tailoredResumeId: tailoredResume.id,
          bucket: s3Details.bucket,
          key: s3Details.key,
        }),
      );
    }
  }

  throw new NotFoundError('Resume file is not stored in S3');
}

function getTailoredResumeS3Candidates(filePath) {
  const candidates = [
    getExplicitS3Details(filePath),
    getS3UrlDetails(filePath),
    ...getConfiguredS3Details(filePath),
  ].filter(Boolean);
  const seen = new Set();

  return candidates.filter(({ bucket, key }) => {
    const candidateKey = `${bucket}/${key}`;
    if (seen.has(candidateKey)) return false;
    seen.add(candidateKey);
    return true;
  });
}

function getExplicitS3Details(filePath) {
  if (!filePath) return null;
  if (!filePath.startsWith('s3://')) return null;

  try {
    const url = new URL(filePath);
    const bucket = url.hostname;
    const key = url.pathname.replace(/^\//, '');
    return bucket && key ? { bucket, key } : null;
  } catch {
    return null;
  }
}

function getS3UrlDetails(filePath) {
  if (!filePath || !/^https?:\/\//i.test(filePath)) return null;

  try {
    const url = new URL(filePath);
    const virtualHostedMatch = url.hostname.match(/^(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i);
    if (virtualHostedMatch) {
      const bucket = virtualHostedMatch[1];
      const key = decodeURIComponent(url.pathname.replace(/^\//, ''));
      return bucket && key ? { bucket, key } : null;
    }
    if (/^s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname)) {
      const [bucket, ...keyParts] = url.pathname.replace(/^\//, '').split('/');
      const key = decodeURIComponent(keyParts.join('/'));
      return bucket && key ? { bucket, key } : null;
    }
  } catch {
    return null;
  }

  return null;
}

function getConfiguredS3Details(filePath) {
  if (!filePath || !ENV.AWS_S3_BUCKET) return [];
  const key = String(filePath).trim().replace(/^\/+/, '');
  return key ? [{ bucket: ENV.AWS_S3_BUCKET, key }] : [];
}

async function fetchTailoredResumeFromS3(bucket, key, tailoredResume) {
  let response;
  try {
    response = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (isMissingStorageObjectError(error)) throw new NotFoundError('Resume file not found');
    throw error;
  }
  const body = response.Body;
  if (!body) {
    throw new NotFoundError('Resume file not found');
  }

  const data = await streamToBuffer(body);
  return {
    filename: filenameFromPath(key),
    contentType: response.ContentType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    data,
  };
}

function isMissingStorageObjectError(error) {
  return (
    error instanceof NotFoundError ||
    error?.name === 'NoSuchKey' ||
    error?.name === 'NotFound' ||
    error?.$metadata?.httpStatusCode === 404
  );
}

async function streamToBuffer(body) {
  if (body instanceof Buffer) return body;
  if (body instanceof Readable) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

let s3Client;
function getS3Client() {
  if (s3Client) return s3Client;
  s3Client = new S3Client({ region: ENV.AWS_REGION });
  return s3Client;
}

function filenameFromPath(filePath) {
  return sanitizeFilename(String(filePath).split('/').pop() || 'resume.docx');
}

function sanitizeFilename(value) {
  return String(value || 'resume.docx').replace(/[/\\?%*:|"<>]/g, '_') || 'resume.docx';
}

function escapeHeaderValue(value) {
  return sanitizeFilename(value).replace(/"/g, '\\"');
}

function uniqueZipName(filename, nameCounts) {
  const index = (nameCounts.get(filename) || 0) + 1;
  nameCounts.set(filename, index);
  if (index === 1) return filename;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return `${filename}-${index}`;
  return `${filename.slice(0, dotIndex)}-${index}${filename.slice(dotIndex)}`;
}

function formatProfileShareRequest(row) {
  return {
    id: row.id,
    profileId: row.profileId,
    ownerUserId: row.ownerUserId,
    recipientUserId: row.recipientUserId,
    status: row.status,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    profile: row.profile ? formatProfile(row.profile) : null,
    owner: row.owner ? { id: row.owner.id, username: row.owner.username } : null,
    recipient: row.recipient ? { id: row.recipient.id, username: row.recipient.username } : null,
  };
}

function formatTailoringRequest(row) {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    jobUrl: row.job_url,
    requestType: row.request_type || 'job',
    manualCompany: row.manual_company,
    manualRole: row.manual_role,
    manualJobDescription: row.manual_job_description,
    status: row.status,
    filePath: row.file_path,
    readyAt: row.ready_at,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    deadLetterAt: row.dead_letter_at,
    downloadedAt: row.downloaded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requester: row.user_id
      ? {
          id: row.user_id,
          username: row.requester_username || 'Unknown user',
        }
      : null,
    profile: row.profile_id
      ? {
          id: row.profile_id,
          name: row.profile_name || 'Untitled profile',
          ownerUserId: row.profile_owner_user_id,
          ownerUsername: row.profile_owner_username || 'Unknown owner',
        }
      : null,
    job: {
      id: row.job_id,
      title: row.title || row.manual_role || 'Untitled role',
      company: row.company || row.manual_company || 'Unknown company',
      location: row.location,
      source: row.request_type === 'manual' ? 'Manual' : row.source,
      postedAt: row.posted_at,
      scrapedAt: row.scraped_at,
      url: validHttpUrl(row.job_url) ? row.job_url : '',
    },
    review: resumeTailoringReview(row),
  };
}

function resumeTailoringReview(row) {
  const resumeText = clean(row.profile_resume_text);
  const jobText = clean(row.listing_text || row.manual_job_description);
  const keywords = extractReviewKeywords(jobText);
  const resumeTextLower = resumeText.toLowerCase();
  const covered = keywords.filter((keyword) => resumeTextLower.includes(keyword.toLowerCase()));
  const missing = keywords.filter((keyword) => !resumeTextLower.includes(keyword.toLowerCase()));
  const coverage = keywords.length ? covered.length / keywords.length : null;
  const truthfulnessFlags = resumeTruthfulnessFlags({ resumeText, jobText, row });
  const confidence = reviewConfidence({ status: row.status, coverage, truthfulnessFlags, hasResume: Boolean(resumeText), hasJobText: Boolean(jobText) });

  return {
    approval: {
      status: row.status === 'ready' ? (truthfulnessFlags.length ? 'needs_review' : 'pending_approval') : 'not_ready',
      downloadedAt: row.downloaded_at ? new Date(row.downloaded_at).toISOString() : null,
      nextAction: row.status === 'ready' ? 'Review keyword coverage and truthfulness before approving download/use.' : 'Wait for the tailored resume to be ready.',
    },
    confidence,
    atsKeywordCoverage: coverage === null
      ? null
      : {
          score: Number(coverage.toFixed(2)),
          covered,
          missing,
          total: keywords.length,
        },
    beforeAfterDiff: {
      baseline: resumeText ? 'profile_resume' : 'missing_profile_resume',
      target: jobText ? 'job_description' : 'missing_job_description',
      likelyAddedKeywords: missing.slice(0, 12),
      alreadyCoveredKeywords: covered.slice(0, 12),
    },
    truthfulness: {
      status: truthfulnessFlags.length ? 'needs_review' : 'clear',
      flags: truthfulnessFlags,
    },
  };
}

function extractReviewKeywords(value) {
  const text = String(value || '').toLowerCase();
  const phrases = [
    'react', 'node', 'typescript', 'javascript', 'python', 'java', 'aws', 'gcp', 'azure',
    'postgresql', 'mysql', 'mongodb', 'graphql', 'rest', 'kubernetes', 'docker',
    'terraform', 'ci/cd', 'machine learning', 'data engineering', 'etl', 'spark',
    'leadership', 'stakeholder', 'communication', 'agile', 'security', 'testing',
  ];
  const found = phrases.filter((phrase) => text.includes(phrase));
  const repeatedTerms = [...text.matchAll(/\b[a-z][a-z0-9+#.-]{2,}\b/g)]
    .map(([term]) => term)
    .filter((term) => !COMMON_REVIEW_TERMS.has(term))
    .reduce((counts, term) => counts.set(term, (counts.get(term) || 0) + 1), new Map());
  const frequent = [...repeatedTerms.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])
    .map(([term]) => term);
  return [...new Set([...found, ...frequent])].slice(0, 24);
}

function resumeTruthfulnessFlags({ resumeText, jobText, row }) {
  const flags = [];
  if (!resumeText) flags.push({ type: 'missing_source_resume', message: 'Profile resume text is missing, so claims cannot be checked.' });
  if (!jobText) flags.push({ type: 'missing_job_description', message: 'Job description text is missing, so ATS coverage is incomplete.' });
  if (row.request_type === 'manual' && clean(row.manual_job_description).length < 400) {
    flags.push({ type: 'short_manual_job_description', message: 'Manual job description is short; generated tailoring may lean on incomplete context.' });
  }
  if (resumeText && jobText) {
    const jobSeniority = seniorityTerms(jobText);
    const resumeSeniority = seniorityTerms(resumeText);
    if (jobSeniority.has('manager') && !resumeSeniority.has('manager') && !resumeSeniority.has('lead')) {
      flags.push({ type: 'seniority_gap', message: 'Job appears manager-level but profile resume does not show manager or lead experience.' });
    }
  }
  return flags;
}

function reviewConfidence({ status, coverage, truthfulnessFlags, hasResume, hasJobText }) {
  let score = status === 'ready' ? 0.72 : 0.45;
  if (coverage !== null) score += Math.min(coverage, 1) * 0.18;
  if (hasResume) score += 0.05;
  if (hasJobText) score += 0.05;
  score -= truthfulnessFlags.length * 0.08;
  return Math.max(0.05, Math.min(0.98, Number(score.toFixed(2))));
}

function seniorityTerms(value) {
  const text = String(value || '').toLowerCase();
  return new Set(['lead', 'manager', 'principal', 'staff', 'senior'].filter((term) => text.includes(term)));
}

const COMMON_REVIEW_TERMS = new Set([
  'and', 'the', 'for', 'with', 'you', 'our', 'are', 'will', 'this', 'that', 'from', 'have',
  'has', 'your', 'job', 'role', 'team', 'work', 'who', 'can', 'all', 'not', 'but', 'about',
  'experience', 'years', 'skills', 'using', 'build', 'building', 'develop', 'developing',
]);

function buildDailyApplications(rows, timeZone) {
  const emptySeries = buildEmptyDailyApplications(timeZone);
  const byUserId = new Map();
  for (const row of rows) {
    const userId = String(row.user_id);
    if (!byUserId.has(userId)) {
      byUserId.set(userId, emptySeries.map((item) => ({ ...item, sources: [...item.sources] })));
    }
    const series = byUserId.get(userId);
    const day = series.find((item) => item.date === row.day);
    if (day) {
      const applications = Number(row.applications || 0);
      day.applications += applications;
      day.sources.push({
        source: row.source || 'Unknown',
        applications,
      });
    }
  }
  return byUserId;
}

function buildEmptyDailyApplications(timeZone) {
  return Array.from({ length: 14 }, (_item, index) => {
    return {
      date: localDateKeyDaysAgo(13 - index, new Date(), { timeZone }),
      applications: 0,
      sources: [],
    };
  });
}

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
    if (!isAdminRole(req.user)) {
      const profile = await accessibleProfile(req, bid.profileId);
      if (isLegacyProfile(profile) && !isInterviewBidStatus(attrs.status || bid.status)) {
        res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding' });
        return;
      }
      if (!PRIVILEGED_USER_ROLES.includes(user.role) && String(bid.userId) !== String(user.id)) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }
      delete attrs.callerUserId;
    } else {
      const profile = await getBidProfileModel().findByPk(bid.profileId);
      if (isLegacyProfile(profile) && !isInterviewBidStatus(attrs.status || bid.status)) {
        res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding' });
        return;
      }
    }
    const now = new Date();
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
    res.json({ bid: formatBid(bid) });
  } catch (error) {
    handleInputError(error, res, next);
  }
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
    const attrs = bidAttributesFromBody({ ...req.body, status: req.body?.status || interview.status });
    if (attrs.callerUserId) await ensureCallerUser(attrs.callerUserId);
    if (!isAdminRole(req.user)) {
      await interviewWriteProfileForUser(user, interview.profileId, 'Interview not found');
      delete attrs.callerUserId;
    }
    const previous = interviewSnapshot(interview);
    const now = new Date();
    await interview.update({ ...interviewValuesFromAttrs(attrs, interview), updatedAt: now });
    await logInterviewChanges({ interview, previous, attrs, userId: user.id });
    if (interview.jobBidId) {
      const bid = await getJobBidModel().findByPk(interview.jobBidId);
      if (bid) {
        const bidUpdates = { ...bidUpdateValuesFromAttrs(attrs), updatedAt: now };
        if (shouldRefreshBidAtForStatus(attrs.status, bid.status)) bidUpdates.bidAt = now;
        if (shouldSetInterviewAtForStatus(attrs.status, bid.status, bid.interviewAt)) bidUpdates.interviewAt = now;
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

async function ensureCallerUser(callerUserId) {
  const caller = await getWebUserModel().findOne({ where: { id: callerUserId, role: 'caller' } });
  if (!caller) throw new NotFoundError('Caller not found');
  return caller;
}

function batchApplicationItems(value) {
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

function numericBatchIds(value, label) {
  const ids = Array.isArray(value) ? value.map(numericBatchId).filter(Boolean) : [];
  const deduped = [...new Set(ids)];
  if (!deduped.length) throw new InputError(`${label} must include at least one job`);
  if (deduped.length > BATCH_LIMIT) throw new InputError(`${label} cannot include more than ${BATCH_LIMIT} jobs`);
  return deduped;
}

function numericBatchId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function ensureBidBatchWritable({ req, res, user, bid, attrs }) {
  if (!isAdminRole(req.user)) {
    const profile = await accessibleProfile(req, bid.profileId);
    if (isLegacyProfile(profile) && !isInterviewBidStatus(attrs.status || bid.status)) {
      res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding' });
      return;
    }
    if (!PRIVILEGED_USER_ROLES.includes(user.role) && String(bid.userId) !== String(user.id)) {
      throw new NotFoundError('Bid not found');
    }
    return;
  }

  const profile = await getBidProfileModel().findByPk(bid.profileId);
  if (isLegacyProfile(profile) && !isInterviewBidStatus(attrs.status || bid.status)) {
    res.status(403).json({ error: 'Legacy profiles can register interviews, but cannot be used for bidding' });
  }
}

async function createBidForBatch({ user, profile, job, attrs }) {
  const now = new Date();
  const createAttrs = { ...attrs, status: attrs.status || 'queued' };
  return getJobBidModel().create({
    ...bidUpdateValuesFromAttrs(createAttrs),
    userId: user.id,
    profileId: profile.id,
    jobId: job.id,
    bidAt: now,
    ...(createAttrs.status === 'interviewing' ? { interviewAt: now } : {}),
    updatedAt: now,
  });
}

async function applyBidUpdates({ bid, attrs }) {
  const now = new Date();
  const updates = { ...bidUpdateValuesFromAttrs(attrs), updatedAt: now };
  if (shouldRefreshBidAtForStatus(attrs.status, bid.status)) {
    updates.bidAt = now;
  }
  if (shouldSetInterviewAtForStatus(attrs.status, bid.status, bid.interviewAt)) {
    updates.interviewAt = now;
  }
  await bid.update(updates);
  return bid;
}

async function interviewWriteProfileForUser(user, profileId, notFoundMessage = 'Profile not found') {
  const id = clean(profileId);
  if (!id) throw new InputError('Profile is required');

  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError(notFoundMessage);
  if (canWriteInterviewForProfile(user, profile)) return profile;
  throw new NotFoundError(notFoundMessage);
}

export function canWriteInterviewForProfile(user, profile) {
  if (!canAccessInterviews(user)) return false;
  if (isAdminRole(user)) return true;
  if (user?.role === 'caller') return false;
  return String(profile?.userId || '') === String(user?.id || '');
}

function formatCallerAssignment(row) {
  return {
    id: row.id,
    profileId: row.profileId,
    jobId: row.jobId,
    status: row.status,
    interviewStage: row.interviewStage,
    interviewNextAt: row.interviewNextAt,
    interviewDurationMinutes: row.interviewDurationMinutes || 60,
    interviewNotes: row.interviewNotes,
    stageMeetingLinks: row.stageMeetingLinks || {},
    meetingLink: meetingLinkForStage(row.stageMeetingLinks, row.interviewStage),
    updatedAt: row.updatedAt,
    job: row.job ? formatJob(row.job) : {
      id: row.jobId,
      title: row.title,
      company: row.company,
      location: row.location,
      url: row.jobUrl,
    },
    profile: row.profile ? formatProfile(row.profile) : null,
  };
}

function interviewValuesFromAttrs(attrs, existing = null) {
  const stage = attrs.interviewStage || existing?.interviewStage || 'todo';
  const stageNotes = normalizeInterviewStageNotes({
    currentStage: stage,
    currentNote: attrs.hasInterviewNotes ? attrs.interviewNotes : undefined,
    existingNotes: existing?.stageNotes,
    incomingNotes: attrs.stageNotes,
  });
  const stageMeetingLinks = normalizeInterviewStageMeetingLinks({
    currentStage: stage,
    currentLink: attrs.interviewMeetingLink,
    existingLinks: existing?.stageMeetingLinks,
    incomingLinks: attrs.stageMeetingLinks,
  });
  const interviewNextAt = attrs.interviewNextAt || null;
  return {
    callerUserId: attrs.callerUserId ?? null,
    status: attrs.status || 'interviewing',
    interviewStage: stage,
    interviewNextAt,
    interviewDurationMinutes: attrs.interviewDurationMinutes || existing?.interviewDurationMinutes || 60,
    firstInterviewScheduledAt: existing?.firstInterviewScheduledAt || interviewNextAt,
    interviewNotes: stageNotes[stage] || attrs.interviewNotes || null,
    stageNotes,
    stageMeetingLinks,
  };
}

function rejectReviewStatusForNonAdmin(req, res, attrs) {
  if (!REVIEW_BID_STATUSES.has(attrs.status) || isAdminRole(req.user)) return false;
  res.status(403).json({ error: 'Admin access is required' });
  return true;
}

function bidUpdateValuesFromAttrs(attrs) {
  return {
    ...(Object.prototype.hasOwnProperty.call(attrs, 'status') ? { status: attrs.status } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'bidAmount') ? { bidAmount: attrs.bidAmount } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'callerUserId') ? { callerUserId: attrs.callerUserId } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'coverLetter') ? { coverLetter: attrs.coverLetter } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'notes') ? { notes: attrs.notes } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'interviewStage') ? { interviewStage: attrs.interviewStage } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'interviewNextAt') ? { interviewNextAt: attrs.interviewNextAt } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'interviewDurationMinutes')
      ? { interviewDurationMinutes: attrs.interviewDurationMinutes }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'interviewNotes') ? { interviewNotes: attrs.interviewNotes } : {}),
    ...(Object.prototype.hasOwnProperty.call(attrs, 'stageMeetingLinks')
      ? { stageMeetingLinks: attrs.stageMeetingLinks }
      : {}),
  };
}

function pruneAttrsForProvidedBidFields(attrs, body = {}) {
  const optionalFields = [
    'status',
    'bidAmount',
    'coverLetter',
    'notes',
    'interviewStage',
    'interviewNextAt',
    'interviewNotes',
  ];
  optionalFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) delete attrs[field];
  });
  if (
    !Object.prototype.hasOwnProperty.call(body, 'interviewDurationMinutes') &&
    !Object.prototype.hasOwnProperty.call(body, 'interviewDuration')
  ) {
    delete attrs.interviewDurationMinutes;
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'stageMeetingLinks')) delete attrs.stageMeetingLinks;
}

async function upsertInterviewForBid({ bid, job, attrs, userId }) {
  if (!job) return null;
  const values = {
    ...interviewValuesFromAttrs(attrs),
    userId,
    profileId: bid.profileId,
    jobId: bid.jobId,
    jobBidId: bid.id,
    title: job.title || 'Untitled role',
    company: job.company || 'Unknown company',
    location: job.location || null,
    jobUrl: job.url || null,
  };
  const existing = await getInterviewModel().findOne({ where: { jobBidId: bid.id } });
  if (existing) {
    const previous = interviewSnapshot(existing);
    await existing.update(interviewValuesFromAttrs(attrs, existing));
    await logInterviewChanges({ interview: existing, previous, attrs, userId });
    return existing;
  }
  const interview = await getInterviewModel().create(values);
  await logInterviewCreated(interview, userId);
  return interview;
}

function formatInterviewAsJob(interview, bidUsersById = new Map(), callerUsersById = new Map(), tailoredResume = null) {
  return {
    id: `interview-${interview.id}`,
    interviewId: interview.id,
    title: interview.title,
    company: interview.company,
    location: interview.location,
    url: interview.jobUrl,
    source: interview.jobId ? 'Application' : 'Manual',
    sourceUrl: interview.jobUrl,
    listingText: interview.interviewNotes,
    isSpam: false,
    isHidden: false,
    updatedAt: interview.updatedAt,
    tailoredResume,
    bid: formatInterviewBid(interview, bidUsersById, callerUsersById),
  };
}

function formatInterviewBid(interview, bidUsersById = new Map(), callerUsersById = new Map()) {
  const bidUser = bidUsersById.get?.(String(interview.userId));
  const callerUser = callerUsersById.get?.(String(interview.callerUserId));
  return {
    id: interview.id,
    isInterview: true,
    userId: interview.userId,
    callerUserId: interview.callerUserId,
    profileId: interview.profileId,
    jobId: interview.jobId,
    jobBidId: interview.jobBidId,
    status: interview.status,
    bidAmount: null,
    coverLetter: null,
    notes: null,
    interviewStage: interview.interviewStage,
    interviewNextAt: interview.interviewNextAt,
    interviewDurationMinutes: interview.interviewDurationMinutes || 60,
    firstInterviewScheduledAt: interview.firstInterviewScheduledAt,
    interviewNotes: interview.interviewNotes,
    stageNotes: interview.stageNotes || {},
    stageMeetingLinks: interview.stageMeetingLinks || {},
    meetingLink: meetingLinkForStage(interview.stageMeetingLinks, interview.interviewStage),
    logs: (interview.logs || interview.get?.('logs') || []).map(formatInterviewLog),
    bidAt: interview.createdAt,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
    ...(bidUser ? { user: { id: bidUser.id, username: bidUser.username, role: bidUser.role } } : {}),
    ...(callerUser ? { callerUser } : {}),
  };
}

async function interviewLogsByInterviewId(interviews) {
  const interviewIds = interviews.map((interview) => interview.id).filter(Boolean);
  if (!interviewIds.length) return new Map();
  const logs = await getInterviewLogModel().findAll({
    where: { interviewId: interviewIds },
    order: [
      ['interviewId', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
  const byInterviewId = new Map(interviewIds.map((id) => [String(id), []]));
  for (const log of logs) {
    byInterviewId.get(String(log.interviewId))?.push(log);
  }
  return byInterviewId;
}

function normalizeInterviewStageNotes({ currentStage, currentNote, existingNotes, incomingNotes }) {
  const notes = { ...((existingNotes && typeof existingNotes === 'object') ? existingNotes : {}) };
  if (incomingNotes && typeof incomingNotes === 'object') {
    for (const [stage, note] of Object.entries(incomingNotes)) {
      const cleaned = clean(note);
      if (cleaned) notes[stage] = cleaned;
      else delete notes[stage];
    }
  }
  if (currentNote !== undefined) {
    const cleaned = clean(currentNote);
    if (cleaned) notes[currentStage] = cleaned;
    else if (currentNote !== undefined) delete notes[currentStage];
  }
  return notes;
}

function normalizeInterviewStageMeetingLinks({ currentStage, currentLink, existingLinks, incomingLinks }) {
  const links = { ...((existingLinks && typeof existingLinks === 'object') ? existingLinks : {}) };
  if (incomingLinks && typeof incomingLinks === 'object') {
    for (const [stage, link] of Object.entries(incomingLinks)) {
      const cleaned = clean(link);
      if (cleaned) links[stage] = cleaned;
      else delete links[stage];
    }
  }
  if (currentLink !== undefined) {
    const cleaned = clean(currentLink);
    if (cleaned) links[currentStage] = cleaned;
    else delete links[currentStage];
  }
  return links;
}

function interviewSnapshot(interview) {
  return {
    interviewStage: interview.interviewStage,
    interviewNextAt: interview.interviewNextAt,
    firstInterviewScheduledAt: interview.firstInterviewScheduledAt,
    stageNotes: { ...((interview.stageNotes && typeof interview.stageNotes === 'object') ? interview.stageNotes : {}) },
    stageMeetingLinks: { ...((interview.stageMeetingLinks && typeof interview.stageMeetingLinks === 'object') ? interview.stageMeetingLinks : {}) },
  };
}

async function logInterviewCreated(interview, userId) {
  await getInterviewLogModel().create({
    interviewId: interview.id,
    userId,
    eventType: 'created',
    toValue: interview.interviewStage,
    metadata: { stage: interview.interviewStage },
  });
  if (interview.firstInterviewScheduledAt) {
    await getInterviewLogModel().create({
      interviewId: interview.id,
      userId,
      eventType: 'first_scheduled',
      toValue: interview.firstInterviewScheduledAt.toISOString(),
      metadata: { stage: interview.interviewStage },
    });
  }
}

async function logInterviewChanges({ interview, previous, attrs, userId }) {
  const logs = [];
  if (previous.interviewStage !== interview.interviewStage) {
    logs.push({
      eventType: 'stage_changed',
      fromValue: previous.interviewStage,
      toValue: interview.interviewStage,
      metadata: {},
    });
  }
  if (dateValue(previous.interviewNextAt) !== dateValue(interview.interviewNextAt)) {
    logs.push({
      eventType: 'schedule_changed',
      fromValue: dateValue(previous.interviewNextAt),
      toValue: dateValue(interview.interviewNextAt),
      metadata: { stage: interview.interviewStage },
    });
  }
  if (!previous.firstInterviewScheduledAt && interview.firstInterviewScheduledAt) {
    logs.push({
      eventType: 'first_scheduled',
      fromValue: null,
      toValue: dateValue(interview.firstInterviewScheduledAt),
      metadata: { stage: interview.interviewStage },
    });
  }
  const changedNoteStages = changedStageNoteKeys(previous.stageNotes, interview.stageNotes || {});
  for (const stage of changedNoteStages) {
    logs.push({
      eventType: 'stage_note_changed',
      fromValue: previous.stageNotes[stage] || null,
      toValue: interview.stageNotes?.[stage] || null,
      metadata: { stage },
    });
  }
  const changedMeetingLinkStages = changedStageNoteKeys(previous.stageMeetingLinks, interview.stageMeetingLinks || {});
  for (const stage of changedMeetingLinkStages) {
    logs.push({
      eventType: 'stage_meeting_link_changed',
      fromValue: previous.stageMeetingLinks[stage] || null,
      toValue: interview.stageMeetingLinks?.[stage] || null,
      metadata: { stage },
    });
  }
  if (!logs.length) return;
  await getInterviewLogModel().bulkCreate(
    logs.map((log) => ({
      ...log,
      interviewId: interview.id,
      userId,
      metadata: { ...(log.metadata || {}), source: attrs.status || interview.status },
    })),
  );
}

function meetingLinkForStage(stageMeetingLinks, stage) {
  if (!stageMeetingLinks || typeof stageMeetingLinks !== 'object') return '';
  return clean(stageMeetingLinks[stage]) || '';
}

function changedStageNoteKeys(previousNotes, nextNotes) {
  const keys = new Set([...Object.keys(previousNotes || {}), ...Object.keys(nextNotes || {})]);
  return [...keys].filter((key) => clean(previousNotes?.[key]) !== clean(nextNotes?.[key]));
}

function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatInterviewLog(log) {
  return {
    id: log.id,
    eventType: log.eventType,
    fromValue: log.fromValue,
    toValue: log.toValue,
    metadata: log.metadata || {},
    createdAt: log.createdAt,
  };
}
