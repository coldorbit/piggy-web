import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROLES,
  VALID_USER_ROLES,
  canAccessBidderDirectory,
  canAccessBidWorkspace,
  canAccessInbox,
  canAccessJobs,
  canAccessPersonalDashboard,
  canRegisterManualInterviewCalls,
  canManageCallers,
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

  it('keeps callers in interview-only surfaces and out of jobs/applications', () => {
    assert.equal(canAccessJobs({ role: ROLES.caller }), false);
    assert.equal(canAccessBidWorkspace({ role: ROLES.caller }), false);
    assert.equal(canAccessInbox({ role: ROLES.caller }), false);
  });

  it('separates bidder, inbox, and caller-management access by role family', () => {
    assert.equal(canAccessBidderDirectory({ role: ROLES.user }), true);
    assert.equal(canAccessBidderDirectory({ role: ROLES.editableBidder }), true);
    assert.equal(canAccessInbox({ role: ROLES.financeManager }), true);
    assert.equal(canAccessInbox({ role: ROLES.readonlyBidder }), false);
    assert.equal(canManageCallers({ role: ROLES.admin }), true);
    assert.equal(canManageCallers({ role: ROLES.user }), false);
  });

  it('allows only requested staff roles to register manual interview calls', () => {
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.superadmin }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.admin }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.user }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.financeManager }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.internal }), false);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.caller }), false);
  });
});
