import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Op } from 'sequelize';
import {
  bidAttributesFromBody,
  buildBidTabQuery,
  dailyGoalRangeForBidFilter,
  dailyGoalRangeForUserBidFilter,
  shouldRefreshBidAtForStatus,
  shouldSetInterviewAtForStatus,
} from '../server/modules/bidding/application/biddingService.js';

class JobBid {}

const sequelize = {
  escape(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
  },
};

describe('bidAttributesFromBody', () => {
  it('allows todo status only for interview row updates', () => {
    assert.throws(() => bidAttributesFromBody({ status: 'todo' }), /valid bid status/);

    const attrs = bidAttributesFromBody({ status: 'todo' }, { allowInterviewTodoStatus: true });
    assert.equal(attrs.status, 'todo');
    assert.equal(attrs.interviewStage, 'todo');
  });

  it('allows interview durations longer than two hours', () => {
    const attrs = bidAttributesFromBody({
      status: 'interviewing',
      interviewStage: 'technical_interview',
      interviewDurationMinutes: 180,
    });

    assert.equal(attrs.interviewDurationMinutes, 180);
  });
});

describe('buildBidTabQuery', () => {
  it('keeps tailored resume jobs on the todo tab until they are done', () => {
    const query = buildBidTabQuery({
      where: { source: 'linkedin' },
      tab: 'todo',
      profileId: 42,
      JobBid,
      sequelize,
    });

    assert.equal(query.include[0].required, false);
    assert.equal(query.include[0].where.profileId, 42);
    assert.equal(query.order, null);
    assert.deepEqual(query.where.source, 'linkedin');
    assert.equal(literalsFor(query).some((sql) => sql.includes('tailored_resumes')), false);
    assertHasPlannedBidClause(query);
  });

  it('filters the tailored tab to jobs with tailored resume activity that are not applied or bad work', () => {
    const query = buildBidTabQuery({
      where: {},
      tab: 'tailored',
      profileId: 42,
      JobBid,
      sequelize,
    });

    assert.equal(query.include[0].required, false);
    assert.equal(query.include[0].where.profileId, 42);
    assert.equal(
      literalsFor(query).some(
        (sql) =>
          sql.includes('EXISTS') &&
          sql.includes('tailored_resumes') &&
          sql.includes("'requested', 'processing', 'ready', 'dead_letter'") &&
          sql.includes("profile_id = '42'"),
      ),
      true,
    );
    assertHasPlannedBidClause(query);
    assertNoReviewBidClause(query);
    assert.equal(query.order[0][0].val.includes('MAX(tailored_resume.created_at)'), true);
    assert.equal(query.order[0][1], 'DESC NULLS LAST');
    assert.equal(query.order[1][0].val.includes('MAX(tailored_resume.updated_at)'), true);
    assert.equal(query.order[1][1], 'DESC NULLS LAST');
  });

  it('moves static profile ready bids to the tailored tab', () => {
    const query = buildBidTabQuery({
      where: {},
      tab: 'tailored',
      profileId: 42,
      isStaticProfile: true,
      JobBid,
      sequelize,
    });

    assert.equal(query.include[0].required, true);
    assert.equal(query.include[0].where.status, 'ready');
    assert.equal(literalsFor(query).some((sql) => sql.includes('tailored_resumes')), false);
  });

  it('excludes static profile ready bids from the todo tab', () => {
    const query = buildBidTabQuery({
      where: {},
      tab: 'todo',
      profileId: 42,
      isStaticProfile: true,
      JobBid,
      sequelize,
    });

    assert.deepEqual(todoStatusesFor(query), ['planned', 'queued', 'tailoring']);
  });

  it('requires submitted-style bids on the done tab', () => {
    const query = buildBidTabQuery({
      where: {},
      tab: 'done',
      profileId: 42,
      JobBid,
      sequelize,
    });

    assert.equal(query.include[0].required, true);
    assert.deepEqual(query.include[0].where.status[Op.in], ['submitted', 'needs_follow_up', 'stale', 'blocked', 'won', 'lost']);
    assert.deepEqual(query.order[0], [{ model: JobBid, as: 'bids' }, 'bidAt', 'DESC']);
    assert.equal(query.where[Op.and], undefined);
  });

  it('applies completed tab date filters to bid timestamps', () => {
    const from = new Date('2026-06-14T23:00:00.000Z');
    const to = new Date('2026-06-15T23:00:00.000Z');
    const query = buildBidTabQuery({
      where: {},
      tab: 'done',
      profileId: 42,
      bidDateRange: { from, to },
      JobBid,
      sequelize,
    });

    assert.equal(query.where.scrapedAt, undefined);
    assert.equal(query.include[0].where.bidAt[Op.gte], from);
    assert.equal(query.include[0].where.bidAt[Op.lt], to);
  });

  it('requires review bids on the bad work tab', () => {
    const query = buildBidTabQuery({
      where: {},
      tab: 'bad_work',
      profileId: 42,
      JobBid,
      sequelize,
    });

    assert.equal(query.include[0].required, true);
    assert.deepEqual(query.include[0].where.status[Op.in], ['mismatching_bid', 'spam_job']);
    assert.deepEqual(query.order[0], [{ model: JobBid, as: 'bids' }, 'bidAt', 'DESC']);
    assert.equal(query.where[Op.and], undefined);
  });

  it('adds cross-profile applied filtering only when requested', () => {
    const query = buildBidTabQuery({
      where: {},
      tab: 'todo',
      profileId: 42,
      appliedProfileId: 99,
      JobBid,
      sequelize,
    });

    assert.equal(
      literalsFor(query).some(
        (sql) =>
          sql.includes('FROM job_bids applied_bid') &&
          sql.includes("applied_bid.profile_id = '99'") &&
          sql.includes("'submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost'"),
      ),
      true,
    );
  });
});

