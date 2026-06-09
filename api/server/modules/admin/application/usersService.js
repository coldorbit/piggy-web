import { clean } from '../../../utils/index.js';
import { InputError } from '../../../utils/errors.js';
import { VALID_USER_ROLES } from '../../../utils/roles.js';

export function userAttributesFromBody(body, { requirePassword }) {
  const username = clean(body?.username).toLowerCase();
  const password = String(body?.password || '');
  const role = clean(body?.role || 'user');

  if (!username) throw new InputError('Username is required');
  if (!username.includes('@')) throw new InputError('Use an email address as the username');
  if (!VALID_USER_ROLES.includes(role)) {
    throw new InputError('Role must be superadmin, admin, user, internal, caller, readonly_bidder, or editable_bidder');
  }
  if (requirePassword && password.length < 8) throw new InputError('Password must be at least 8 characters');
  if (!requirePassword && password && password.length < 8) {
    throw new InputError('Password must be at least 8 characters');
  }

  return { username, password, role };
}
