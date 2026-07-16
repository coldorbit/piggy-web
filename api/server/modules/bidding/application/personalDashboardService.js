import { QueryTypes } from 'sequelize';
import { ensureWebModels, getSequelize } from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { localDaySql, normalizeTimeZone } from '../../../utils/localTime.js';
import { canAccessConsumption } from '../../../utils/roles.js';
import { consumptionBreakdownSql } from '../../admin/application/dashboardConsumptionQueries.js';
import { formatConsumption } from '../../admin/application/dashboardFormatters.js';

const APPLICATION_STATUSES = ['submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost'];
const ACTIVE_TAILORING_STATUSES = ['requested', 'processing', 'ready', 'dead_letter'];
const ACTIVE_PROFILE_STATUS = 'active';
const ACTIVE_INTERVIEW_STATUS = 'interviewing';
const DEFAULT_PERIOD_GRAIN = 'daily';
const PERIOD_GRAINS = {
  daily: { sql: 'day', step: '1 day' },
  weekly: { sql: 'week', step: '1 week' },
  monthly: { sql: 'month', step: '1 month' },
  quarterly: { sql: 'quarter', step: '3 months' },
  annually: { sql: 'year', step: '1 year' },
};

export async function getPersonalDashboardMetrics(user, query = {}) {
  await ensureWebModels();

  const sequelize = getSequelize();
  const timeZone = normalizeTimeZone(user?.timezone);
  const grain = PERIOD_GRAINS[clean(query.grain)] ? clean(query.grain) : DEFAULT_PERIOD_GRAIN;
  const anchorDate = personalDashboardAnchorDate(query.anchorDate || query.anchor);
  const includeConsumption = canAccessConsumption(user);
  const replacements = {
    userId: user.id,
    applicationStatuses: APPLICATION_STATUSES,
    activeTailoringStatuses: ACTIVE_TAILORING_STATUSES,
  };

  const sql = personalDashboardQueries(timeZone, { grain, anchorDate });
  const [overall, trend, upcomingInterviews, recentApplications, profiles, actionToday, overdueAssessments, readyResumes, interviewsMissingLinks, mailboxReviewMessages, journeyRows, consumption] = await Promise.all([
    queryOne(sequelize, sql.overall, replacements),
    queryAll(sequelize, sql.trend, replacements),
    queryAll(sequelize, sql.upcomingInterviews, replacements),
    queryAll(sequelize, sql.recentApplications, replacements),
    queryAll(sequelize, sql.profiles, replacements),
    queryAll(sequelize, sql.actionToday, replacements),
    queryAll(sequelize, sql.overdueAssessments, replacements),
    queryAll(sequelize, sql.readyResumes, replacements),
    queryAll(sequelize, sql.interviewsMissingLinks, replacements),
    queryAll(sequelize, sql.mailboxReviewMessages, replacements),
    queryAll(sequelize, sql.journeyRows, replacements),
    includeConsumption ? queryAll(sequelize, sql.consumption, replacements) : Promise.resolve([]),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    timeZone,
    period: { grain, anchorDate: anchorDate.toISOString() },
    user: {
      id: String(user.id),
      username: user.username,
      role: user.role,
      dailyBidGoal: numberOrNull(user.dailyBidGoal),
    },
    totals: formatOverall(overall, user),
    activityTotals: formatPeriodActivity(overall),
    trend: trend.map(formatTrendRow),
    upcomingInterviews: upcomingInterviews.map(formatInterviewRow),
    recentApplications: recentApplications.map(formatApplicationRow),
    profiles: profiles.map(formatProfileRow),
    commandCenter: {
      needsActionToday: actionToday.map(formatCommandCenterItem),
      overdueAssessments: overdueAssessments.map(formatCommandCenterItem),
      readyResumes: readyResumes.map(formatCommandCenterItem),
      interviewsWithoutMeetingLinks: interviewsMissingLinks.map(formatCommandCenterItem),
      mailboxMessagesNeedingReview: mailboxReviewMessages.map(formatCommandCenterItem),
    },
    journeys: journeyRows.map(formatJourneyRow),
    ...(includeConsumption ? { consumption: formatConsumption(consumption) } : {}),
  };
}

export function personalDashboardQueries(timeZone, { grain = DEFAULT_PERIOD_GRAIN, anchorDate = new Date() } = {}) {
  const today = localDaySql('now()', timeZone);
  const overallBidDay = localDaySql('ob.bid_at', timeZone);
  const bidDay = localDaySql('jb.bid_at', timeZone);
  const interviewCreatedDay = localDaySql('i.created_at', timeZone);
  const interviewUpdatedDay = localDaySql('i.updated_at', timeZone);
  const resumeCreatedDay = localDaySql('tr.created_at', timeZone);
  const periodCte = personalDashboardPeriodCte(grain, timeZone, anchorDate);
  const periodBidPredicate = personalDashboardPeriodPredicate('ob.bid_at', timeZone);
  const periodInterviewPredicate = personalDashboardPeriodPredicate('ic.scheduled_at', timeZone);
  const periodScheduledPredicate = personalDashboardPeriodPredicate('il.created_at', timeZone);
  const periodConsumptionPredicate = personalDashboardPeriodPredicate('consumption_transactions.occurred_at', timeZone);

  return {
    consumption: consumptionBreakdownSql({
      periodCte,
      periodPredicate: periodConsumptionPredicate,
      periodRelation: 'selected_period',
    }),
    overall: `
      WITH ${periodCte},
      owned_profiles AS (
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
        (SELECT COUNT(*) FROM owned_bids WHERE status IN ('planned', 'queued', 'tailoring', 'ready'))::int AS planned_applications,
        (SELECT COUNT(*) FROM owned_bids WHERE status IN (:applicationStatuses))::int AS total_applications,
        (SELECT COUNT(*) FROM owned_bids ob WHERE status IN (:applicationStatuses) AND ${overallBidDay} = ${today})::int AS today_applications,
        (SELECT COUNT(*) FROM owned_bids ob WHERE status IN (:applicationStatuses) AND ${overallBidDay} >= ${today} - interval '6 days')::int AS week_applications,
        (SELECT COUNT(*) FROM owned_bids ob CROSS JOIN selected_period WHERE status IN (:applicationStatuses) AND ${periodBidPredicate})::int AS period_bids,
        (SELECT COUNT(*) FROM owned_interviews)::int AS total_interviews,
        (SELECT COUNT(*) FROM interview_calls ic JOIN owned_interviews oi ON oi.id = ic.interview_id CROSS JOIN selected_period WHERE ${periodInterviewPredicate})::int AS period_interviews,
        (SELECT COUNT(DISTINCT il.interview_id) FROM interview_logs il JOIN owned_interviews oi ON oi.id = il.interview_id CROSS JOIN selected_period WHERE il.event_type = 'first_scheduled' AND ${periodScheduledPredicate})::int AS period_newly_scheduled_interviews,
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
    actionToday: `
      WITH owned_profiles AS (
        SELECT id, name
        FROM bid_profiles
        WHERE user_id = :userId
      ),
      due_assessments AS (
        SELECT
          'assessment_due' AS item_type,
          a.id::text AS id,
          a.profile_id,
          op.name AS profile_name,
          COALESCE(sj.title, initcap(replace(a.category, '_', ' ')) || ' assessment') AS title,
          sj.company,
          a.expires_at AS due_at,
          '/assessments?profileId=' || a.profile_id::text AS href,
          NULL::text AS secondary_id
        FROM assessments a
        JOIN owned_profiles op ON op.id = a.profile_id
        LEFT JOIN scraped_jobs sj ON sj.id = a.job_id
        WHERE a.completed_at IS NULL
          AND a.expires_at IS NOT NULL
          AND ${localDaySql('a.expires_at', timeZone)} <= ${today}
        ORDER BY a.expires_at ASC
        LIMIT 6
      ),
      today_interviews AS (
        SELECT
          'interview_today' AS item_type,
          i.id::text AS id,
          i.profile_id,
          op.name AS profile_name,
          i.title,
          i.company,
          i.interview_next_at AS due_at,
          '/interviews?profileId=' || i.profile_id::text AS href,
          NULL::text AS secondary_id
        FROM interviews i
        JOIN owned_profiles op ON op.id = i.profile_id
        WHERE i.status = '${ACTIVE_INTERVIEW_STATUS}'
          AND i.interview_next_at IS NOT NULL
          AND ${localDaySql('i.interview_next_at', timeZone)} = ${today}
        ORDER BY i.interview_next_at ASC
        LIMIT 6
      ),
      unread_messages AS (
        SELECT
          'mailbox_unread' AS item_type,
          fmm.message_id AS id,
          fmm.profile_id,
          op.name AS profile_name,
          COALESCE(NULLIF(fmm.subject, ''), 'Mailbox message') AS title,
          COALESCE(NULLIF(fmm.from_name, ''), NULLIF(fmm.from_address, '')) AS company,
          fmm.received_at AS due_at,
          '/inbox?profileId=' || fmm.profile_id::text AS href,
          fmm.message_id AS secondary_id
        FROM forwarded_mailbox_messages fmm
        JOIN owned_profiles op ON op.id = fmm.profile_id
        WHERE fmm.is_read = false
        ORDER BY fmm.received_at DESC NULLS LAST, fmm.created_at DESC
        LIMIT 6
      )
      SELECT * FROM due_assessments
      UNION ALL
      SELECT * FROM today_interviews
      UNION ALL
      SELECT * FROM unread_messages
      ORDER BY due_at ASC NULLS LAST
      LIMIT 10
    `,
    overdueAssessments: `
      SELECT
        'overdue_assessment' AS item_type,
        a.id::text AS id,
        a.profile_id,
        p.name AS profile_name,
        COALESCE(sj.title, initcap(replace(a.category, '_', ' ')) || ' assessment') AS title,
        sj.company,
        a.expires_at AS due_at,
        '/assessments?profileId=' || a.profile_id::text AS href,
        NULL::text AS secondary_id
      FROM assessments a
      JOIN bid_profiles p ON p.id = a.profile_id
      LEFT JOIN scraped_jobs sj ON sj.id = a.job_id
      WHERE p.user_id = :userId
        AND a.completed_at IS NULL
        AND a.expires_at IS NOT NULL
        AND a.expires_at < now()
      ORDER BY a.expires_at ASC
      LIMIT 8
    `,
    readyResumes: `
      SELECT
        'ready_resume' AS item_type,
        tr.id::text AS id,
        tr.profile_id,
        p.name AS profile_name,
        COALESCE(sj.title, tr.manual_role, 'Tailored resume') AS title,
        COALESCE(sj.company, tr.manual_company) AS company,
        COALESCE(tr.ready_at, tr.updated_at) AS due_at,
        '/bids?profileId=' || tr.profile_id::text || '&tab=tailored' AS href,
        tr.id::text AS secondary_id
      FROM tailored_resumes tr
      JOIN bid_profiles p ON p.id = tr.profile_id
      LEFT JOIN scraped_jobs sj ON md5(sj.url) = md5(tr.job_url)
        AND sj.url = tr.job_url
      WHERE p.user_id = :userId
        AND tr.status = 'ready'
        AND tr.file_path IS NOT NULL
        AND tr.downloaded_at IS NULL
      ORDER BY COALESCE(tr.ready_at, tr.updated_at) DESC
      LIMIT 8
    `,
    interviewsMissingLinks: `
      SELECT
        'missing_meeting_link' AS item_type,
        i.id::text AS id,
        i.profile_id,
        p.name AS profile_name,
        i.title,
        i.company,
        i.interview_next_at AS due_at,
        '/interviews?profileId=' || i.profile_id::text AS href,
        NULL::text AS secondary_id
      FROM interviews i
      JOIN bid_profiles p ON p.id = i.profile_id
      WHERE p.user_id = :userId
        AND i.status = '${ACTIVE_INTERVIEW_STATUS}'
        AND NULLIF(BTRIM(COALESCE(i.stage_meeting_links ->> i.interview_stage, '')), '') IS NULL
      ORDER BY i.interview_next_at ASC NULLS LAST, i.updated_at DESC
      LIMIT 8
    `,
    mailboxReviewMessages: `
      SELECT
        'mailbox_review' AS item_type,
        fmm.message_id AS id,
        fmm.profile_id,
        p.name AS profile_name,
        COALESCE(NULLIF(fmm.subject, ''), 'Mailbox message') AS title,
        COALESCE(NULLIF(fmm.from_name, ''), NULLIF(fmm.from_address, '')) AS company,
        fmm.received_at AS due_at,
        '/inbox?profileId=' || fmm.profile_id::text AS href,
        fmm.message_id AS secondary_id
      FROM forwarded_mailbox_messages fmm
      JOIN bid_profiles p ON p.id = fmm.profile_id
      WHERE p.user_id = :userId
        AND fmm.is_read = false
      ORDER BY fmm.received_at DESC NULLS LAST, fmm.created_at DESC
      LIMIT 8
    `,
    journeyRows: `
      SELECT
        jb.id AS bid_id,
        jb.status AS bid_status,
        jb.created_at AS planned_at,
        jb.bid_at,
        sj.id AS job_id,
        sj.title,
        sj.company,
        sj.location,
        sj.url,
        sj.posted_at,
        sj.scraped_at,
        p.id AS profile_id,
        p.name AS profile_name,
        tr.id AS resume_id,
        tr.status AS resume_status,
        tr.ready_at AS resume_ready_at,
        tr.downloaded_at AS resume_downloaded_at,
        tr.created_at AS resume_created_at,
        a.id AS assessment_id,
        a.category AS assessment_category,
        a.expires_at AS assessment_expires_at,
        a.completed_at AS assessment_completed_at,
        i.id AS interview_id,
        i.status AS interview_status,
        i.interview_stage,
        i.interview_next_at,
        i.first_interview_scheduled_at,
        i.updated_at AS interview_updated_at
      FROM job_bids jb
      JOIN bid_profiles p ON p.id = jb.profile_id
      JOIN scraped_jobs sj ON sj.id = jb.job_id
      LEFT JOIN LATERAL (
        SELECT tr.*
        FROM tailored_resumes tr
        WHERE tr.profile_id = p.id
          AND md5(tr.job_url) = md5(sj.url)
          AND tr.job_url = sj.url
          AND tr.status IN (:activeTailoringStatuses)
        ORDER BY COALESCE(tr.ready_at, tr.updated_at, tr.created_at) DESC
        LIMIT 1
      ) tr ON true
      LEFT JOIN LATERAL (
        SELECT a.*
        FROM assessments a
        WHERE a.profile_id = p.id
          AND a.job_id = sj.id
        ORDER BY COALESCE(a.completed_at, a.expires_at, a.created_at) DESC
        LIMIT 1
      ) a ON true
      LEFT JOIN LATERAL (
        SELECT i.*
        FROM interviews i
        WHERE i.profile_id = p.id
          AND (i.job_bid_id = jb.id OR i.job_id = sj.id)
        ORDER BY COALESCE(i.interview_next_at, i.updated_at, i.created_at) DESC
        LIMIT 1
      ) i ON true
      WHERE p.user_id = :userId
        AND jb.status IN (:applicationStatuses)
      ORDER BY GREATEST(
        COALESCE(i.updated_at, '-infinity'::timestamptz),
        COALESCE(a.updated_at, '-infinity'::timestamptz),
        COALESCE(tr.updated_at, '-infinity'::timestamptz),
        COALESCE(jb.updated_at, '-infinity'::timestamptz)
      ) DESC
      LIMIT 8
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

function formatPeriodActivity(row) {
  return {
    totalBids: numberValue(row.period_bids),
    interviews: numberValue(row.period_interviews),
    newlyScheduledInterviews: numberValue(row.period_newly_scheduled_interviews),
  };
}

function personalDashboardPeriodCte(grain, timeZone, anchorDate) {
  const config = PERIOD_GRAINS[grain] || PERIOD_GRAINS[DEFAULT_PERIOD_GRAIN];
  const normalizedTimeZone = normalizeTimeZone(timeZone).replaceAll("'", "''");
  const anchor = personalDashboardAnchorDate(anchorDate).toISOString().replaceAll("'", "''");
  const localAnchor = `timezone('${normalizedTimeZone}', '${anchor}'::timestamptz)`;
  const startsAt = config.sql === 'week'
    ? `(date_trunc('day', ${localAnchor}) - (EXTRACT(DOW FROM ${localAnchor})::int * interval '1 day'))`
    : `date_trunc('${config.sql}', ${localAnchor})`;
  return `selected_period AS (
        SELECT
          ${startsAt} AS starts_at,
          (${startsAt} + interval '${config.step}') AS ends_at
      )`;
}

function personalDashboardPeriodPredicate(column, timeZone) {
  const normalizedTimeZone = normalizeTimeZone(timeZone).replaceAll("'", "''");
  const localTimestamp = `timezone('${normalizedTimeZone}', ${column})`;
  return `${localTimestamp} >= selected_period.starts_at AND ${localTimestamp} < selected_period.ends_at`;
}

function personalDashboardAnchorDate(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
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

function formatCommandCenterItem(row) {
  return {
    type: row.item_type,
    id: String(row.id),
    profileId: row.profile_id ? String(row.profile_id) : null,
    profileName: row.profile_name,
    title: row.title,
    company: row.company,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    href: row.href,
    secondaryId: row.secondary_id ? String(row.secondary_id) : null,
  };
}

function formatJourneyRow(row) {
  return {
    id: String(row.bid_id),
    profileId: row.profile_id ? String(row.profile_id) : null,
    profileName: row.profile_name,
    jobId: row.job_id ? String(row.job_id) : null,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    status: row.bid_status,
    events: [
      {
        key: 'found',
        label: 'Job found',
        status: row.scraped_at || row.posted_at ? 'done' : 'pending',
        at: isoDate(row.scraped_at || row.posted_at),
      },
      {
        key: 'applied',
        label: 'Applied',
        status: row.bid_at ? 'done' : 'pending',
        at: isoDate(row.bid_at),
      },
      {
        key: 'resume',
        label: 'Tailored resume',
        status: resumeJourneyStatus(row.resume_status),
        at: isoDate(row.resume_ready_at || row.resume_created_at),
        detail: row.resume_status,
      },
      {
        key: 'assessment',
        label: 'Assessment',
        status: assessmentJourneyStatus(row),
        at: isoDate(row.assessment_completed_at || row.assessment_expires_at),
        detail: row.assessment_category,
      },
      {
        key: 'interview',
        label: 'Interview',
        status: interviewJourneyStatus(row),
        at: isoDate(row.interview_next_at || row.first_interview_scheduled_at),
        detail: row.interview_stage,
      },
      {
        key: 'outcome',
        label: row.interview_status === 'won' ? 'Offer' : row.interview_status === 'lost' ? 'Loss' : 'Outcome',
        status: ['won', 'lost'].includes(row.interview_status) ? row.interview_status : 'pending',
        at: isoDate(['won', 'lost'].includes(row.interview_status) ? row.interview_updated_at : null),
      },
    ],
  };
}

function isoDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function resumeJourneyStatus(status) {
  if (status === 'ready') return 'done';
  if (['requested', 'processing'].includes(status)) return 'active';
  if (status === 'dead_letter') return 'blocked';
  return 'pending';
}

function assessmentJourneyStatus(row) {
  if (row.assessment_completed_at) return 'done';
  if (row.assessment_id && row.assessment_expires_at && new Date(row.assessment_expires_at).getTime() < Date.now()) return 'blocked';
  if (row.assessment_id) return 'active';
  return 'pending';
}

function interviewJourneyStatus(row) {
  if (row.interview_status === 'won') return 'won';
  if (row.interview_status === 'lost') return 'lost';
  if (row.interview_id) return 'active';
  return 'pending';
}

function numberValue(value) {
  return Number(value || 0);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}
