import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dashboardQueries, grainConfigFor } from '../server/modules/admin/application/dashboardQueries.js';

describe('dashboard queries', () => {
  it('filters overall interview totals by scheduled date in the selected period', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).overall;

    assert.match(sql, /current_period AS \([\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', now\(\)\)\) AS starts_at/);
    assert.match(sql, /current_period_utc AS \([\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', now\(\)\)\) AT TIME ZONE 'America\/Los_Angeles' AS starts_at/);
    assert.match(sql, /interview_totals AS \([\s\S]*FROM interviews[\s\S]*CROSS JOIN current_period_utc[\s\S]*interview_next_at IS NOT NULL[\s\S]*interview_next_at >= current_period_utc\.starts_at[\s\S]*interview_next_at < current_period_utc\.ends_at/);
    assert.doesNotMatch(sql, /interview_totals AS \([\s\S]*FROM interviews, range/);
  });

  it('uses the calendar Sunday week for scheduled interview periods', () => {
    const sql = dashboardQueries(grainConfigFor('weekly'), { timeZone: 'America/Los_Angeles' }).bidders;

    assert.match(sql, /current_period AS \([\s\S]*EXTRACT\(DOW FROM timezone\('America\/Los_Angeles', now\(\)\)\)::int \* interval '1 day'/);
  });

  it('uses the same Sunday week buckets for trend charts', () => {
    const sql = dashboardQueries(grainConfigFor('weekly'), { timeZone: 'America/Los_Angeles' }).trend;

    assert.match(sql, /WITH range AS \([\s\S]*EXTRACT\(DOW FROM timezone\('America\/Los_Angeles', now\(\)\)\)::int \* interval '1 day'/);
    assert.match(sql, /SELECT \(date_trunc\('day', timezone\('America\/Los_Angeles', scraped_at\)\) - \(EXTRACT\(DOW FROM timezone\('America\/Los_Angeles', scraped_at\)\)::int \* interval '1 day'\)\) AS bucket_start/);
    assert.doesNotMatch(sql, /date_trunc\('week', timezone/);
  });

  it('anchors dashboard periods to a requested date when provided', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), {
      anchorDate: new Date('2026-06-18T12:00:00.000Z'),
      timeZone: 'America/Los_Angeles',
    }).overall;

    assert.match(sql, /current_period AS \([\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', '2026-06-18T12:00:00\.000Z'::timestamptz\)\) AS starts_at/);
    assert.doesNotMatch(sql, /date_trunc\('day', timezone\('America\/Los_Angeles', now\(\)\)\) AS starts_at/);
  });

  it('filters overall cards to the selected current period', () => {
    const sql = dashboardQueries(grainConfigFor('weekly'), { timeZone: 'America/Los_Angeles' }).overall;

    assert.match(sql, /current_period_utc AS \([\s\S]*AT TIME ZONE 'America\/Los_Angeles' AS starts_at[\s\S]*AT TIME ZONE 'America\/Los_Angeles' AS ends_at/);
    assert.match(sql, /job_totals AS \([\s\S]*FROM scraped_jobs[\s\S]*CROSS JOIN current_period_utc[\s\S]*scraped_at >= current_period_utc\.starts_at[\s\S]*scraped_at < current_period_utc\.ends_at/);
    assert.match(sql, /bid_totals AS \([\s\S]*FROM job_bids[\s\S]*CROSS JOIN current_period[\s\S]*timezone\('America\/Los_Angeles', bid_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', bid_at\) < current_period\.ends_at/);
    assert.match(sql, /period_bid_totals AS \([\s\S]*job_bids\.status IN \('submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost'\)[\s\S]*AS period_total_bids[\s\S]*'internal'[\s\S]*AS period_user_role_bids[\s\S]*AS period_bidder_bids[\s\S]*LEFT JOIN web_users ON web_users\.id = job_bids\.user_id[\s\S]*timezone\('America\/Los_Angeles', job_bids\.bid_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', job_bids\.bid_at\) < current_period\.ends_at/);
    assert.match(sql, /tailoring_totals AS \([\s\S]*FROM tailored_resumes[\s\S]*CROSS JOIN current_period_utc[\s\S]*created_at >= current_period_utc\.starts_at[\s\S]*created_at < current_period_utc\.ends_at/);
    assert.doesNotMatch(sql, /daily_bid_totals/);
    assert.doesNotMatch(sql, /WHERE job_bids\.status NOT IN \('mismatching_bid', 'spam_job'\)/);
    assert.doesNotMatch(sql, /job_bids\.bid_at >= current_period_utc/);
  });

  it('applies workspace filters across dashboard datasets when provided', () => {
    const queries = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles', workspaceId: 42 });

    assert.match(queries.overall, /WHERE job_bids\.job_id = scraped_jobs\.id[\s\S]*AND bid_profiles\.workspace_id = 42/);
    assert.match(queries.trend, /WHERE job_bids\.job_id = scraped_jobs\.id[\s\S]*AND bid_profiles\.workspace_id = 42/);
    assert.match(queries.overall, /job_bids\.profile_id IN \(SELECT id FROM bid_profiles WHERE workspace_id = 42\)/);
    assert.match(queries.overall, /interviews\.profile_id IN \(SELECT id FROM bid_profiles WHERE workspace_id = 42\)/);
    assert.match(queries.overall, /tailored_resumes\.profile_id IN \(SELECT id FROM bid_profiles WHERE workspace_id = 42\)/);
    assert.match(queries.users, /web_users\.workspace_id = 42/);
    assert.match(queries.profileFunnels, /bid_profiles\.workspace_id = 42/);
  });

  it('counts user performance inside the selected period while keeping outcomes activity-based', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).users;

    assert.match(sql, /current_period AS \([\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', now\(\)\)\) AS starts_at/);
    assert.match(sql, /bid_metrics AS \([\s\S]*timezone\('America\/Los_Angeles', bid_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', bid_at\) < current_period\.ends_at/);
    assert.match(sql, /interview_created_metrics AS \([\s\S]*COUNT\(\*\)::int AS interviews[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\) < current_period\.ends_at/);
    assert.match(sql, /interview_activity_metrics AS \([\s\S]*timezone\('America\/Los_Angeles', COALESCE\(interviews\.updated_at, interviews\.created_at\)\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', COALESCE\(interviews\.updated_at, interviews\.created_at\)\) < current_period\.ends_at/);
    assert.doesNotMatch(sql, /interview_activity_metrics AS \([\s\S]*COUNT\(\*\)::int AS interviews/);
  });

  it('counts caller assignments by creation date while keeping caller outcomes activity-based', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).callers;

    assert.match(sql, /caller_created_metrics AS \([\s\S]*COUNT\(\*\)::int AS assigned_interviews[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.match(sql, /caller_activity_metrics AS \([\s\S]*timezone\('America\/Los_Angeles', COALESCE\(updated_at, created_at\)\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', COALESCE\(updated_at, created_at\)\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
  });

  it('counts bidder page metrics inside the selected period', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).bidders;

    assert.match(sql, /bid_metrics AS \([\s\S]*CROSS JOIN current_period[\s\S]*timezone\('America\/Los_Angeles', job_bids\.bid_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', job_bids\.bid_at\) < current_period\.ends_at/);
    assert.match(sql, /tailoring_metrics AS \([\s\S]*COUNT\(\*\)::int AS tailored_resume_requests[\s\S]*CROSS JOIN current_period[\s\S]*timezone\('America\/Los_Angeles', tailored_resumes\.created_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', tailored_resumes\.created_at\) < current_period\.ends_at/);
    assert.match(sql, /scheduled_interview_metrics AS \([\s\S]*COALESCE\(job_bids\.user_id, interviews\.user_id\) AS user_id[\s\S]*LEFT JOIN job_bids ON job_bids\.id = interviews\.job_bid_id[\s\S]*interviews\.interview_next_at IS NOT NULL[\s\S]*timezone\('America\/Los_Angeles', interviews\.interview_next_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.interview_next_at\) < current_period\.ends_at/);
    assert.match(sql, /GROUP BY COALESCE\(job_bids\.user_id, interviews\.user_id\)/);
    assert.match(sql, /web_users\.role IN \('user', 'finance_manager', 'internal', 'bidder', 'readonly_bidder', 'editable_bidder'\)/);
    assert.doesNotMatch(sql, /WHERE timezone\('America\/Los_Angeles', job_bids\.bid_at\)\) >= starts_at[\s\S]*COUNT\(DISTINCT job_bids\.id\) FILTER \([\s\S]*interviews/);
  });

  it('keeps interview breakdown counts aligned with interview creation totals', () => {
    const queries = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' });

    assert.match(queries.interviewStages, /current_period AS \([\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', now\(\)\)\) AS starts_at/);
    assert.match(queries.interviewStages, /timezone\('America\/Los_Angeles', created_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', created_at\) < current_period\.ends_at/);
    assert.doesNotMatch(queries.interviewStages, /COALESCE\(updated_at, created_at\)/);
    assert.match(queries.interviewStatuses, /timezone\('America\/Los_Angeles', created_at\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.doesNotMatch(queries.interviewStatuses, /COALESCE\(updated_at, created_at\)/);
  });

  it('filters dashboard breakdown charts to the selected period', () => {
    const queries = dashboardQueries(grainConfigFor('monthly'), {
      anchorDate: new Date('2026-06-18T12:00:00.000Z'),
      timeZone: 'America/Los_Angeles',
    });

    assert.match(queries.sources, /current_period AS \([\s\S]*date_trunc\('month', timezone\('America\/Los_Angeles', '2026-06-18T12:00:00\.000Z'::timestamptz\)\) AS starts_at/);
    assert.match(queries.sources, /timezone\('America\/Los_Angeles', job_bids\.bid_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', job_bids\.bid_at\) < current_period\.ends_at/);
    assert.match(queries.bidStatuses, /timezone\('America\/Los_Angeles', bid_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', bid_at\) < current_period\.ends_at/);
    assert.match(queries.interviewStages, /timezone\('America\/Los_Angeles', created_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', created_at\) < current_period\.ends_at/);
  });

  it('caps rolling dashboard metrics at the selected range end', () => {
    const queries = dashboardQueries(grainConfigFor('monthly'), {
      anchorDate: new Date('2026-06-18T12:00:00.000Z'),
      timeZone: 'America/Los_Angeles',
    });

    for (const [name, sql] of Object.entries(queries)) {
      if (['overall', 'bidders'].includes(name)) continue;
      assert.doesNotMatch(sql, />=\s*starts_at/);
    }

    assert.match(queries.profileActivity, /job_bids\.bid_at\) >= current_period\.starts_at[\s\S]*job_bids\.bid_at\) < current_period\.ends_at/);
    assert.match(queries.sources, /job_bids\.bid_at\) >= current_period\.starts_at[\s\S]*job_bids\.bid_at\) < current_period\.ends_at/);
    assert.match(queries.bidStatuses, /bid_at\) >= current_period\.starts_at[\s\S]*bid_at\) < current_period\.ends_at/);
  });

  it('uses interviews table rows as the dashboard funnel source of truth', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).profileFunnels;
    const roleFamilySql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).roleFamilyFunnels;

    assert.match(sql, /COUNT\(DISTINCT interviews\.id\)::int AS interviews/);
    assert.match(sql, /COUNT\(DISTINCT interviews\.id\) FILTER \(WHERE interviews\.status = 'won'\)::int AS offers/);
    assert.match(sql, /COUNT\(DISTINCT interviews\.id\) FILTER \(WHERE interviews\.status = 'lost'\)::int AS lost/);
    assert.match(sql, /JOIN interviews ON interviews\.profile_id = bid_profiles\.id/);
    assert.match(sql, /current_period AS \([\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', now\(\)\)\) AS starts_at/);
    assert.match(sql, /timezone\('America\/Los_Angeles', interviews\.created_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\) < current_period\.ends_at/);
    assert.doesNotMatch(sql, /LEFT JOIN interviews ON interviews\.job_bid_id = job_bids\.id/);
    assert.doesNotMatch(sql, /job_bids\.status IN \('interviewing', 'won', 'lost'\)/);
    assert.doesNotMatch(sql, /COALESCE\(interviews\.status, job_bids\.status\)/);

    assert.match(roleFamilySql, /application_metrics AS \([\s\S]*FROM job_bids[\s\S]*timezone\('America\/Los_Angeles', job_bids\.bid_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', job_bids\.bid_at\) < current_period\.ends_at/);
    assert.match(roleFamilySql, /interview_metrics AS \([\s\S]*COUNT\(DISTINCT interviews\.id\)::int AS interviews[\s\S]*FROM interviews[\s\S]*LEFT JOIN scraped_jobs ON scraped_jobs\.id = interviews\.job_id[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\) < current_period\.ends_at/);
    assert.match(roleFamilySql, /FULL OUTER JOIN interview_metrics ON interview_metrics\.role_family = application_metrics\.role_family/);
    assert.doesNotMatch(roleFamilySql, /LEFT JOIN interviews ON interviews\.job_bid_id = job_bids\.id/);
  });

  it('excludes admin actors from dashboard KPI queries', () => {
    const queries = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' });

    assert.match(queries.overall, /dashboard_non_admin_users\.role NOT IN \('superadmin', 'admin'\)/);
    assert.match(queries.trend, /dashboard_non_admin_users\.role NOT IN \('superadmin', 'admin'\)/);
    assert.match(queries.users, /WHERE web_users\.role NOT IN \('superadmin', 'admin'\)/);
    assert.match(queries.bidders, /WHERE web_users\.role NOT IN \('superadmin', 'admin'\)/);
    assert.match(queries.callers, /WHERE web_users\.role NOT IN \('superadmin', 'admin'\)/);
    assert.match(queries.profileFunnels, /dashboard_non_admin_users\.role NOT IN \('superadmin', 'admin'\)/);
    assert.match(queries.profileActivity, /web_users\.role NOT IN \('superadmin', 'admin'\)/);
    assert.doesNotMatch(queries.overall, /web_users\.role IN \('user', 'admin', 'superadmin', 'finance_manager', 'internal'\)/);
  });

  it('builds profile interview trends from selected-period interview creation buckets', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles', workspaceId: 42 }).profileInterviewTrend;

    assert.match(sql, /top_profiles AS \([\s\S]*JOIN interviews ON interviews\.profile_id = bid_profiles\.id/);
    assert.match(sql, /timezone\('America\/Los_Angeles', interviews\.created_at\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.match(sql, /bid_profiles\.workspace_id = 42/);
    assert.match(sql, /COALESCE\(profile_buckets\.interviews, 0\)::int AS interviews/);
    assert.match(sql, /FROM buckets[\s\S]*CROSS JOIN top_profiles[\s\S]*LEFT JOIN profile_buckets/);
  });
});
