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
    assert.match(sql, /bid_totals AS \([\s\S]*FROM job_bids[\s\S]*CROSS JOIN current_period_utc[\s\S]*bid_at >= current_period_utc\.starts_at[\s\S]*bid_at < current_period_utc\.ends_at/);
    assert.match(sql, /period_bid_totals AS \([\s\S]*job_bids\.status NOT IN \('mismatching_bid', 'spam_job'\)[\s\S]*AS period_total_bids[\s\S]*'internal'[\s\S]*AS period_user_role_bids[\s\S]*AS period_bidder_bids[\s\S]*LEFT JOIN web_users ON web_users\.id = job_bids\.user_id[\s\S]*job_bids\.bid_at >= current_period_utc\.starts_at[\s\S]*job_bids\.bid_at < current_period_utc\.ends_at/);
    assert.match(sql, /tailoring_totals AS \([\s\S]*FROM tailored_resumes[\s\S]*CROSS JOIN current_period_utc[\s\S]*created_at >= current_period_utc\.starts_at[\s\S]*created_at < current_period_utc\.ends_at/);
    assert.doesNotMatch(sql, /daily_bid_totals/);
    assert.doesNotMatch(sql, /WHERE job_bids\.status IN \('submitted'/);
    assert.doesNotMatch(sql, /timezone\('America\/Los_Angeles', job_bids\.bid_at\) >= current_period/);
  });

  it('counts user interviews by creation date while keeping outcomes activity-based', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).users;

    assert.match(sql, /interview_created_metrics AS \([\s\S]*COUNT\(\*\)::int AS interviews[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.match(sql, /interview_activity_metrics AS \([\s\S]*timezone\('America\/Los_Angeles', COALESCE\(interviews\.updated_at, interviews\.created_at\)\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', COALESCE\(interviews\.updated_at, interviews\.created_at\)\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.doesNotMatch(sql, /interview_activity_metrics AS \([\s\S]*COUNT\(\*\)::int AS interviews/);
  });

  it('counts caller assignments by creation date while keeping caller outcomes activity-based', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).callers;

    assert.match(sql, /caller_created_metrics AS \([\s\S]*COUNT\(\*\)::int AS assigned_interviews[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.match(sql, /caller_activity_metrics AS \([\s\S]*timezone\('America\/Los_Angeles', COALESCE\(updated_at, created_at\)\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', COALESCE\(updated_at, created_at\)\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
  });

  it('counts bidder interviews by scheduled date without relying on application dates', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).bidders;

    assert.match(sql, /bid_metrics AS \([\s\S]*WHERE date_trunc\('day', timezone\('America\/Los_Angeles', job_bids\.bid_at\)\) >= range\.starts_at[\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', job_bids\.bid_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.match(sql, /scheduled_interview_metrics AS \([\s\S]*COALESCE\(job_bids\.user_id, interviews\.user_id\) AS user_id[\s\S]*LEFT JOIN job_bids ON job_bids\.id = interviews\.job_bid_id[\s\S]*interviews\.interview_next_at IS NOT NULL[\s\S]*timezone\('America\/Los_Angeles', interviews\.interview_next_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.interview_next_at\) < current_period\.ends_at/);
    assert.match(sql, /GROUP BY COALESCE\(job_bids\.user_id, interviews\.user_id\)/);
    assert.doesNotMatch(sql, /WHERE timezone\('America\/Los_Angeles', job_bids\.bid_at\)\) >= starts_at[\s\S]*COUNT\(DISTINCT job_bids\.id\) FILTER \([\s\S]*interviews/);
  });

  it('keeps interview breakdown counts aligned with interview creation totals', () => {
    const queries = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' });

    assert.match(queries.interviewStages, /timezone\('America\/Los_Angeles', created_at\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.doesNotMatch(queries.interviewStages, /COALESCE\(updated_at, created_at\)/);
    assert.match(queries.interviewStatuses, /timezone\('America\/Los_Angeles', created_at\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.doesNotMatch(queries.interviewStatuses, /COALESCE\(updated_at, created_at\)/);
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

    assert.match(queries.profileActivity, /job_bids\.bid_at\)\) >= range\.starts_at[\s\S]*job_bids\.bid_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.match(queries.sources, /job_bids\.bid_at\)\) >= range\.starts_at[\s\S]*job_bids\.bid_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.match(queries.bidStatuses, /bid_at\)\) >= range\.starts_at[\s\S]*bid_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
  });

  it('uses interviews table rows as the dashboard funnel source of truth', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).profileFunnels;

    assert.match(sql, /COUNT\(DISTINCT interviews\.id\)::int AS interviews/);
    assert.match(sql, /COUNT\(DISTINCT interviews\.id\) FILTER \(WHERE interviews\.status = 'won'\)::int AS offers/);
    assert.match(sql, /COUNT\(DISTINCT interviews\.id\) FILTER \(WHERE interviews\.status = 'lost'\)::int AS lost/);
    assert.match(sql, /JOIN interviews ON interviews\.profile_id = bid_profiles\.id/);
    assert.match(sql, /timezone\('America\/Los_Angeles', interviews\.created_at\)\) >= range\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\)\) < \(range\.ends_at \+ range\.bucket_step\)/);
    assert.doesNotMatch(sql, /LEFT JOIN interviews ON interviews\.job_bid_id = job_bids\.id/);
    assert.doesNotMatch(sql, /job_bids\.status IN \('interviewing', 'won', 'lost'\)/);
    assert.doesNotMatch(sql, /COALESCE\(interviews\.status, job_bids\.status\)/);
  });
});
