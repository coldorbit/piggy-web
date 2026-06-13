import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appliedFilterOwnerRoles } from '../server/modules/bidding/application/profilesService.js';
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
