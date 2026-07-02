import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appliedFilterProfileWhere,
  forwardingAliasForProfileName,
  isProfileInUserWorkspace,
  profileAttributesFromBody,
  profileStatusAttributesFromBody,
  sortProfilesForDisplay,
  workspaceProfileWhereForUser,
} from '../server/modules/bidding/application/profilesService.js';
import { ROLES } from '../server/utils/roles.js';

describe('appliedFilterProfileWhere', () => {
  it('limits applied filter profiles to active profiles in the selected category', () => {
    assert.deepEqual(appliedFilterProfileWhere({ profileBadge: 'ml' }), {
      profileStatus: 'active',
      profileBadge: 'ML',
    });
  });

  it('keeps the broad active profile query when no active profile category is available', () => {
    assert.deepEqual(appliedFilterProfileWhere(), { profileStatus: 'active' });
  });

  it('limits applied filter profiles to the user workspace when provided', () => {
    assert.deepEqual(appliedFilterProfileWhere({ profileBadge: 'swe', workspaceId: 42 }), {
      profileStatus: 'active',
      workspaceId: 42,
      profileBadge: 'SWE',
    });
  });

  it('keeps unassigned users scoped to unassigned profiles', () => {
    assert.deepEqual(appliedFilterProfileWhere({ workspaceId: null }), {
      profileStatus: 'active',
      workspaceId: null,
    });
  });
});

describe('profile workspace helpers', () => {
  it('matches profiles only inside the same workspace for non-superadmins', () => {
    assert.equal(isProfileInUserWorkspace({ workspaceId: 7 }, { role: ROLES.user, workspaceId: 7 }), true);
    assert.equal(isProfileInUserWorkspace({ workspaceId: 8 }, { role: ROLES.user, workspaceId: 7 }), false);
    assert.equal(isProfileInUserWorkspace({ workspaceId: null }, { role: ROLES.user, workspaceId: 7 }), false);
  });

  it('treats unassigned users as scoped to unassigned profiles only', () => {
    assert.equal(isProfileInUserWorkspace({ workspaceId: null }, { role: ROLES.user, workspaceId: null }), true);
    assert.equal(isProfileInUserWorkspace({ workspaceId: 7 }, { role: ROLES.user, workspaceId: null }), false);
  });

  it('allows superadmins to cross workspace boundaries', () => {
    assert.equal(isProfileInUserWorkspace({ workspaceId: 8 }, { role: ROLES.superadmin, workspaceId: 7 }), true);
    assert.equal(workspaceProfileWhereForUser({ role: ROLES.superadmin, workspaceId: 7 }), undefined);
  });

  it('builds exact workspace filters for non-superadmins', () => {
    assert.deepEqual(workspaceProfileWhereForUser({ role: ROLES.admin, workspaceId: 7 }), { workspaceId: 7 });
    assert.deepEqual(workspaceProfileWhereForUser({ role: ROLES.user, workspaceId: null }), { workspaceId: null });
  });
});

describe('profile status helpers', () => {
  it('accepts a profile daily bid goal', () => {
    assert.equal(profileAttributesFromBody({ name: 'SWE', dailyBidGoal: '25' }, { canSetDailyBidGoal: true }).dailyBidGoal, 25);
  });

  it('defaults an empty profile daily bid goal to 60', () => {
    assert.equal(profileAttributesFromBody({ name: 'SWE', dailyBidGoal: '' }, { canSetDailyBidGoal: true }).dailyBidGoal, 60);
  });

  it('defaults new profile daily bid goals to 60', () => {
    assert.equal(profileAttributesFromBody({ name: 'SWE' }).dailyBidGoal, 60);
  });

  it('accepts expanded profile color options', () => {
    assert.equal(profileAttributesFromBody({ name: 'SWE', colorScheme: 'teal' }).colorScheme, 'teal');
  });

  it('defaults forwarding aliases to service plus first name', () => {
    assert.equal(
      profileAttributesFromBody({ name: 'Tiep Nguyen' }).forwardingEmail,
      'service+tiep@co-bounce.com',
    );
  });

  it('preserves explicit forwarding aliases', () => {
    assert.equal(
      profileAttributesFromBody({ name: 'Tiep Nguyen', forwardingEmail: 'service+tiep-nguyen@co-bounce.com' }).forwardingEmail,
      'service+tiep-nguyen@co-bounce.com',
    );
  });

  it('builds forwarding aliases from email-safe first names', () => {
    assert.equal(forwardingAliasForProfileName('Élodie Smith'), 'service+elodie@co-bounce.com');
    assert.equal(forwardingAliasForProfileName('Jean-Luc Picard'), 'service+jeanluc@co-bounce.com');
  });

  it('preserves profile daily bid goals for non-admin updates', () => {
    assert.equal(
      profileAttributesFromBody({ name: 'SWE', dailyBidGoal: '100' }, { currentDailyBidGoal: 42 }).dailyBidGoal,
      42,
    );
  });

  it('rejects invalid profile daily bid goals', () => {
    assert.throws(
      () => profileAttributesFromBody({ name: 'SWE', dailyBidGoal: '2.5' }, { canSetDailyBidGoal: true }),
      /Daily bid goal/,
    );
  });

  it('accepts legacy profile status without a close reason', () => {
    assert.deepEqual(profileStatusAttributesFromBody({ status: 'legacy' }), {
      profileStatus: 'legacy',
      closedReason: null,
      closedAt: null,
    });
  });

  it('accepts draft profile status without a close reason', () => {
    assert.deepEqual(profileStatusAttributesFromBody({ status: 'draft' }), {
      profileStatus: 'draft',
      closedReason: null,
      closedAt: null,
    });
  });

  it('sorts draft and legacy profiles after active profiles', () => {
    const profiles = [
      profileRow({ id: 1, name: 'Legacy', profileStatus: 'legacy', createdAt: '2024-01-01T00:00:00.000Z' }),
      profileRow({ id: 2, name: 'Active', profileStatus: 'active', createdAt: '2024-02-01T00:00:00.000Z' }),
      profileRow({ id: 3, name: 'Closed', profileStatus: 'closed', createdAt: '2024-03-01T00:00:00.000Z' }),
      profileRow({ id: 4, name: 'Draft', profileStatus: 'draft', createdAt: '2024-01-15T00:00:00.000Z' }),
    ];

    assert.deepEqual(sortProfilesForDisplay(profiles).map((profile) => profile.name), ['Active', 'Closed', 'Draft', 'Legacy']);
  });
});

function profileRow(values) {
  return values;
}
