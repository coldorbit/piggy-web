import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canWriteInterviewForProfile, groupedBidJobs } from '../server/modules/bidding/presentation/biddingController.js';
import { ROLES } from '../server/utils/roles.js';

describe('groupedBidJobs', () => {
  it('uses a stable group id while promoting the tailored representative', () => {
    const firstRows = groupedBidJobs([
      bidJob({ id: 101, location: 'Austin, TX' }),
      bidJob({ id: 202, location: 'Remote', tailoredResume: { id: 55, status: 'requested' } }),
    ]);
    const secondRows = groupedBidJobs([
      bidJob({ id: 202, location: 'Remote', tailoredResume: { id: 55, status: 'requested' } }),
      bidJob({ id: 101, location: 'Austin, TX' }),
    ]);

    assert.equal(firstRows.length, 1);
    assert.equal(firstRows[0].groupId, secondRows[0].groupId);
    assert.equal(firstRows[0].id, 202);
    assert.equal(firstRows[0].representativeJobId, 202);
    assert.deepEqual(
      firstRows[0].locationOptions.map((option) => option.id),
      [101, 202],
    );
  });

  it('chooses a deterministic representative when no row has tailoring activity', () => {
    const [group] = groupedBidJobs([
      bidJob({ id: 101, location: 'Austin, TX', scrapedAt: '2026-01-01T00:00:00.000Z' }),
      bidJob({ id: 202, location: 'Remote', scrapedAt: '2026-01-02T00:00:00.000Z' }),
    ]);

    assert.equal(group.id, 202);
    assert.equal(group.representativeJobId, 202);
    assert.equal(group.groupId, 'bid-job-group:builtin::software engineer::built in');
  });

  it('does not collapse matching title and company rows from different source values', () => {
    const rows = groupedBidJobs([
      bidJob({ id: 101, source: 'builtin', location: 'Austin, TX' }),
      bidJob({ id: 202, source: 'Built In', location: 'Remote' }),
    ]);

    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.groupId),
      ['bid-job-group:builtin::software engineer::built in', 'bid-job-group:built in::software engineer::built in'],
    );
  });
});

describe('canWriteInterviewForProfile', () => {
  it('allows user role owners to modify their interviews', () => {
    assert.equal(
      canWriteInterviewForProfile({ id: 7, role: ROLES.user }, { userId: 7 }),
      true,
    );
  });

  it('allows admins to modify interviews across profiles', () => {
    assert.equal(
      canWriteInterviewForProfile({ id: 1, role: ROLES.admin }, { userId: 7 }),
      true,
    );
  });

  it('blocks non-owner user role users', () => {
    assert.equal(
      canWriteInterviewForProfile({ id: 8, role: ROLES.user }, { userId: 7 }),
      false,
    );
  });

  it('blocks callers and bidder roles from direct interview writes', () => {
    assert.equal(
      canWriteInterviewForProfile({ id: 7, role: ROLES.caller }, { userId: 7 }),
      false,
    );
    assert.equal(
      canWriteInterviewForProfile({ id: 7, role: ROLES.editableBidder }, { userId: 7 }),
      false,
    );
  });
});

function bidJob(overrides = {}) {
  return {
    id: 1,
    title: 'Software Engineer',
    company: 'Built In',
    location: 'Remote',
    postedAt: null,
    scrapedAt: '2026-01-01T00:00:00.000Z',
    url: `https://builtin.com/jobs/${overrides.id || 1}`,
    source: 'builtin',
    tailoredResume: null,
    ...overrides,
  };
}
