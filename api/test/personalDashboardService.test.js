import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPeriodActivity, personalDashboardQueries } from '../server/modules/bidding/application/personalDashboardService.js';

describe('personal dashboard period activity', () => {
  it('returns separate owned-profile and actor bid totals', () => {
    assert.deepEqual(formatPeriodActivity({
      period_bids: '42',
      period_user_bids: '17',
      period_interviews: '3',
      period_newly_scheduled_interviews: '2',
    }), {
      totalBids: 42,
      userBids: 17,
      interviews: 3,
      newlyScheduledInterviews: 2,
    });
  });

  it('filters bids, interviews, and newly scheduled interviews to the selected local day', () => {
    const sql = personalDashboardQueries('America/Los_Angeles', {
      grain: 'daily',
      anchorDate: new Date('2026-07-16T18:00:00.000Z'),
    }).overall;

    assert.match(sql, /selected_period AS \([\s\S]*date_trunc\('day', timezone\('America\/Los_Angeles', '2026-07-16T18:00:00\.000Z'::timestamptz\)\) AS starts_at/);
    assert.match(sql, /owned_bids ob CROSS JOIN selected_period[\s\S]*timezone\('America\/Los_Angeles', ob\.bid_at\) >= selected_period\.starts_at[\s\S]*AS period_bids/);
    assert.match(sql, /ob\.bid_at >= selected_period\.starts_at_utc AND ob\.bid_at < selected_period\.ends_at_utc/);
    assert.match(sql, /user_bids AS \([\s\S]*WHERE jb\.user_id = :userId[\s\S]*user_bids ub CROSS JOIN selected_period[\s\S]*timezone\('America\/Los_Angeles', ub\.bid_at\) >= selected_period\.starts_at[\s\S]*AS period_user_bids/);
    assert.match(sql, /ub\.bid_at >= selected_period\.starts_at_utc AND ub\.bid_at < selected_period\.ends_at_utc/);
    assert.match(sql, /interview_calls ic JOIN owned_interviews oi ON oi\.id = ic\.interview_id CROSS JOIN selected_period[\s\S]*timezone\('America\/Los_Angeles', ic\.scheduled_at\) >= selected_period\.starts_at[\s\S]*AS period_interviews/);
    assert.match(sql, /COUNT\(DISTINCT il\.interview_id\)[\s\S]*interview_logs il JOIN owned_interviews oi ON oi\.id = il\.interview_id[\s\S]*il\.event_type = 'first_scheduled'[\s\S]*timezone\('America\/Los_Angeles', il\.created_at\) >= selected_period\.starts_at[\s\S]*AS period_newly_scheduled_interviews/);
  });

  it('uses Sunday as the start of a selected week', () => {
    const sql = personalDashboardQueries('America/New_York', {
      grain: 'weekly',
      anchorDate: new Date('2026-07-16T18:00:00.000Z'),
    }).overall;

    assert.match(sql, /EXTRACT\(DOW FROM timezone\('America\/New_York', '2026-07-16T18:00:00\.000Z'::timestamptz\)\)::int \* interval '1 day'/);
    assert.match(sql, /interval '1 week'/);
  });

  it('filters finance consumption to the same selected period', () => {
    const sql = personalDashboardQueries('America/New_York', {
      grain: 'monthly',
      anchorDate: new Date('2026-07-16T18:00:00.000Z'),
    }).consumption;

    assert.match(sql, /WITH selected_period AS/);
    assert.match(sql, /CROSS JOIN selected_period/);
    assert.match(sql, /timezone\('America\/New_York', consumption_transactions\.occurred_at\) >= selected_period\.starts_at/);
    assert.match(sql, /timezone\('America\/New_York', consumption_transactions\.occurred_at\) < selected_period\.ends_at/);
    assert.match(sql, /consumption_transactions\.occurred_at >= selected_period\.starts_at_utc AND consumption_transactions\.occurred_at < selected_period\.ends_at_utc/);
  });
});
