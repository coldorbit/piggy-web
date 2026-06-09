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

export const VALID_USER_ROLES = [
  ROLES.superadmin,
  ROLES.admin,
  ROLES.user,
  ROLES.internal,
  ROLES.caller,
  ROLES.bidder,
  ROLES.readonlyBidder,
  ROLES.editableBidder,
];

export const ADMIN_ROLES = [ROLES.superadmin, ROLES.admin];
export const PRIVILEGED_USER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user];
export const INTERVIEW_ACCESS_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.internal, ROLES.user, ROLES.caller];
export const INTERNAL_DATA_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.internal];
export const BIDDER_ROLES = [ROLES.bidder, ROLES.readonlyBidder, ROLES.editableBidder];
export const CALLER_BLOCKED_ROLES = [...BIDDER_ROLES, ROLES.caller];
export const ADMIN_MANAGED_PROFILE_OWNER_ROLES = [ROLES.superadmin, ROLES.admin, ROLES.user];

export function isSuperadmin(userOrRole) {
  return roleOf(userOrRole) === ROLES.superadmin;
}

export function isAdminRole(userOrRole) {
  return ADMIN_ROLES.includes(roleOf(userOrRole));
}

export function canAssignAdminRole(userOrRole) {
  return isSuperadmin(userOrRole);
}

export function roleOf(userOrRole) {
  return typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
}
