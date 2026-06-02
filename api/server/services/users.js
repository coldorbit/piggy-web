import { clean } from '../utils/index.js';
import { InputError } from '../utils/errors.js';

export function userAttributesFromBody(body, { requirePassword }) {
  const username = clean(body?.username).toLowerCase();
  const password = String(body?.password || '');
  const role = clean(body?.role || 'user');

  if (!username) throw new InputError('Username is required');
  if (!username.includes('@')) throw new InputError('Use an email address as the username');
  if (!['admin', 'user', 'bidder', 'readonly_bidder', 'editable_bidder', 'caller'].includes(role)) {
    throw new InputError('Role must be admin, user, caller, readonly_bidder, or editable_bidder');
  }
  if (requirePassword && password.length < 8) throw new InputError('Password must be at least 8 characters');
  if (!requirePassword && password && password.length < 8) {
    throw new InputError('Password must be at least 8 characters');
  }

  return { username, password, role };
}
