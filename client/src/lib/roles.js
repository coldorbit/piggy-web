export const ROLES = {
  superadmin: 'superadmin',
  admin: 'admin',
  user: 'user',
  financeManager: 'finance_manager',
  internal: 'internal',
  caller: 'caller',
  bidder: 'bidder',
  readonlyBidder: 'readonly_bidder',
  editableBidder: 'editable_bidder',
};

export const ADMIN_ROLES = [ROLES.superadmin, ROLES.admin];
export const PRIVILEGED_USER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager];
export const PERSONAL_DASHBOARD_ROLES = [ROLES.user, ROLES.financeManager];
export const MARKETPLACE_ACCESS_ROLES = ADMIN_ROLES;
export const INTERVIEW_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.internal, ROLES.user, ROLES.financeManager, ROLES.caller];
export const BIDDER_ROLES = [ROLES.bidder, ROLES.readonlyBidder, ROLES.editableBidder];
export const CALLER_BLOCKED_ROLES = [...BIDDER_ROLES, ROLES.caller];

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

export function canAccessPersonalDashboard(userOrRole) {
  return PERSONAL_DASHBOARD_ROLES.includes(roleOf(userOrRole));
}

export function roleOptionsFor(currentUser) {
  return isSuperadmin(currentUser) ? ADMIN_ROLE_OPTIONS : BASE_ROLE_OPTIONS;
}

export function roleLabel(role) {
  if (role === ROLES.superadmin) return 'superadmin';
  if (role === ROLES.financeManager) return 'finance manager';
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
