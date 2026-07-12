import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transferOwnedProfiles, userAttributesFromBody, workspaceMembershipIdsChanged } from '../server/modules/admin/application/usersService.js';

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

  it('defaults users to the platform timezone', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'user' }), { requirePassword: true });

    assert.equal(attrs.timezone, 'America/New_York');
  });

  it('accepts a workspace assignment', () => {
    const attrs = userAttributesFromBody(validUserBody({ workspaceId: 42 }), { requirePassword: true });

    assert.equal(attrs.workspaceId, 42);
  });

  it('accepts extra workspaces for bidder roles', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'editable_bidder', workspaceMembershipIds: ['42', 43] }), { requirePassword: true });

    assert.deepEqual(attrs.workspaceMembershipIds, [42, 43]);
  });

  it('accepts extra workspaces for admin roles', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'admin', workspaceMembershipIds: ['42', 43] }), { requirePassword: true });

    assert.deepEqual(attrs.workspaceMembershipIds, [42, 43]);
  });

  it('drops extra workspaces for non-bidder roles', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'user', workspaceMembershipIds: [42] }), { requirePassword: true });

    assert.deepEqual(attrs.workspaceMembershipIds, []);
  });

  it('rejects invalid workspace assignments', () => {
    assert.throws(
      () => userAttributesFromBody(validUserBody({ workspaceId: 'workspace' }), { requirePassword: true }),
      /Workspace is required/,
    );
  });

  it('rejects invalid extra workspace assignments', () => {
    assert.throws(
      () => userAttributesFromBody(validUserBody({ role: 'readonly_bidder', workspaceMembershipIds: ['workspace'] }), { requirePassword: true }),
      /Additional workspaces/,
    );
  });

  it('accepts valid IANA timezones', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'user', timezone: 'America/Los_Angeles' }), { requirePassword: true });

    assert.equal(attrs.timezone, 'America/Los_Angeles');
  });

  it('does not assign bid goals to admins', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'admin', dailyBidGoal: 75 }), { requirePassword: true });

    assert.equal(attrs.dailyBidGoal, null);
  });

  it('accepts the Profile Hub entitlement only for admin records', () => {
    assert.equal(
      userAttributesFromBody(validUserBody({ role: 'admin', profileHubAccess: true }), { requirePassword: true }).profileHubAccess,
      true,
    );
    assert.equal(
      userAttributesFromBody(validUserBody({ role: 'user', profileHubAccess: true }), { requirePassword: true }).profileHubAccess,
      false,
    );
    assert.equal(
      userAttributesFromBody(validUserBody({ role: 'internal' }), { requirePassword: true }).profileHubAccess,
      false,
    );
  });

  it('accepts guest users without bid goals', () => {
    const attrs = userAttributesFromBody(validUserBody({ role: 'guest', dailyBidGoal: 75 }), { requirePassword: true });

    assert.equal(attrs.role, 'guest');
    assert.equal(attrs.dailyBidGoal, null);
  });

  it('rejects invalid daily bid goals', () => {
    assert.throws(
      () => userAttributesFromBody(validUserBody({ role: 'user', dailyBidGoal: 0 }), { requirePassword: true }),
      /Daily bid goal/,
    );
  });

  it('rejects invalid timezones', () => {
    assert.throws(
      () => userAttributesFromBody(validUserBody({ role: 'user', timezone: 'PST' }), { requirePassword: true }),
      /valid timezone/,
    );
  });
});

describe('workspace user transfers', () => {
  it('moves every profile owned by the user to the destination workspace', async () => {
    const calls = [];
    const transaction = { id: 'transaction-1' };
    const Profile = {
      async update(values, options) {
        calls.push({ values, options });
        return [3];
      },
    };

    const count = await transferOwnedProfiles({ Profile, transaction, userId: 42, workspaceId: 9 });

    assert.equal(count, 3);
    assert.deepEqual(calls, [{
      values: { workspaceId: 9 },
      options: { where: { userId: 42 }, transaction },
    }]);
  });
});

describe('multi-workspace membership changes', () => {
  const user = {
    workspaceId: 7,
    workspaceMemberships: [{ workspaceId: 8, status: 'active' }, { workspaceId: 9, status: 'active' }],
  };

  it('treats reordered existing memberships as unchanged', () => {
    assert.equal(workspaceMembershipIdsChanged(user, [9, 8]), false);
  });

  it('detects added or removed workspace memberships', () => {
    assert.equal(workspaceMembershipIdsChanged(user, [8]), true);
    assert.equal(workspaceMembershipIdsChanged(user, [8, 9, 10]), true);
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
