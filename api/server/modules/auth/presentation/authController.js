import {
  authenticateUser,
  clearActiveSession,
  createLoginSession,
  publicUser,
  readValidSession,
} from '../../../../auth.js';
import { repositories } from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { handleUserWriteError } from '../../../utils/errors.js';

export async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    const user = await authenticateUser(String(username || ''), String(password || ''));
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = await createLoginSession(user);
    res.json({ user, token });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    await clearActiveSession(req);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await readValidSession(req);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function updateMe(req, res, next) {
  try {
    const user = await repositories.findUserById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const username = clean(req.body?.username).toLowerCase();
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    if (username.includes('@')) {
      res.status(400).json({ error: 'Username must not be an email address' });
      return;
    }

    await user.update({ username });
    const nextUser = publicUser(user);
    const token = await createLoginSession(nextUser);
    res.json({ user: nextUser, token });
  } catch (error) {
    handleUserWriteError(error, res, next);
  }
}
