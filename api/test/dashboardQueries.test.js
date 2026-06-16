import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dashboardQueries, grainConfigFor } from '../server/modules/admin/application/dashboardQueries.js';

describe('dashboard queries', () => {
  it('filters overall interview totals by scheduled date in the selected period', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).overall;

    assert.match(sql, /current_period AS \([\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', now\(\)\)\) AS starts_at/);
    assert.match(sql, /interview_totals AS \([\s\S]*FROM interviews[\s\S]*CROSS JOIN current_period[\s\S]*interview_next_at IS NOT NULL[\s\S]*timezone\('America\/Los_Angeles', interview_next_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interview_next_at\) < current_period\.ends_at/);
    assert.doesNotMatch(sql, /interview_totals AS \([\s\S]*FROM interviews, range/);
  });

  it('uses the calendar Sunday week for scheduled interview periods', () => {
    const sql = dashboardQueries(grainConfigFor('weekly'), { timeZone: 'America/Los_Angeles' }).bidders;

    assert.match(sql, /current_period AS \([\s\S]*EXTRACT\(DOW FROM timezone\('America\/Los_Angeles', now\(\)\)\)::int \* interval '1 day'/);
  });

  it('counts user interviews by creation date while keeping outcomes activity-based', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).users;

    assert.match(sql, /interview_created_metrics AS \([\s\S]*COUNT\(\*\)::int AS interviews[\s\S]*timezone\('America\/Los_Angeles', interviews\.created_at\)\) >= starts_at/);
    assert.match(sql, /interview_activity_metrics AS \([\s\S]*timezone\('America\/Los_Angeles', COALESCE\(interviews\.updated_at, interviews\.created_at\)\)\) >= starts_at/);
    assert.doesNotMatch(sql, /interview_activity_metrics AS \([\s\S]*COUNT\(\*\)::int AS interviews/);
  });

  it('counts caller assignments by creation date while keeping caller outcomes activity-based', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).callers;

    assert.match(sql, /caller_created_metrics AS \([\s\S]*COUNT\(\*\)::int AS assigned_interviews[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) >= starts_at/);
    assert.match(sql, /caller_activity_metrics AS \([\s\S]*timezone\('America\/Los_Angeles', COALESCE\(updated_at, created_at\)\)\) >= starts_at/);
  });

  it('counts bidder interviews by scheduled date without relying on application dates', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).bidders;

    assert.match(sql, /bid_metrics AS \([\s\S]*WHERE date_trunc\('day', timezone\('America\/Los_Angeles', job_bids\.bid_at\)\) >= starts_at/);
    assert.match(sql, /scheduled_interview_metrics AS \([\s\S]*COALESCE\(job_bids\.user_id, interviews\.user_id\) AS user_id[\s\S]*LEFT JOIN job_bids ON job_bids\.id = interviews\.job_bid_id[\s\S]*interviews\.interview_next_at IS NOT NULL[\s\S]*timezone\('America\/Los_Angeles', interviews\.interview_next_at\) >= current_period\.starts_at[\s\S]*timezone\('America\/Los_Angeles', interviews\.interview_next_at\) < current_period\.ends_at/);
    assert.match(sql, /GROUP BY COALESCE\(job_bids\.user_id, interviews\.user_id\)/);
    assert.doesNotMatch(sql, /WHERE timezone\('America\/Los_Angeles', job_bids\.bid_at\)\) >= starts_at[\s\S]*COUNT\(DISTINCT job_bids\.id\) FILTER \([\s\S]*interviews/);
  });

  it('keeps interview breakdown counts aligned with interview creation totals', () => {
    const queries = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' });

    assert.match(queries.interviewStages, /timezone\('America\/Los_Angeles', created_at\)\) >= starts_at/);
    assert.doesNotMatch(queries.interviewStages, /COALESCE\(updated_at, created_at\)/);
    assert.match(queries.interviewStatuses, /timezone\('America\/Los_Angeles', created_at\)\) >= starts_at/);
    assert.doesNotMatch(queries.interviewStatuses, /COALESCE\(updated_at, created_at\)/);
  });
});
