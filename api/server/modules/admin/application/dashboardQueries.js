import { DEFAULT_TIME_ZONE, localBucketSql, localNowBucketSql, normalizeTimeZone } from '../../../utils/localTime.js';

const GRAINS = {
  daily: { sql: 'day', step: "1 day", lookback: "29 days", labelFormat: 'YYYY-MM-DD' },
  weekly: { sql: 'week', step: "1 week", lookback: "11 weeks", labelFormat: 'YYYY-MM-DD' },
  monthly: { sql: 'month', step: "1 month", lookback: "11 months", labelFormat: 'YYYY-MM' },
  quarterly: { sql: 'quarter', step: "3 months", lookback: "21 months", labelFormat: '"Q"Q YYYY' },
  annually: { sql: 'year', step: "1 year", lookback: "4 years", labelFormat: 'YYYY' },
};

export const DEFAULT_GRAIN = 'daily';
export const GRAIN_KEYS = Object.keys(GRAINS);

export function grainConfigFor(value) {
  return GRAINS[value] || GRAINS[DEFAULT_GRAIN];
}

export function dashboardQueries(grainConfig, { timeZone = DEFAULT_TIME_ZONE } = {}) {
  return {
    overall: overallSql(grainConfig, timeZone),
    trend: trendSql(grainConfig, timeZone),
    users: userPerformanceSql(grainConfig, timeZone),
    bidders: bidderPerformanceSql(grainConfig, timeZone),
    callers: callerPerformanceSql(grainConfig, timeZone),
    profileFunnels: profileFunnelSql(grainConfig, timeZone),
    roleFamilyFunnels: roleFamilyFunnelSql(grainConfig, timeZone),
    userSources: userSourceMixSql(grainConfig, timeZone),
    userCategories: userCategoryMixSql(grainConfig, timeZone),
    userProfiles: userProfileMixSql(grainConfig, timeZone),
    profileActivity: profileActivitySql(grainConfig, timeZone),
    sources: sourceBreakdownSql(grainConfig, timeZone),
    bidStatuses: bidStatusBreakdownSql(grainConfig, timeZone),
    interviewStages: interviewStageBreakdownSql(grainConfig, timeZone),
    interviewStatuses: interviewStatusBreakdownSql(grainConfig, timeZone),
  };
}

function funnelMetricsSelect() {
  return `
    COUNT(DISTINCT job_bids.id)::int AS applications,
    COUNT(DISTINCT job_bids.id) FILTER (
      WHERE interviews.id IS NOT NULL OR job_bids.status IN ('interviewing', 'won', 'lost')
    )::int AS interviews,
    COUNT(DISTINCT job_bids.id) FILTER (
      WHERE COALESCE(interviews.status, job_bids.status) = 'won'
    )::int AS offers,
    COUNT(DISTINCT job_bids.id) FILTER (
      WHERE COALESCE(interviews.status, job_bids.status) = 'lost'
    )::int AS lost
  `;
}

function rangeCte({ sql, step, lookback }, timeZone) {
  return `
    WITH range AS (
      SELECT
        ${localNowBucketSql(sql, timeZone)} - interval '${lookback}' AS starts_at,
        ${localNowBucketSql(sql, timeZone)} AS ends_at,
        interval '${step}' AS bucket_step
    )
  `;
}

function currentPeriodCte({ sql, step }, timeZone) {
  const startsAt = currentPeriodStartSql(sql, timeZone);
  return `
    current_period AS (
      SELECT
        ${startsAt} AS starts_at,
        (${startsAt} + interval '${step}') AS ends_at
    )
  `;
}

function currentPeriodStartSql(grainSql, timeZone) {
  if (grainSql !== 'week') return localNowBucketSql(grainSql, timeZone);

  const localNow = localTimestampSql('now()', timeZone);
  return `(date_trunc('day', ${localNow}) - (EXTRACT(DOW FROM ${localNow})::int * interval '1 day'))`;
}

function bucketExpression(column, grainConfig, timeZone) {
  return localBucketSql(column, grainConfig.sql, timeZone);
}

function localTimestampSql(column, timeZone) {
  const normalizedTimeZone = normalizeTimeZone(timeZone).replaceAll("'", "''");
  return `timezone('${normalizedTimeZone}', ${column})`;
}

function currentPeriodPredicate(column, timeZone, alias = 'current_period') {
  const localTimestamp = localTimestampSql(column, timeZone);
  return `${localTimestamp} >= ${alias}.starts_at AND ${localTimestamp} < ${alias}.ends_at`;
}

