import {
  authenticateUser,
  clearActiveSession,
  createLoginSession,
  readValidSession,
} from '../../../../auth.js';

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
