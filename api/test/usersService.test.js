import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { userAttributesFromBody } from '../server/modules/admin/application/usersService.js';

describe('userAttributesFromBody daily bid goals', () => {
  it('defaults regular users to 100 daily bids', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'user' }), { requirePassword: true });

    assert.equal(attrs.dailyBidGoal, 100);
  });

  it('defaults bidder roles to 50 daily bids', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'editable_bidder' }), { requirePassword: true });

    assert.equal(attrs.dailyBidGoal, 50);
  });

  it('allows admins to override eligible role goals', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'readonly_bidder', dailyBidGoal: 75 }), { requirePassword: true });

    assert.equal(attrs.dailyBidGoal, 75);
  });

  it('does not assign bid goals to admins', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'admin', dailyBidGoal: 75 }), { requirePassword: true });

    assert.equal(attrs.dailyBidGoal, null);
  });

  it('rejects invalid daily bid goals', () => {
    assert.throws(
      () => userAttributesFromBody(validUserBody({ role: 'user', dailyBidGoal: 0 }), { requirePassword: true }),
      /Daily bid goal/,
    );
  });
});

function validUserBody(overrides = {}) {
  return {
    email: 'bidder@example.com',
    username: 'bidder',
    password: 'password123',
    role: 'user',
    ...overrides,
  };
}
