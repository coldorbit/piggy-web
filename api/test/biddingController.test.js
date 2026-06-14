import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupedBidJobs } from '../server/modules/bidding/presentation/biddingController.js';

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
    assert.equal(group.groupId, 'bid-job-group:software engineer::built in');
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
    tailoredResume: null,
    ...overrides,
  };
}