function overallSql(grainConfig, timeZone) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const jobBucket = bucketExpression('scraped_at', grainConfig, normalizedTimeZone);
  const bidBucket = bucketExpression('bid_at', grainConfig, normalizedTimeZone);
  const tailoringBucket = bucketExpression('created_at', grainConfig, normalizedTimeZone);

  return `
    ${rangeCte(grainConfig, normalizedTimeZone)},
    ${currentPeriodCte(grainConfig, normalizedTimeZone)},
    local_day AS (
      SELECT
        ${localNowBucketSql('day', normalizedTimeZone)} AT TIME ZONE '${normalizedTimeZone}' AS starts_at,
        (${localNowBucketSql('day', normalizedTimeZone)} + interval '1 day') AT TIME ZONE '${normalizedTimeZone}' AS ends_at
    ),
    job_totals AS (
      SELECT
        COUNT(*)::int AS total_jobs,
        COUNT(*) FILTER (WHERE raw_job->>'importType' = 'manual' OR raw_job->>'isManualImport' = 'true')::int AS manual_jobs,
        COUNT(*) FILTER (WHERE COALESCE(raw_job->>'importType', '') <> 'manual' AND COALESCE(raw_job->>'isManualImport', '') <> 'true')::int AS scraped_jobs,
        COUNT(*) FILTER (WHERE is_hidden = true)::int AS hidden_jobs,
        COUNT(*) FILTER (WHERE is_spam = true)::int AS spam_jobs,
        COUNT(*) FILTER (WHERE is_spam = false)::int AS reviewed_good_jobs,
        COUNT(*) FILTER (WHERE is_spam IS NULL)::int AS unreviewed_jobs
      FROM scraped_jobs, range
      WHERE ${jobBucket} >= range.starts_at
    ),
    bid_totals AS (
      SELECT
        COUNT(*)::int AS total_applications,
        COUNT(*) FILTER (WHERE status = 'planned')::int AS planned_applications,
        COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted_applications,
        COUNT(*) FILTER (WHERE status = 'interviewing')::int AS interviewing_applications,
        COUNT(*) FILTER (WHERE status = 'won')::int AS won_applications,
        COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_applications,
        COUNT(*) FILTER (WHERE status IN ('mismatching_bid', 'spam_job'))::int AS review_blocked_applications
      FROM job_bids, range
      WHERE ${bidBucket} >= range.starts_at
    ),
    daily_bid_totals AS (
      SELECT
        COUNT(*) FILTER (
          WHERE web_users.role IN ('user', 'admin', 'superadmin', 'finance_manager', 'bidder', 'readonly_bidder', 'editable_bidder')
        )::int AS daily_total_bids,
        COUNT(*) FILTER (WHERE web_users.role IN ('user', 'admin', 'superadmin', 'finance_manager'))::int AS daily_user_role_bids,
        COUNT(*) FILTER (WHERE web_users.role IN ('bidder', 'readonly_bidder', 'editable_bidder'))::int AS daily_bidder_bids
      FROM job_bids
      JOIN web_users ON web_users.id = job_bids.user_id
      CROSS JOIN local_day
      WHERE job_bids.status IN ('submitted', 'interviewing', 'won', 'lost')
        AND job_bids.bid_at >= local_day.starts_at
        AND job_bids.bid_at < local_day.ends_at
    ),
    interview_totals AS (
      SELECT
        COUNT(*)::int AS total_interviews,
        COUNT(*) FILTER (WHERE status = 'interviewing')::int AS active_interviews,
        COUNT(*) FILTER (WHERE interview_stage IN ('technical_interview', 'system_design'))::int AS technical_interviews,
        COUNT(*) FILTER (WHERE status = 'won' OR interview_stage IN ('panel', 'behavioral', 'system_design', 'final'))::int AS successful_technical_interviews,
        COUNT(*) FILTER (WHERE interview_stage = 'final')::int AS final_interviews,
        COUNT(*) FILTER (WHERE status = 'won')::int AS successful_final_interviews,
        COUNT(*) FILTER (WHERE status = 'won')::int AS successful_offers,
        COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_interviews
      FROM interviews
      CROSS JOIN current_period
      WHERE interview_next_at IS NOT NULL
        AND ${currentPeriodPredicate('interview_next_at', normalizedTimeZone)}
    ),
    tailoring_totals AS (
      SELECT
        COUNT(*)::int AS tailored_resume_requests,
        COUNT(*) FILTER (WHERE status = 'ready')::int AS ready_tailored_resumes
      FROM tailored_resumes, range
      WHERE ${tailoringBucket} >= range.starts_at
    )
    SELECT job_totals.*, bid_totals.*, daily_bid_totals.*, interview_totals.*, tailoring_totals.*
    FROM job_totals
    CROSS JOIN bid_totals
    CROSS JOIN daily_bid_totals
    CROSS JOIN interview_totals
    CROSS JOIN tailoring_totals
  `;
}

