import { clean } from '../../../utils/index.js';
import { InputError } from '../../../utils/errors.js';
import { BIDDER_ROLES, ROLES, VALID_USER_ROLES } from '../../../utils/roles.js';
import { BUSINESS_TIME_ZONE, isValidTimeZone } from '../../../utils/businessTime.js';

const DAILY_BID_GOAL_DEFAULTS = {
  [ROLES.user]: 100,
  [ROLES.bidder]: 50,
  [ROLES.readonlyBidder]: 50,
  [ROLES.editableBidder]: 50,
};

export function userAttributesFromBody(body, { requirePassword }) {
  const email = clean(body?.email).toLowerCase();
  const username = clean(body?.username).toLowerCase();
  const password = String(body?.password || '');
  const role = clean(body?.role || 'user');
  const dailyBidGoal = dailyBidGoalFromBody(body, role);
  const timezone = timezoneFromBody(body);

  if (!username) throw new InputError('Username is required');
  if (!email) throw new InputError('Email is required');
  if (!email.includes('@')) throw new InputError('Use a valid email address');
  if (username.includes('@')) throw new InputError('Username must not be an email address');
  if (!VALID_USER_ROLES.includes(role)) {
    throw new InputError('Role must be superadmin, admin, user, finance_manager, internal, caller, readonly_bidder, or editable_bidder');
  }
  if (requirePassword && password.length < 8) throw new InputError('Password must be at least 8 characters');
  if (!requirePassword && password && password.length < 8) {
    throw new InputError('Password must be at least 8 characters');
  }

  return { email, username, password, role, dailyBidGoal, timezone };
}

export function defaultDailyBidGoalForRole(role) {
  return DAILY_BID_GOAL_DEFAULTS[role] ?? null;
}

export function canHaveDailyBidGoal(role) {
  return role === ROLES.user || BIDDER_ROLES.includes(role);
}

function dailyBidGoalFromBody(body, role) {
  if (!canHaveDailyBidGoal(role)) return null;
  const value = body?.dailyBidGoal ?? body?.daily_bid_goal;
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultDailyBidGoalForRole(role);
  }

  const goal = Number(value);
  if (!Number.isInteger(goal) || goal < 1 || goal > 1000) {
    throw new InputError('Daily bid goal must be a whole number from 1 to 1000');
  }
  return goal;
}

function timezoneFromBody(body) {
  const timezone = clean(body?.timezone) || BUSINESS_TIME_ZONE;
  if (!isValidTimeZone(timezone)) {
    throw new InputError('Use a valid timezone like America/New_York');
  }
  return timezone;
}
