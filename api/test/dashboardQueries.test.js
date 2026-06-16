import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dashboardQueries, grainConfigFor } from '../server/modules/admin/application/dashboardQueries.js';

describe('dashboard queries', () => {
  it('filters overall interview totals by the selected period', () => {
    const sql = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' }).overall;

    assert.match(sql, /interview_totals AS \([\s\S]*FROM interviews, range[\s\S]*timezone\('America\/Los_Angeles', created_at\)\) >= range\.starts_at/);
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

  it('keeps interview breakdown counts aligned with interview creation totals', () => {
    const queries = dashboardQueries(grainConfigFor('daily'), { timeZone: 'America/Los_Angeles' });

    assert.match(queries.interviewStages, /timezone\('America\/Los_Angeles', created_at\)\) >= starts_at/);
    assert.doesNotMatch(queries.interviewStages, /COALESCE\(updated_at, created_at\)/);
    assert.match(queries.interviewStatuses, /timezone\('America\/Los_Angeles', created_at\)\) >= starts_at/);
    assert.doesNotMatch(queries.interviewStatuses, /COALESCE\(updated_at, created_at\)/);
  });
});