describe('shouldRefreshBidAtForStatus', () => {
  it('refreshes bidAt when an unfinished bid is submitted today', () => {
    assert.equal(shouldRefreshBidAtForStatus('submitted', 'planned'), true);
    assert.equal(shouldRefreshBidAtForStatus('submitted', 'mismatching_bid'), true);
    assert.equal(shouldRefreshBidAtForStatus('submitted', 'spam_job'), true);
  });

  it('does not move bidAt for interview or outcome status changes', () => {
    assert.equal(shouldRefreshBidAtForStatus('interviewing', 'planned'), false);
    assert.equal(shouldRefreshBidAtForStatus('won', 'planned'), false);
    assert.equal(shouldRefreshBidAtForStatus('lost', 'planned'), false);
    assert.equal(shouldRefreshBidAtForStatus('interviewing', 'submitted'), false);
    assert.equal(shouldRefreshBidAtForStatus('won', 'interviewing'), false);
    assert.equal(shouldRefreshBidAtForStatus('lost', 'submitted'), false);
    assert.equal(shouldRefreshBidAtForStatus('planned', 'submitted'), false);
  });
});

describe('shouldSetInterviewAtForStatus', () => {
  it('sets interviewAt when an application first enters interviewing', () => {
    assert.equal(shouldSetInterviewAtForStatus('interviewing', 'submitted', null), true);
    assert.equal(shouldSetInterviewAtForStatus('interviewing', 'planned', undefined), true);
  });

  it('keeps an existing interviewAt and ignores non-interview statuses', () => {
    assert.equal(shouldSetInterviewAtForStatus('interviewing', 'submitted', new Date()), false);
    assert.equal(shouldSetInterviewAtForStatus('won', 'submitted', null), false);
    assert.equal(shouldSetInterviewAtForStatus('submitted', 'interviewing', null), false);
  });
});

