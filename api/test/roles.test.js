import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROLES,
  VALID_USER_ROLES,
  MARKETPLACE_ACCESS_ROLES,
  INTERNAL_DATA_ROLES,
  canAccessAssessments,
  canAccessBidderDirectory,
  canAccessBidWorkspace,
  canAccessConsumption,
  canAccessInterviews,
  canAccessInbox,
  canAccessJobs,
  canAccessLearningHub,
  canAccessPersonalDashboard,
  canAccessProfileHub,
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

  it('treats internal as elevated staff without granting admin-only caller management', () => {
    assert.equal(VALID_USER_ROLES.includes(ROLES.internal), true);
    assert.equal(canAccessJobs({ role: ROLES.internal }), true);
    assert.equal(canAccessBidWorkspace({ role: ROLES.internal }), true);
    assert.equal(canAccessInbox({ role: ROLES.internal }), true);
    assert.equal(canAccessBidderDirectory({ role: ROLES.internal }), true);
    assert.equal(canAccessInterviews({ role: ROLES.internal }), true);
    assert.equal(canAccessAssessments({ role: ROLES.internal }), true);
    assert.equal(canAccessPersonalDashboard({ role: ROLES.internal }), true);
    assert.equal(MARKETPLACE_ACCESS_ROLES.includes(ROLES.internal), true);
    assert.equal(canManageCallers({ role: ROLES.internal }), false);
  });

  it('treats finance manager as internal staff with extra consumption access', () => {
    assert.equal(canAccessJobs({ role: ROLES.financeManager }), true);
    assert.equal(canAccessBidWorkspace({ role: ROLES.financeManager }), true);
    assert.equal(canAccessInbox({ role: ROLES.financeManager }), true);
    assert.equal(canAccessBidderDirectory({ role: ROLES.financeManager }), true);
    assert.equal(canAccessInterviews({ role: ROLES.financeManager }), true);
    assert.equal(canAccessAssessments({ role: ROLES.financeManager }), true);
    assert.equal(canAccessPersonalDashboard({ role: ROLES.financeManager }), true);
    assert.equal(MARKETPLACE_ACCESS_ROLES.includes(ROLES.financeManager), true);
    assert.equal(INTERNAL_DATA_ROLES.includes(ROLES.financeManager), true);
    assert.equal(canAccessConsumption({ role: ROLES.financeManager }), true);
    assert.equal(canAccessConsumption({ role: ROLES.internal }), false);
    assert.equal(canManageCallers({ role: ROLES.financeManager }), false);
  });

  it('allows only requested staff roles to register manual interview calls', () => {
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.superadmin }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.admin }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.user }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.financeManager }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.internal }), true);
    assert.equal(canRegisterManualInterviewCalls({ role: ROLES.caller }), false);
  });

  it('limits Profile Hub to internal, superadmin, and explicitly granted admins', () => {
    assert.equal(canAccessProfileHub({ role: ROLES.superadmin }), true);
    assert.equal(canAccessProfileHub({ role: ROLES.internal }), true);
    assert.equal(canAccessProfileHub({ role: ROLES.admin, profileHubAccess: true }), true);
    assert.equal(canAccessProfileHub({ role: ROLES.admin, profileHubAccess: false }), false);
    assert.equal(canAccessProfileHub({ role: ROLES.user, profileHubAccess: true }), false);
    assert.equal(canAccessProfileHub({ role: ROLES.financeManager, profileHubAccess: true }), false);
    assert.equal(canAccessProfileHub({ role: ROLES.caller, profileHubAccess: true }), false);
  });

  it('limits the Learning Hub to internal and admin roles', () => {
    assert.equal(canAccessLearningHub({ role: ROLES.superadmin }), true);
    assert.equal(canAccessLearningHub({ role: ROLES.admin }), true);
    assert.equal(canAccessLearningHub({ role: ROLES.internal }), true);
    assert.equal(canAccessLearningHub({ role: ROLES.user }), false);
    assert.equal(canAccessLearningHub({ role: ROLES.financeManager }), false);
    assert.equal(canAccessLearningHub({ role: ROLES.caller }), false);
  });
});