function trendSql(grainConfig, timeZone) {
  const jobBucket = bucketExpression('scraped_at', grainConfig, timeZone);
  const bidBucket = bucketExpression('bid_at', grainConfig, timeZone);
  const interviewCreatedBucket = bucketExpression('created_at', grainConfig, timeZone);
  const interviewUpdatedBucket = bucketExpression('updated_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)},
    buckets AS (
      SELECT generate_series(starts_at, ends_at, bucket_step) AS bucket_start
      FROM range
    ),
    jobs AS (
      SELECT ${jobBucket} AS bucket_start, COUNT(*)::int AS jobs
      FROM scraped_jobs, range
      WHERE ${jobBucket} >= starts_at
      GROUP BY 1
    ),
    bids AS (
      SELECT
        ${bidBucket} AS bucket_start,
        COUNT(*)::int AS applications,
        COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted,
        COUNT(*) FILTER (WHERE status = 'interviewing')::int AS interviewing_applications,
        COUNT(*) FILTER (WHERE status = 'won')::int AS won_applications,
        COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_applications
      FROM job_bids, range
      WHERE ${bidBucket} >= starts_at
      GROUP BY 1
    ),
    interviews_created AS (
      SELECT ${interviewCreatedBucket} AS bucket_start, COUNT(*)::int AS interviews
      FROM interviews, range
      WHERE ${interviewCreatedBucket} >= starts_at
      GROUP BY 1
    ),
    interview_outcomes AS (
      SELECT
        ${interviewUpdatedBucket} AS bucket_start,
        COUNT(*) FILTER (WHERE status = 'interviewing')::int AS active_interviews,
        COUNT(*) FILTER (WHERE interview_stage IN ('technical_interview', 'system_design'))::int AS technical_interviews,
        COUNT(*) FILTER (WHERE status = 'won' OR interview_stage IN ('panel', 'behavioral', 'system_design', 'final'))::int AS successful_technical_interviews,
        COUNT(*) FILTER (WHERE interview_stage = 'final')::int AS final_interviews,
        COUNT(*) FILTER (WHERE status = 'won')::int AS successful_final_interviews,
        COUNT(*) FILTER (WHERE status = 'won')::int AS offers,
        COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_interviews
      FROM interviews, range
      WHERE ${interviewUpdatedBucket} >= starts_at
      GROUP BY 1
    )
    SELECT
      to_char(buckets.bucket_start, '${grainConfig.labelFormat}') AS label,
      buckets.bucket_start,
      COALESCE(jobs.jobs, 0)::int AS jobs,
      COALESCE(bids.applications, 0)::int AS applications,
      COALESCE(bids.submitted, 0)::int AS submitted,
      COALESCE(bids.interviewing_applications, 0)::int AS interviewing_applications,
      COALESCE(bids.won_applications, 0)::int AS won_applications,
      COALESCE(bids.lost_applications, 0)::int AS lost_applications,
      COALESCE(interviews_created.interviews, 0)::int AS interviews,
      COALESCE(interview_outcomes.active_interviews, 0)::int AS active_interviews,
      COALESCE(interview_outcomes.technical_interviews, 0)::int AS technical_interviews,
      COALESCE(interview_outcomes.successful_technical_interviews, 0)::int AS successful_technical_interviews,
      COALESCE(interview_outcomes.final_interviews, 0)::int AS final_interviews,
      COALESCE(interview_outcomes.successful_final_interviews, 0)::int AS successful_final_interviews,
      COALESCE(interview_outcomes.offers, 0)::int AS offers,
      COALESCE(interview_outcomes.lost_interviews, 0)::int AS lost_interviews
    FROM buckets
    LEFT JOIN jobs ON jobs.bucket_start = buckets.bucket_start
    LEFT JOIN bids ON bids.bucket_start = buckets.bucket_start
    LEFT JOIN interviews_created ON interviews_created.bucket_start = buckets.bucket_start
    LEFT JOIN interview_outcomes ON interview_outcomes.bucket_start = buckets.bucket_start
    ORDER BY buckets.bucket_start ASC
  `;
}

function userPerformanceSql(grainConfig, timeZone) {
  const bidBucket = bucketExpression('bid_at', grainConfig, timeZone);
  const interviewCreatedBucket = bucketExpression('interviews.created_at', grainConfig, timeZone);
  const interviewActivityBucket = bucketExpression('COALESCE(interviews.updated_at, interviews.created_at)', grainConfig, timeZone);
  const tailoringBucket = bucketExpression('created_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)},
    bid_metrics AS (
      SELECT
        user_id,
        COUNT(*)::int AS applications,
        COUNT(*) FILTER (WHERE status = 'planned')::int AS planned,
        COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted,
        COUNT(*) FILTER (WHERE status = 'interviewing')::int AS interviewing_applications,
        COUNT(*) FILTER (WHERE status = 'won')::int AS won_applications,
        COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_applications,
        COUNT(*) FILTER (WHERE status IN ('mismatching_bid', 'spam_job'))::int AS review_blocked_applications,
        MIN(bid_at) AS first_application_at,
        MAX(bid_at) AS last_application_at
      FROM job_bids, range
      WHERE ${bidBucket} >= starts_at
      GROUP BY user_id
    ),
    interview_created_metrics AS (
      SELECT
        interviews.user_id,
        COUNT(*)::int AS interviews,
        COUNT(*) FILTER (WHERE interviews.first_interview_scheduled_at IS NOT NULL)::int AS first_interviews_scheduled,
        MIN(interviews.created_at) AS first_interview_at,
        AVG(EXTRACT(EPOCH FROM (interviews.created_at - interviews.first_interview_scheduled_at)) / 86400)
          FILTER (WHERE interviews.first_interview_scheduled_at IS NOT NULL AND interviews.created_at >= interviews.first_interview_scheduled_at) AS avg_days_from_scheduled_to_created,
        AVG(EXTRACT(EPOCH FROM (interviews.created_at - linked_bid.bid_at)) / 86400)
          FILTER (WHERE linked_bid.bid_at IS NOT NULL AND interviews.created_at >= linked_bid.bid_at) AS avg_days_from_application_to_interview
      FROM interviews
      LEFT JOIN job_bids linked_bid ON linked_bid.id = interviews.job_bid_id
      CROSS JOIN range
      WHERE ${interviewCreatedBucket} >= starts_at
      GROUP BY interviews.user_id
    ),
    interview_activity_metrics AS (
      SELECT
        interviews.user_id,
        COUNT(*) FILTER (WHERE interviews.status = 'interviewing')::int AS active_interviews,
        COUNT(*) FILTER (WHERE interviews.interview_stage IN ('technical_interview', 'system_design'))::int AS technical_interviews,
        COUNT(*) FILTER (WHERE interviews.status = 'won' OR interviews.interview_stage IN ('panel', 'behavioral', 'system_design', 'final'))::int AS successful_technical_interviews,
        COUNT(*) FILTER (WHERE interviews.interview_stage = 'final')::int AS final_interviews,
        COUNT(*) FILTER (WHERE interviews.status = 'won')::int AS successful_final_interviews,
        COUNT(*) FILTER (WHERE interviews.status = 'won')::int AS offers,
        COUNT(*) FILTER (WHERE interviews.status = 'lost')::int AS lost_interviews,
        COUNT(*) FILTER (WHERE interviews.interview_next_at >= now())::int AS upcoming_interviews,
        COUNT(*) FILTER (WHERE interviews.interview_next_at IS NULL AND interviews.status = 'interviewing')::int AS unscheduled_active_interviews,
        MAX(interviews.updated_at) AS last_interview_activity_at
      FROM interviews
      CROSS JOIN range
      WHERE ${interviewActivityBucket} >= starts_at
      GROUP BY interviews.user_id
    ),
    profile_metrics AS (
      SELECT
        user_id,
        COUNT(*)::int AS profiles,
        COUNT(*) FILTER (WHERE profile_status = 'active')::int AS active_profiles,
        COUNT(*) FILTER (WHERE profile_status <> 'active')::int AS inactive_profiles
      FROM bid_profiles
      GROUP BY user_id
    ),
    shared_profile_metrics AS (
      SELECT recipient_user_id AS user_id, COUNT(*)::int AS shared_profiles
      FROM profile_share_requests
      WHERE status = 'accepted'
      GROUP BY recipient_user_id
    ),
    tailoring_metrics AS (
      SELECT
        user_id,
        COUNT(*)::int AS tailored_resume_requests,
        COUNT(*) FILTER (WHERE status = 'ready')::int AS ready_tailored_resumes,
        COUNT(*) FILTER (WHERE status = 'dead_letter')::int AS failed_tailored_resumes,
        COUNT(*) FILTER (WHERE downloaded_at IS NOT NULL)::int AS downloaded_tailored_resumes
      FROM tailored_resumes, range
      WHERE ${tailoringBucket} >= starts_at
      GROUP BY user_id
    )
    SELECT
      web_users.id,
      web_users.username,
      web_users.role,
      COALESCE(bid_metrics.applications, 0)::int AS applications,
      COALESCE(bid_metrics.planned, 0)::int AS planned,
      COALESCE(bid_metrics.submitted, 0)::int AS submitted,
      COALESCE(bid_metrics.interviewing_applications, 0)::int AS interviewing_applications,
      COALESCE(bid_metrics.won_applications, 0)::int AS won_applications,
      COALESCE(bid_metrics.lost_applications, 0)::int AS lost_applications,
      COALESCE(bid_metrics.review_blocked_applications, 0)::int AS review_blocked_applications,
      bid_metrics.first_application_at,
      bid_metrics.last_application_at,
      COALESCE(interview_created_metrics.interviews, 0)::int AS interviews,
      COALESCE(interview_activity_metrics.active_interviews, 0)::int AS active_interviews,
      COALESCE(interview_activity_metrics.technical_interviews, 0)::int AS technical_interviews,
      COALESCE(interview_activity_metrics.successful_technical_interviews, 0)::int AS successful_technical_interviews,
      COALESCE(interview_activity_metrics.final_interviews, 0)::int AS final_interviews,
      COALESCE(interview_activity_metrics.successful_final_interviews, 0)::int AS successful_final_interviews,
      COALESCE(interview_activity_metrics.offers, 0)::int AS offers,
      COALESCE(interview_activity_metrics.lost_interviews, 0)::int AS lost_interviews,
      COALESCE(interview_created_metrics.first_interviews_scheduled, 0)::int AS first_interviews_scheduled,
      COALESCE(interview_activity_metrics.upcoming_interviews, 0)::int AS upcoming_interviews,
      COALESCE(interview_activity_metrics.unscheduled_active_interviews, 0)::int AS unscheduled_active_interviews,
      interview_created_metrics.first_interview_at,
      interview_activity_metrics.last_interview_activity_at,
      COALESCE(interview_created_metrics.avg_days_from_scheduled_to_created, 0)::float AS avg_days_from_scheduled_to_created,
      COALESCE(interview_created_metrics.avg_days_from_application_to_interview, 0)::float AS avg_days_from_application_to_interview,
      COALESCE(profile_metrics.profiles, 0)::int AS profiles,
      COALESCE(profile_metrics.active_profiles, 0)::int AS active_profiles,
      COALESCE(profile_metrics.inactive_profiles, 0)::int AS inactive_profiles,
      COALESCE(shared_profile_metrics.shared_profiles, 0)::int AS shared_profiles,
      COALESCE(tailoring_metrics.tailored_resume_requests, 0)::int AS tailored_resume_requests,
      COALESCE(tailoring_metrics.ready_tailored_resumes, 0)::int AS ready_tailored_resumes,
      COALESCE(tailoring_metrics.failed_tailored_resumes, 0)::int AS failed_tailored_resumes,
      COALESCE(tailoring_metrics.downloaded_tailored_resumes, 0)::int AS downloaded_tailored_resumes
    FROM web_users
    LEFT JOIN bid_metrics ON bid_metrics.user_id = web_users.id
    LEFT JOIN interview_created_metrics ON interview_created_metrics.user_id = web_users.id
    LEFT JOIN interview_activity_metrics ON interview_activity_metrics.user_id = web_users.id
    LEFT JOIN profile_metrics ON profile_metrics.user_id = web_users.id
    LEFT JOIN shared_profile_metrics ON shared_profile_metrics.user_id = web_users.id
    LEFT JOIN tailoring_metrics ON tailoring_metrics.user_id = web_users.id
    WHERE web_users.role NOT IN ('superadmin', 'bidder', 'readonly_bidder', 'editable_bidder')
      AND (
        web_users.role IN ('admin', 'user', 'finance_manager', 'internal')
        OR COALESCE(bid_metrics.applications, 0) > 0
        OR COALESCE(interview_created_metrics.interviews, 0) > 0
        OR COALESCE(interview_activity_metrics.active_interviews, 0) > 0
        OR COALESCE(tailoring_metrics.tailored_resume_requests, 0) > 0
      )
    ORDER BY COALESCE(interview_activity_metrics.offers, 0) DESC,
      COALESCE(interview_created_metrics.interviews, 0) DESC,
      COALESCE(bid_metrics.applications, 0) DESC,
      web_users.username ASC
  `;
}

function callerPerformanceSql(grainConfig, timeZone) {
  const callerCreatedBucket = bucketExpression('created_at', grainConfig, timeZone);
  const callerActivityBucket = bucketExpression('COALESCE(updated_at, created_at)', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)},
    caller_created_metrics AS (
      SELECT
        caller_user_id AS user_id,
        COUNT(*)::int AS assigned_interviews,
        MIN(created_at) AS first_assignment_at
      FROM interviews, range
      WHERE caller_user_id IS NOT NULL
        AND ${callerCreatedBucket} >= starts_at
      GROUP BY caller_user_id
    ),
    caller_activity_metrics AS (
      SELECT
        caller_user_id AS user_id,
        COUNT(*) FILTER (WHERE status = 'interviewing')::int AS active_interviews,
        COUNT(*) FILTER (WHERE status IN ('won', 'lost'))::int AS completed_interviews,
        COUNT(*) FILTER (WHERE status = 'won')::int AS won_interviews,
        COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_interviews,
        COUNT(*) FILTER (WHERE interview_next_at >= now())::int AS upcoming_interviews,
        COUNT(*) FILTER (WHERE interview_next_at IS NULL AND status = 'interviewing')::int AS unscheduled_active_interviews,
        COUNT(*) FILTER (WHERE stage_meeting_links IS NOT NULL AND stage_meeting_links <> '{}'::jsonb)::int AS interviews_with_meeting_links,
        COUNT(*) FILTER (WHERE interview_stage = 'screening')::int AS screening_interviews,
        COUNT(*) FILTER (WHERE interview_stage = 'hiring_manager')::int AS hiring_manager_interviews,
        COUNT(*) FILTER (WHERE interview_stage IN ('technical_interview', 'system_design'))::int AS technical_interviews,
        COUNT(*) FILTER (WHERE interview_stage = 'final')::int AS final_interviews,
        MAX(updated_at) AS last_assignment_activity_at
      FROM interviews, range
      WHERE caller_user_id IS NOT NULL
        AND ${callerActivityBucket} >= starts_at
      GROUP BY caller_user_id
    )
    SELECT
      web_users.id,
      web_users.username,
      web_users.role,
      COALESCE(caller_created_metrics.assigned_interviews, 0)::int AS assigned_interviews,
      COALESCE(caller_activity_metrics.active_interviews, 0)::int AS active_interviews,
      COALESCE(caller_activity_metrics.completed_interviews, 0)::int AS completed_interviews,
      COALESCE(caller_activity_metrics.won_interviews, 0)::int AS won_interviews,
      COALESCE(caller_activity_metrics.lost_interviews, 0)::int AS lost_interviews,
      COALESCE(caller_activity_metrics.upcoming_interviews, 0)::int AS upcoming_interviews,
      COALESCE(caller_activity_metrics.unscheduled_active_interviews, 0)::int AS unscheduled_active_interviews,
      COALESCE(caller_activity_metrics.interviews_with_meeting_links, 0)::int AS interviews_with_meeting_links,
      COALESCE(caller_activity_metrics.screening_interviews, 0)::int AS screening_interviews,
      COALESCE(caller_activity_metrics.hiring_manager_interviews, 0)::int AS hiring_manager_interviews,
      COALESCE(caller_activity_metrics.technical_interviews, 0)::int AS technical_interviews,
      COALESCE(caller_activity_metrics.final_interviews, 0)::int AS final_interviews,
      caller_created_metrics.first_assignment_at,
      caller_activity_metrics.last_assignment_activity_at
    FROM web_users
    LEFT JOIN caller_created_metrics ON caller_created_metrics.user_id = web_users.id
    LEFT JOIN caller_activity_metrics ON caller_activity_metrics.user_id = web_users.id
    WHERE web_users.role = 'caller'
       OR COALESCE(caller_created_metrics.assigned_interviews, 0) > 0
       OR COALESCE(caller_activity_metrics.active_interviews, 0) > 0
    ORDER BY COALESCE(caller_activity_metrics.active_interviews, 0) DESC,
      COALESCE(caller_created_metrics.assigned_interviews, 0) DESC,
      web_users.username ASC
  `;
}

function bidderPerformanceSql(grainConfig, timeZone) {
  const bidBucket = bucketExpression('job_bids.bid_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)},
    ${currentPeriodCte(grainConfig, timeZone)},
    bid_metrics AS (
      SELECT
        job_bids.user_id,
        COUNT(DISTINCT job_bids.id)::int AS applications,
        COUNT(DISTINCT job_bids.profile_id)::int AS profiles_used,
        COUNT(DISTINCT scraped_jobs.category) FILTER (
          WHERE NULLIF(scraped_jobs.category, '') IS NOT NULL
        )::int AS role_families,
        MIN(job_bids.bid_at) AS first_application_at,
        MAX(job_bids.bid_at) AS last_application_at
      FROM job_bids
      LEFT JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
      CROSS JOIN range
      WHERE ${bidBucket} >= starts_at
      GROUP BY job_bids.user_id
    ),
    scheduled_interview_metrics AS (
      SELECT
        COALESCE(job_bids.user_id, interviews.user_id) AS user_id,
        COUNT(DISTINCT interviews.id)::int AS interviews,
        COUNT(DISTINCT interviews.id) FILTER (WHERE interviews.status = 'won')::int AS offers,
        COUNT(DISTINCT interviews.id) FILTER (WHERE interviews.status = 'lost')::int AS lost
      FROM interviews
      LEFT JOIN job_bids ON job_bids.id = interviews.job_bid_id
      CROSS JOIN current_period
      WHERE interviews.interview_next_at IS NOT NULL
        AND ${currentPeriodPredicate('interviews.interview_next_at', timeZone)}
      GROUP BY COALESCE(job_bids.user_id, interviews.user_id)
    )
    SELECT
      web_users.id,
      web_users.username,
      web_users.role,
      COALESCE(bid_metrics.applications, 0)::int AS applications,
      COALESCE(scheduled_interview_metrics.interviews, 0)::int AS interviews,
      COALESCE(scheduled_interview_metrics.offers, 0)::int AS offers,
      COALESCE(scheduled_interview_metrics.lost, 0)::int AS lost,
      COALESCE(bid_metrics.profiles_used, 0)::int AS profiles_used,
      COALESCE(bid_metrics.role_families, 0)::int AS role_families,
      bid_metrics.first_application_at,
      bid_metrics.last_application_at
    FROM web_users
    LEFT JOIN bid_metrics ON bid_metrics.user_id = web_users.id
    LEFT JOIN scheduled_interview_metrics ON scheduled_interview_metrics.user_id = web_users.id
    WHERE COALESCE(bid_metrics.applications, 0) > 0
       OR COALESCE(scheduled_interview_metrics.interviews, 0) > 0
    ORDER BY offers DESC, interviews DESC, applications DESC, web_users.username ASC
  `;
}

