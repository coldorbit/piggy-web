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
export const MARKETPLACE_ACCESS_ROLES = [...ADMIN_ROLES, ROLES.financeManager, ROLES.internal];
export const INTERVIEW_ROLES = [...STAFF_WORKSPACE_ROLES, ROLES.caller];
export const MANUAL_INTERVIEW_CALL_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.internal];
export const BIDDER_ROLES = [ROLES.bidder, ROLES.readonlyBidder, ROLES.editableBidder];
export const CALLER_BLOCKED_ROLES = [...BIDDER_ROLES, ROLES.caller, ROLES.guest];
export const JOB_ACCESS_ROLES = VALID_USER_ROLES.filter((role) => ![ROLES.caller, ROLES.guest].includes(role));
export const BID_WORKSPACE_ACCESS_ROLES = [...STAFF_WORKSPACE_ROLES, ...BIDDER_ROLES];
export const BIDDER_DIRECTORY_ACCESS_ROLES = [...STAFF_WORKSPACE_ROLES, ...BIDDER_ROLES];
export const INBOX_ACCESS_ROLES = STAFF_WORKSPACE_ROLES;
export const CALLER_MANAGEMENT_ROLES = ADMIN_ROLES;
export const ADMIN_MANAGED_PROFILE_OWNER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.internal];
export const APPLIED_PROFILE_FILTER_ROLES = [...PRIVILEGED_USER_ROLES, ...BIDDER_ROLES];

export const DAILY_BID_GOAL_DEFAULTS = {
  [ROLES.user]: 100,
  [ROLES.bidder]: 50,
  [ROLES.readonlyBidder]: 50,
  [ROLES.editableBidder]: 50,
};

export const BASE_ROLE_OPTIONS = [
  { value: ROLES.user, label: 'User' },
  { value: ROLES.financeManager, label: 'Finance manager' },
  { value: ROLES.internal, label: 'Internal' },
  { value: ROLES.guest, label: 'Guest' },
  { value: ROLES.caller, label: 'Caller' },
  { value: ROLES.readonlyBidder, label: 'Readonly bidder' },
  { value: ROLES.editableBidder, label: 'Editable bidder' },
];

export const ADMIN_ROLE_OPTIONS = [
  ...BASE_ROLE_OPTIONS,
  { value: ROLES.admin, label: 'Admin' },
  { value: ROLES.superadmin, label: 'Superadmin' },
];

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
  return INTERVIEW_ROLES.includes(roleOf(userOrRole));
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

export function roleOptionsFor(currentUser) {
  return isSuperadmin(currentUser) ? ADMIN_ROLE_OPTIONS : BASE_ROLE_OPTIONS;
}

export function roleLabel(role) {
  if (role === ROLES.superadmin) return 'superadmin';
  if (role === ROLES.financeManager) return 'finance manager';
  if (role === ROLES.guest) return 'guest';
  if (role === ROLES.readonlyBidder || role === ROLES.bidder) return 'readonly bidder';
  if (role === ROLES.editableBidder) return 'editable bidder';
  if (role === ROLES.internal) return 'internal';
  if (role === ROLES.caller) return 'caller';
  return role;
}

export function canHaveDailyBidGoal(role) {
  return role === ROLES.user || BIDDER_ROLES.includes(role);
}

export function defaultDailyBidGoalForRole(role) {
  return DAILY_BID_GOAL_DEFAULTS[role] ?? '';
}

function roleOf(userOrRole) {
  return typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
}
