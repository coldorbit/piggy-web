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
export const ASSESSMENT_ACCESS_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager];
export const PRIVILEGED_USER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager];
export const PERSONAL_DASHBOARD_ROLES = [ROLES.user, ROLES.financeManager];
export const MARKETPLACE_ACCESS_ROLES = ADMIN_ROLES;
export const INTERVIEW_ACCESS_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.internal, ROLES.user, ROLES.financeManager, ROLES.caller];
export const INTERNAL_DATA_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.internal];
export const BIDDER_ROLES = [ROLES.bidder, ROLES.readonlyBidder, ROLES.editableBidder];
export const CALLER_BLOCKED_ROLES = [...BIDDER_ROLES, ROLES.caller, ROLES.guest];
export const JOB_ACCESS_ROLES = VALID_USER_ROLES.filter((role) => ![ROLES.caller, ROLES.guest].includes(role));
export const BID_WORKSPACE_ACCESS_ROLES = VALID_USER_ROLES.filter((role) => role !== ROLES.guest);
export const ADMIN_MANAGED_PROFILE_OWNER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager];
export const APPLIED_FILTER_BIDDER_PROFILE_VIEWER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user];

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

export function canAccessJobs(userOrRole) {
  return JOB_ACCESS_ROLES.includes(roleOf(userOrRole));
}

export function canAccessBidWorkspace(userOrRole) {
  return BID_WORKSPACE_ACCESS_ROLES.includes(roleOf(userOrRole));
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
