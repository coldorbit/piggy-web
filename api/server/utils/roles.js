export const ROLES = {
  superadmin: 'superadmin',
  admin: 'admin',
  user: 'user',
  financeManager: 'finance_manager',
  internal: 'internal',
  guest: 'guest',
  caller: 'caller',
  bidder: 'bidder',
  readonlyBidder: 'readonly_bidder',
  editableBidder: 'editable_bidder',
};

export const VALID_USER_ROLES = [
  ROLES.superadmin,
  ROLES.admin,
  ROLES.user,
  ROLES.financeManager,
  ROLES.internal,
  ROLES.guest,
  ROLES.caller,
  ROLES.bidder,
  ROLES.readonlyBidder,
  ROLES.editableBidder,
];

export const ADMIN_ROLES = [ROLES.superadmin, ROLES.admin];
export const STAFF_WORKSPACE_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.internal];
export const ASSESSMENT_ACCESS_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.internal];
export const PRIVILEGED_USER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.internal];
export const PERSONAL_DASHBOARD_ROLES = [ROLES.user, ROLES.financeManager, ROLES.internal];
export const MARKETPLACE_ACCESS_ROLES = [...ADMIN_ROLES, ROLES.internal];
export const INTERVIEW_ACCESS_ROLES = [...STAFF_WORKSPACE_ROLES, ROLES.caller];
export const MANUAL_INTERVIEW_CALL_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.internal];
export const INTERNAL_DATA_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.internal];
export const BIDDER_ROLES = [ROLES.bidder, ROLES.readonlyBidder, ROLES.editableBidder];
export const CALLER_BLOCKED_ROLES = [...BIDDER_ROLES, ROLES.caller, ROLES.guest];
export const JOB_ACCESS_ROLES = VALID_USER_ROLES.filter((role) => ![ROLES.caller, ROLES.guest].includes(role));
export const BID_WORKSPACE_ACCESS_ROLES = [...STAFF_WORKSPACE_ROLES, ...BIDDER_ROLES];
export const BIDDER_DIRECTORY_ACCESS_ROLES = [...STAFF_WORKSPACE_ROLES, ...BIDDER_ROLES];
export const INBOX_ACCESS_ROLES = STAFF_WORKSPACE_ROLES;
export const CALLER_MANAGEMENT_ROLES = ADMIN_ROLES;
export const ADMIN_MANAGED_PROFILE_OWNER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.internal];
export const APPLIED_FILTER_BIDDER_PROFILE_VIEWER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.internal];
export const APPLIED_PROFILE_FILTER_ROLES = [...PRIVILEGED_USER_ROLES, ...BIDDER_ROLES];

export function isSuperadmin(userOrRole) {
  return roleOf(userOrRole) === ROLES.superadmin;
}

export function isAdminRole(userOrRole) {
  return ADMIN_ROLES.includes(roleOf(userOrRole));
}

export function canAccessConsumption(userOrRole) {
  return [ROLES.superadmin, ROLES.financeManager].includes(roleOf(userOrRole));
}

export function canAccessAssessments(userOrRole) {
  return ASSESSMENT_ACCESS_ROLES.includes(roleOf(userOrRole));
}

export function canAccessPersonalDashboard(userOrRole) {
  return PERSONAL_DASHBOARD_ROLES.includes(roleOf(userOrRole));
}

export function canAccessInterviews(userOrRole) {
  return INTERVIEW_ACCESS_ROLES.includes(roleOf(userOrRole));
}

export function canRegisterManualInterviewCalls(userOrRole) {
  return MANUAL_INTERVIEW_CALL_ROLES.includes(roleOf(userOrRole));
}

export function canAccessJobs(userOrRole) {
  return JOB_ACCESS_ROLES.includes(roleOf(userOrRole));
}

export function canAccessBidWorkspace(userOrRole) {
  return BID_WORKSPACE_ACCESS_ROLES.includes(roleOf(userOrRole));
}

export function canAccessBidderDirectory(userOrRole) {
  return BIDDER_DIRECTORY_ACCESS_ROLES.includes(roleOf(userOrRole));
}

export function canAccessInbox(userOrRole) {
  return INBOX_ACCESS_ROLES.includes(roleOf(userOrRole));
}

export function canManageCallers(userOrRole) {
  return CALLER_MANAGEMENT_ROLES.includes(roleOf(userOrRole));
}

export function isGuestRole(userOrRole) {
  return roleOf(userOrRole) === ROLES.guest;
}

export function canAssignAdminRole(userOrRole) {
  return isSuperadmin(userOrRole);
}

export function roleOf(userOrRole) {
  return typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
}
