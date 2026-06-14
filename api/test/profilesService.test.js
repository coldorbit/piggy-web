import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appliedFilterOwnerRoles,
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

  it('keeps finance manager applied filter ownership narrow', () => {
    assert.deepEqual(appliedFilterOwnerRoles({ role: ROLES.financeManager }), [ROLES.user]);
  });
});

describe('profile status helpers', () => {
  it('accepts legacy profile status without a close reason', () => {
    assert.deepEqual(profileStatusAttributesFromBody({ status: 'legacy' }), {
      profileStatus: 'legacy',
      closedReason: null,
      closedAt: null,
    });
  });

  it('sorts legacy profiles after non-legacy profiles', () => {
    const profiles = [
      profileRow({ id: 1, name: 'Legacy', profileStatus: 'legacy', createdAt: '2024-01-01T00:00:00.000Z' }),
      profileRow({ id: 2, name: 'Active', profileStatus: 'active', createdAt: '2024-02-01T00:00:00.000Z' }),
      profileRow({ id: 3, name: 'Closed', profileStatus: 'closed', createdAt: '2024-03-01T00:00:00.000Z' }),
    ];

    assert.deepEqual(sortProfilesForDisplay(profiles).map((profile) => profile.name), ['Active', 'Closed', 'Legacy']);
  });
});

function profileRow(values) {
  return values;
}
