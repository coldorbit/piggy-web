export const ROLES = {
  superadmin: 'superadmin',
  admin: 'admin',
  user: 'user',
  internal: 'internal',
  caller: 'caller',
  bidder: 'bidder',
  readonlyBidder: 'readonly_bidder',
  editableBidder: 'editable_bidder',
};

export const ADMIN_ROLES = [ROLES.superadmin, ROLES.admin];
export const PRIVILEGED_USER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user];
export const MARKETPLACE_ACCESS_ROLES = PRIVILEGED_USER_ROLES;
export const INTERVIEW_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.internal, ROLES.user, ROLES.caller];
export const BIDDER_ROLES = [ROLES.bidder, ROLES.readonlyBidder, ROLES.editableBidder];
export const CALLER_BLOCKED_ROLES = [...BIDDER_ROLES, ROLES.caller];

export const BASE_ROLE_OPTIONS = [
  { value: ROLES.user, label: 'User' },
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

export function roleOptionsFor(currentUser) {
  return isSuperadmin(currentUser) ? ADMIN_ROLE_OPTIONS : BASE_ROLE_OPTIONS;
}

export function roleLabel(role) {
  if (role === ROLES.superadmin) return 'superadmin';
  if (role === ROLES.readonlyBidder || role === ROLES.bidder) return 'readonly bidder';
  if (role === ROLES.editableBidder) return 'editable bidder';
  if (role === ROLES.internal) return 'internal';
  if (role === ROLES.caller) return 'caller';
  return role;
}

function roleOf(userOrRole) {
  return typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
}