describe('dailyGoalRangeForBidFilter', () => {
  it('collapses through-today and until-yesterday drawer filters to one local day', () => {
    const now = new Date('2026-06-16T14:00:00.000Z');
    const throughToday = dailyGoalRangeForBidFilter({ since: 'through_today' }, now);
    const today = dailyGoalRangeForBidFilter({ since: 'today' }, now);
    const untilYesterday = dailyGoalRangeForBidFilter({ since: 'until_yesterday' }, now);
    const yesterday = dailyGoalRangeForBidFilter({ since: 'yesterday' }, now);

    assert.equal(throughToday.from.toISOString(), '2026-06-16T04:00:00.000Z');
    assert.equal(throughToday.to.toISOString(), '2026-06-17T04:00:00.000Z');
    assert.equal(today.from.toISOString(), throughToday.from.toISOString());
    assert.equal(today.to.toISOString(), throughToday.to.toISOString());
    assert.equal(untilYesterday.from.toISOString(), '2026-06-15T04:00:00.000Z');
    assert.equal(untilYesterday.to.toISOString(), '2026-06-16T04:00:00.000Z');
    assert.equal(yesterday.from.toISOString(), untilYesterday.from.toISOString());
    assert.equal(yesterday.to.toISOString(), untilYesterday.to.toISOString());
  });

  it('uses custom drawer dates with local day boundaries', () => {
    const range = dailyGoalRangeForBidFilter({ since: 'custom', dateFrom: '2026-06-10', dateTo: '2026-06-11' });

    assert.equal(range.from.toISOString(), '2026-06-10T04:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-12T04:00:00.000Z');
  });
});

describe('dailyGoalRangeForUserBidFilter', () => {
  it('counts each user by their local calendar day', () => {
    const now = new Date('2026-06-16T06:30:00.000Z');
    const losAngeles = dailyGoalRangeForUserBidFilter({ since: 'today' }, { timezone: 'America/Los_Angeles' }, now);
    const newYork = dailyGoalRangeForUserBidFilter({ since: 'today' }, { timezone: 'America/New_York' }, now);

    assert.equal(losAngeles.from.toISOString(), '2026-06-15T07:00:00.000Z');
    assert.equal(losAngeles.to.toISOString(), '2026-06-16T07:00:00.000Z');
    assert.equal(newYork.from.toISOString(), '2026-06-16T04:00:00.000Z');
    assert.equal(newYork.to.toISOString(), '2026-06-17T04:00:00.000Z');
  });

  it('uses custom dates in the contributor timezone', () => {
    const range = dailyGoalRangeForUserBidFilter(
      { since: 'custom', dateFrom: '2026-06-10', dateTo: '2026-06-10' },
      { timezone: 'Asia/Manila' },
    );

    assert.equal(range.from.toISOString(), '2026-06-09T16:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-10T16:00:00.000Z');
  });
});

function literalsFor(query) {
  return (query.where[Op.and] || [])
    .filter((clause) => typeof clause?.val === 'string')
    .map((clause) => clause.val);
}

function assertHasPlannedBidClause(query) {
  assert.equal(
    (query.where[Op.and] || []).some(
      (clause) =>
        clause?.[Op.or]?.some((condition) =>
          ['planned', 'queued', 'tailoring', 'ready'].every((status) =>
            condition?.['$bids.status$']?.[Op.in]?.includes(status),
          ),
        ),
    ),
    true,
  );
}

function todoStatusesFor(query) {
  const clause = (query.where[Op.and] || []).find((item) =>
    item?.[Op.or]?.some((condition) => condition?.['$bids.status$']?.[Op.in]),
  );
  return clause?.[Op.or]?.find((condition) => condition?.['$bids.status$']?.[Op.in])?.['$bids.status$']?.[Op.in] || [];
}

function assertNoReviewBidClause(query) {
  assert.equal(
    (query.where[Op.and] || []).some(
      (clause) =>
        clause?.[Op.or]?.some(
          (condition) => condition?.['$bids.status$']?.[Op.in]?.includes('mismatching_bid')
            && condition?.['$bids.status$']?.[Op.in]?.includes('spam_job'),
        ),
    ),
    false,
  );
}
