import { QueryTypes } from 'sequelize';
import { ensureWebModels, getSequelize } from '../../../../db.js';
import { localDaySql, normalizeTimeZone } from '../../../utils/localTime.js';

const APPLICATION_STATUSES = ['submitted', 'interviewing', 'won', 'lost'];
const ACTIVE_TAILORING_STATUSES = ['requested', 'processing', 'ready', 'dead_letter'];
const ACTIVE_PROFILE_STATUS = 'active';
const ACTIVE_INTERVIEW_STATUS = 'interviewing';

export async function getPersonalDashboardMetrics(user) {
  await ensureWebModels();

  const sequelize = getSequelize();
  const timeZone = normalizeTimeZone(user?.timezone);
  const replacements = {
    userId: user.id,
    applicationStatuses: APPLICATION_STATUSES,
    activeTailoringStatuses: ACTIVE_TAILORING_STATUSES,
  };

  const sql = personalDashboardQueries(timeZone);
  const [overall, trend, upcomingInterviews, recentApplications, profiles] = await Promise.all([
    queryOne(sequelize, sql.overall, replacements),
    queryAll(sequelize, sql.trend, replacements),
    queryAll(sequelize, sql.upcomingInterviews, replacements),
    queryAll(sequelize, sql.recentApplications, replacements),
    queryAll(sequelize, sql.profiles, replacements),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    timeZone,
    user: {
      id: String(user.id),
      username: user.username,
      role: user.role,
      dailyBidGoal: numberOrNull(user.dailyBidGoal),
    },
    totals: formatOverall(overall, user),
    trend: trend.map(formatTrendRow),
    upcomingInterviews: upcomingInterviews.map(formatInterviewRow),
    recentApplications: recentApplications.map(formatApplicationRow),
    profiles: profiles.map(formatProfileRow),
  };
}

function personalDashboardQueries(timeZone) {
  const today = localDaySql('now()', timeZone);
  const overallBidDay = localDaySql('ob.bid_at', timeZone);
  const bidDay = localDaySql('jb.bid_at', timeZone);
  const interviewCreatedDay = localDaySql('i.created_at', timeZone);
  const interviewUpdatedDay = localDaySql('i.updated_at', timeZone);
  const resumeCreatedDay = localDaySql('tr.created_at', timeZone);

  return {
    overall: `
      WITH owned_profiles AS (
        SELECT id, profile_status
        FROM bid_profiles
        WHERE user_id = :userId
      ),
      owned_bids AS (
        SELECT jb.*
        FROM job_bids jb
        JOIN owned_profiles op ON op.id = jb.profile_id
      ),
      owned_interviews AS (
        SELECT i.*
        FROM interviews i
        JOIN owned_profiles op ON op.id = i.profile_id
      ),
      owned_resumes AS (
        SELECT tr.*
        FROM tailored_resumes tr
        JOIN owned_profiles op ON op.id = tr.profile_id
      )
      SELECT
        (SELECT COUNT(*) FROM owned_profiles)::int AS total_profiles,
        (SELECT COUNT(*) FROM owned_profiles WHERE profile_status = '${ACTIVE_PROFILE_STATUS}')::int AS active_profiles,
        (SELECT COUNT(*) FROM owned_bids WHERE status = 'planned')::int AS planned_applications,
        (SELECT COUNT(*) FROM owned_bids WHERE status IN (:applicationStatuses))::int AS total_applications,
        (SELECT COUNT(*) FROM owned_bids ob WHERE status IN (:applicationStatuses) AND ${overallBidDay} = ${today})::int AS today_applications,
        (SELECT COUNT(*) FROM owned_bids ob WHERE status IN (:applicationStatuses) AND ${overallBidDay} >= ${today} - interval '6 days')::int AS week_applications,
        (SELECT COUNT(*) FROM owned_interviews)::int AS total_interviews,
        (SELECT COUNT(*) FROM owned_interviews WHERE status = '${ACTIVE_INTERVIEW_STATUS}')::int AS active_interviews,
        (SELECT COUNT(*) FROM owned_interviews WHERE status = '${ACTIVE_INTERVIEW_STATUS}' AND interview_next_at >= now())::int AS upcoming_interviews,
        (SELECT COUNT(*) FROM owned_interviews WHERE status = 'won')::int AS offers,
        (SELECT COUNT(*) FROM owned_interviews WHERE status = 'lost')::int AS lost_interviews,
        (SELECT COUNT(*) FROM owned_resumes WHERE status IN (:activeTailoringStatuses))::int AS tailored_resume_requests,
        (SELECT COUNT(*) FROM owned_resumes WHERE status = 'ready')::int AS ready_tailored_resumes
    `,
    trend: `
      WITH days AS (
        SELECT generate_series(${today} - interval '13 days', ${today}, interval '1 day') AS bucket_start
      ),
      applications AS (
        SELECT ${bidDay} AS bucket_start, COUNT(*)::int AS count
        FROM job_bids jb
        JOIN bid_profiles p ON p.id = jb.profile_id
        WHERE p.user_id = :userId
          AND jb.status IN (:applicationStatuses)
          AND ${bidDay} >= ${today} - interval '13 days'
        GROUP BY 1
      ),
      interviews_created AS (
        SELECT ${interviewCreatedDay} AS bucket_start, COUNT(*)::int AS count
        FROM interviews i
        JOIN bid_profiles p ON p.id = i.profile_id
        WHERE p.user_id = :userId
          AND ${interviewCreatedDay} >= ${today} - interval '13 days'
        GROUP BY 1
      ),
      interview_outcomes AS (
        SELECT
          ${interviewUpdatedDay} AS bucket_start,
          COUNT(*) FILTER (WHERE i.status = 'won')::int AS offers,
          COUNT(*) FILTER (WHERE i.status = 'lost')::int AS lost_interviews
        FROM interviews i
        JOIN bid_profiles p ON p.id = i.profile_id
        WHERE p.user_id = :userId
          AND i.status IN ('won', 'lost')
          AND ${interviewUpdatedDay} >= ${today} - interval '13 days'
        GROUP BY 1
      ),
      resumes AS (
        SELECT ${resumeCreatedDay} AS bucket_start, COUNT(*)::int AS count
        FROM tailored_resumes tr
        JOIN bid_profiles p ON p.id = tr.profile_id
        WHERE p.user_id = :userId
          AND tr.status IN (:activeTailoringStatuses)
          AND ${resumeCreatedDay} >= ${today} - interval '13 days'
        GROUP BY 1
      )
      SELECT
        to_char(days.bucket_start, 'YYYY-MM-DD') AS date,
        to_char(days.bucket_start, 'Mon DD') AS label,
        COALESCE(applications.count, 0)::int AS applications,
        COALESCE(interviews_created.count, 0)::int AS interviews,
        COALESCE(interview_outcomes.offers, 0)::int AS offers,
        COALESCE(interview_outcomes.lost_interviews, 0)::int AS lost_interviews,
        COALESCE(resumes.count, 0)::int AS tailored_resumes
      FROM days
      LEFT JOIN applications USING (bucket_start)
      LEFT JOIN interviews_created USING (bucket_start)
      LEFT JOIN interview_outcomes USING (bucket_start)
      LEFT JOIN resumes USING (bucket_start)
      ORDER BY days.bucket_start ASC
    `,
    upcomingInterviews: `
      SELECT
        i.id,
        i.title,
        i.company,
        i.location,
        i.status,
        i.interview_stage,
        i.interview_next_at,
        i.interview_duration_minutes,
        i.job_url,
        p.id AS profile_id,
        p.name AS profile_name
      FROM interviews i
      JOIN bid_profiles p ON p.id = i.profile_id
      WHERE p.user_id = :userId
        AND i.status = '${ACTIVE_INTERVIEW_STATUS}'
        AND i.interview_next_at IS NOT NULL
        AND i.interview_next_at >= now()
      ORDER BY i.interview_next_at ASC
      LIMIT 8
    `,
    recentApplications: `
      SELECT
        jb.id,
        jb.status,
        jb.bid_at,
        sj.title,
        sj.company,
        sj.location,
        sj.url,
        p.id AS profile_id,
        p.name AS profile_name
      FROM job_bids jb
      JOIN bid_profiles p ON p.id = jb.profile_id
      JOIN scraped_jobs sj ON sj.id = jb.job_id
      WHERE p.user_id = :userId
        AND jb.status IN (:applicationStatuses)
      ORDER BY jb.bid_at DESC
      LIMIT 8
    `,
    profiles: `
      SELECT
        p.id,
        p.name,
        p.profile_status,
        p.profile_badge,
        p.daily_bid_goal,
        (
          SELECT COUNT(*)::int
          FROM job_bids jb
          WHERE jb.profile_id = p.id
            AND jb.status IN (:applicationStatuses)
        ) AS applications,
        (
          SELECT COUNT(*)::int
          FROM job_bids jb
          WHERE jb.profile_id = p.id
            AND jb.status IN (:applicationStatuses)
            AND ${localDaySql('jb.bid_at', timeZone)} = ${today}
        ) AS today_applications,
        (
          SELECT COUNT(*)::int
          FROM interviews i
          WHERE i.profile_id = p.id
            AND i.status = '${ACTIVE_INTERVIEW_STATUS}'
        ) AS active_interviews,
        (
          SELECT COUNT(*)::int
          FROM interviews i
          WHERE i.profile_id = p.id
            AND i.status = 'won'
        ) AS offers,
        (
          SELECT COUNT(*)::int
          FROM tailored_resumes tr
          WHERE tr.profile_id = p.id
            AND tr.status = 'ready'
        ) AS ready_tailored_resumes
      FROM bid_profiles p
      WHERE p.user_id = :userId
      ORDER BY
        CASE WHEN p.profile_status = '${ACTIVE_PROFILE_STATUS}' THEN 0 ELSE 1 END,
        p.updated_at DESC
      LIMIT 12
    `,
  };
}

async function queryAll(sequelize, sql, replacements) {
  return sequelize.query(sql, { type: QueryTypes.SELECT, replacements });
}

async function queryOne(sequelize, sql, replacements) {
  const rows = await queryAll(sequelize, sql, replacements);
  return rows[0] || {};
}

function formatOverall(row, user) {
  const todayApplications = numberValue(row.today_applications);
  const dailyBidGoal = numberOrNull(user.dailyBidGoal);
  return {
    totalProfiles: numberValue(row.total_profiles),
    activeProfiles: numberValue(row.active_profiles),
    plannedApplications: numberValue(row.planned_applications),
    totalApplications: numberValue(row.total_applications),
    todayApplications,
    weekApplications: numberValue(row.week_applications),
    dailyBidGoal,
    dailyGoalProgress: dailyBidGoal ? todayApplications / dailyBidGoal : null,
    totalInterviews: numberValue(row.total_interviews),
    activeInterviews: numberValue(row.active_interviews),
    upcomingInterviews: numberValue(row.upcoming_interviews),
    offers: numberValue(row.offers),
    lostInterviews: numberValue(row.lost_interviews),
    tailoredResumeRequests: numberValue(row.tailored_resume_requests),
    readyTailoredResumes: numberValue(row.ready_tailored_resumes),
  };
}

function formatTrendRow(row) {
  return {
    date: row.date,
    label: row.label,
    applications: numberValue(row.applications),
    interviews: numberValue(row.interviews),
    offers: numberValue(row.offers),
    lostInterviews: numberValue(row.lost_interviews),
    tailoredResumes: numberValue(row.tailored_resumes),
  };
}

function formatInterviewRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    company: row.company,
    location: row.location,
    status: row.status,
    interviewStage: row.interview_stage,
    interviewNextAt: row.interview_next_at ? new Date(row.interview_next_at).toISOString() : null,
    interviewDurationMinutes: numberValue(row.interview_duration_minutes),
    jobUrl: row.job_url,
    profileId: row.profile_id ? String(row.profile_id) : null,
    profileName: row.profile_name,
  };
}

function formatApplicationRow(row) {
  return {
    id: String(row.id),
    status: row.status,
    bidAt: row.bid_at ? new Date(row.bid_at).toISOString() : null,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    profileId: row.profile_id ? String(row.profile_id) : null,
    profileName: row.profile_name,
  };
}

function formatProfileRow(row) {
  return {
    id: String(row.id),
    name: row.name,
    profileStatus: row.profile_status,
    profileBadge: row.profile_badge,
    dailyBidGoal: numberValue(row.daily_bid_goal),
    applications: numberValue(row.applications),
    todayApplications: numberValue(row.today_applications),
    activeInterviews: numberValue(row.active_interviews),
    offers: numberValue(row.offers),
    readyTailoredResumes: numberValue(row.ready_tailored_resumes),
  };
}

function numberValue(value) {
  return Number(value || 0);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}
