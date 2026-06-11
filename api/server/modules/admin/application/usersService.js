import { clean } from '../../../utils/index.js';
import { InputError } from '../../../utils/errors.js';
import { VALID_USER_ROLES } from '../../../utils/roles.js';

export function userAttributesFromBody(body, { requirePassword }) {
  const email = clean(body?.email).toLowerCase();
  const username = clean(body?.username).toLowerCase();
  const password = String(body?.password || '');
  const role = clean(body?.role || 'user');

  if (!username) throw new InputError('Username is required');
  if (!email) throw new InputError('Email is required');
  if (!email.includes('@')) throw new InputError('Use a valid email address');
  if (username.includes('@')) throw new InputError('Username must not be an email address');
  if (!VALID_USER_ROLES.includes(role)) {
    throw new InputError('Role must be superadmin, admin, user, internal, caller, readonly_bidder, or editable_bidder');
  }
  if (requirePassword && password.length < 8) throw new InputError('Password must be at least 8 characters');
  if (!requirePassword && password && password.length < 8) {
    throw new InputError('Password must be at least 8 characters');
  }

  return { email, username, password, role };
}