function profileFunnelSql(grainConfig, timeZone) {
  return funnelByDimensionSql({
    grainConfig,
    dimension: "COALESCE(NULLIF(bid_profiles.name, ''), 'Unknown profile')",
    idColumn: 'bid_profiles.id',
    alias: 'profile_name',
    joins: 'JOIN bid_profiles ON bid_profiles.id = job_bids.profile_id',
    groupBy: 'bid_profiles.id, bid_profiles.name',
    timeZone,
  });
}

function roleFamilyFunnelSql(grainConfig, timeZone) {
  return funnelByDimensionSql({
    grainConfig,
    dimension: "COALESCE(NULLIF(scraped_jobs.category, ''), 'Uncategorized')",
    idColumn: 'NULL',
    alias: 'role_family',
    joins: 'JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id',
    groupBy: "COALESCE(NULLIF(scraped_jobs.category, ''), 'Uncategorized')",
    timeZone,
  });
}

function funnelByDimensionSql({ grainConfig, dimension, idColumn, alias, joins, groupBy, timeZone }) {
  const bidBucket = bucketExpression('job_bids.bid_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)}
    SELECT
      ${idColumn} AS id,
      ${dimension} AS ${alias},
      ${funnelMetricsSelect()}
    FROM job_bids
    ${joins}
    LEFT JOIN interviews ON interviews.job_bid_id = job_bids.id
    CROSS JOIN range
    WHERE ${bidBucket} >= starts_at
    GROUP BY ${groupBy}
    ORDER BY offers DESC, interviews DESC, applications DESC, ${alias} ASC
    LIMIT 24
  `;
}

function userSourceMixSql(grainConfig, timeZone) {
  return rankedMixSql({ grainConfig, dimension: "COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown')", alias: 'source', timeZone });
}

function userCategoryMixSql(grainConfig, timeZone) {
  return rankedMixSql({ grainConfig, dimension: "COALESCE(NULLIF(scraped_jobs.category, ''), 'Uncategorized')", alias: 'category', timeZone });
}

function userProfileMixSql(grainConfig, timeZone) {
  return rankedMixSql({
    grainConfig,
    dimension: "COALESCE(NULLIF(bid_profiles.name, ''), 'Unknown profile')",
    alias: 'profile_name',
    joinProfile: true,
    timeZone,
  });
}

function rankedMixSql({ grainConfig, dimension, alias, joinProfile = false, timeZone }) {
  const bidBucket = bucketExpression('job_bids.bid_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)},
    ranked AS (
      SELECT
        job_bids.user_id,
        ${dimension} AS ${alias},
        COUNT(*)::int AS count,
        ROW_NUMBER() OVER (
          PARTITION BY job_bids.user_id
          ORDER BY COUNT(*) DESC, ${dimension} ASC
        ) AS rank
      FROM job_bids
      JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
      ${joinProfile ? 'JOIN bid_profiles ON bid_profiles.id = job_bids.profile_id' : ''}
      CROSS JOIN range
      WHERE ${bidBucket} >= starts_at
      GROUP BY job_bids.user_id, ${dimension}
    )
    SELECT user_id, ${alias}, count
    FROM ranked
    WHERE rank <= 5
    ORDER BY user_id ASC, count DESC, ${alias} ASC
  `;
}

function profileActivitySql(grainConfig, timeZone) {
  const bidBucket = bucketExpression('job_bids.bid_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)}
    SELECT
      job_bids.id,
      job_bids.user_id,
      web_users.username,
      web_users.role,
      job_bids.profile_id,
      bid_profiles.name AS profile_name,
      job_bids.job_id,
      scraped_jobs.public_job_id,
      scraped_jobs.title AS job_title,
      scraped_jobs.company,
      scraped_jobs.source,
      job_bids.status,
      job_bids.bid_at
    FROM job_bids
    JOIN web_users ON web_users.id = job_bids.user_id
    JOIN bid_profiles ON bid_profiles.id = job_bids.profile_id
    JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
    CROSS JOIN range
    WHERE ${bidBucket} >= starts_at
    ORDER BY job_bids.bid_at DESC, job_bids.id DESC
    LIMIT 200
  `;
}

function sourceBreakdownSql(grainConfig, timeZone) {
  const bidBucket = bucketExpression('job_bids.bid_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)}
    SELECT COALESCE(NULLIF(scraped_jobs.source, ''), 'Unknown') AS source, COUNT(*)::int AS count
    FROM job_bids
    JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id, range
    WHERE ${bidBucket} >= starts_at
    GROUP BY 1
    ORDER BY count DESC, source ASC
    LIMIT 12
  `;
}

function bidStatusBreakdownSql(grainConfig, timeZone) {
  const bidBucket = bucketExpression('bid_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)}
    SELECT COALESCE(NULLIF(status, ''), 'unknown') AS status, COUNT(*)::int AS count
    FROM job_bids, range
    WHERE ${bidBucket} >= starts_at
    GROUP BY 1
    ORDER BY count DESC, status ASC
  `;
}

function interviewStageBreakdownSql(grainConfig, timeZone) {
  const interviewCreatedBucket = bucketExpression('created_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)}
    SELECT COALESCE(NULLIF(interview_stage, ''), 'unknown') AS stage, COUNT(*)::int AS count
    FROM interviews, range
    WHERE ${interviewCreatedBucket} >= starts_at
    GROUP BY 1
    ORDER BY count DESC, stage ASC
  `;
}

function interviewStatusBreakdownSql(grainConfig, timeZone) {
  const interviewCreatedBucket = bucketExpression('created_at', grainConfig, timeZone);

  return `
    ${rangeCte(grainConfig, timeZone)}
    SELECT COALESCE(NULLIF(status, ''), 'unknown') AS status, COUNT(*)::int AS count
    FROM interviews, range
    WHERE ${interviewCreatedBucket} >= starts_at
    GROUP BY 1
    ORDER BY count DESC, status ASC
  `;
}
