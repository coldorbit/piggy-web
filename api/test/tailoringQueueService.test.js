import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tailoredResumeEventWhere } from '../server/modules/bidding/application/tailoringQueueService.js';

test('profile tailoring streams include updates from owners and requesters', () => {
  const where = tailoredResumeEventWhere({
    userId: 11,
    profileId: '29',
    lastSeenAt: new Date('2026-08-05T15:00:00.000Z'),
  });

  assert.equal(where.profileId, '29');
  assert.equal(Object.hasOwn(where, 'userId'), false);
});

test('unscoped tailoring streams remain limited to the requester', () => {
  const where = tailoredResumeEventWhere({
    userId: 11,
    profileId: '',
    lastSeenAt: new Date('2026-08-05T15:00:00.000Z'),
  });

  assert.equal(where.userId, 11);
  assert.equal(Object.hasOwn(where, 'profileId'), false);
});
