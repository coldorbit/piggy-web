import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appliedFilterProfileWhere,
  appliedFilterOwnerRoles,
  forwardingAliasForProfileName,
  profileAttributesFromBody,
  profileStatusAttributesFromBody,
  sortProfilesForDisplay,
} from '../server/modules/bidding/application/profilesService.js';
import { BIDDER_ROLES, ROLES } from '../server/utils/roles.js';

describe('appliedFilterOwnerRoles', () => {
  it('lets user, admin, and superadmin roles filter by bidder-owned profiles', () => {
    for (const role of [ROLES.user, ROLES.admin, ROLES.superadmin]) {
      for (const bidderRole of BIDDER_ROLES) {
        assert.equal(
          appliedFilterOwnerRoles({ role }).includes(bidderRole),
          true,
          `${role} should see ${bidderRole} profiles in the applied using filter`,
        );
      }
    }
  });

  it('lets bidder roles filter by other user and bidder-owned profiles', () => {
    for (const role of BIDDER_ROLES) {
      assert.equal(appliedFilterOwnerRoles({ role }).includes(ROLES.user), true);
      for (const bidderRole of BIDDER_ROLES) {
        assert.equal(
          appliedFilterOwnerRoles({ role }).includes(bidderRole),
          true,
          `${role} should see ${bidderRole} profiles in the applied using filter`,
        );
      }
    }
  });

  it('keeps finance manager applied filter ownership narrow', () => {
    assert.deepEqual(appliedFilterOwnerRoles({ role: ROLES.financeManager }), [ROLES.user]);
  });
});

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
