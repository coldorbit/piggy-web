import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROLES,
  VALID_USER_ROLES,
  canAccessBidWorkspace,
  canAccessJobs,
  canAccessPersonalDashboard,
} from '../server/utils/roles.js';

describe('role permissions', () => {
  it('treats guest as a valid managed user role', () => {
    assert.equal(VALID_USER_ROLES.includes(ROLES.guest), true);
  });

  it('limits guests to non-job, non-application surfaces', () => {
    assert.equal(canAccessJobs({ role: ROLES.guest }), false);
    assert.equal(canAccessBidWorkspace({ role: ROLES.guest }), false);
    assert.equal(canAccessPersonalDashboard({ role: ROLES.guest }), false);
  });

  it('does not grant workspace permissions to missing or unknown roles', () => {
    assert.equal(canAccessJobs(null), false);
    assert.equal(canAccessBidWorkspace(null), false);
    assert.equal(canAccessJobs({ role: 'unknown' }), false);
    assert.equal(canAccessBidWorkspace({ role: 'unknown' }), false);
  });

  it('keeps callers out of jobs while preserving application workspace access', () => {
    assert.equal(canAccessJobs({ role: ROLES.caller }), false);
    assert.equal(canAccessBidWorkspace({ role: ROLES.caller }), true);
  });
});
