import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Op } from 'sequelize';
import { buildBidTabQuery } from '../server/modules/bidding/application/biddingService.js';

class JobBid {}

const sequelize = {
  escape(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
  },
};

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
    assert.equal(query.order[0][0].val.includes('MAX(tailored_resume.updated_at)'), true);
    assert.equal(query.order[0][1], 'DESC NULLS LAST');
    assert.equal(query.order[1][0].val.includes('MAX(tailored_resume.created_at)'), true);
    assert.equal(query.order[1][1], 'DESC NULLS LAST');
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
    assert.deepEqual(query.include[0].where.status[Op.in], ['submitted', 'won', 'lost']);
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
          sql.includes("'submitted', 'interviewing', 'won', 'lost'"),
      ),
      true,
    );
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
      (clause) => clause?.[Op.or]?.some((condition) => condition?.['$bids.status$'] === 'planned'),
    ),
    true,
  );
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
