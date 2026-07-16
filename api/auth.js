import crypto from 'node:crypto';
import { ensureDefaultWorkspace, ensureWebModels, getWebUserModel, repositories } from './db.js';
import { ENV } from './env.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const ACTIVITY_TOUCH_INTERVAL_MS = 60 * 1000;
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = 'sha256';
export const SESSION_COOKIE_NAME = 'applypilot_session';

let defaultUsersSeeded = false;
const scheduleUserActivityTouch = createUserActivityTracker();

export function getConfiguredUsers() {
  const rawUsers =
    ENV.WEB_USERS ||
    (ENV.WEB_USERNAME && ENV.WEB_PASSWORD
      ? `${ENV.WEB_USERNAME}:${ENV.WEB_PASSWORD}`
      : '');

  return String(rawUsers)
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseConfiguredUser)
    .filter((user) => user?.username && user.password);
}

export async function authenticateUser(username, password) {
  await ensureDefaultUsers();
  const user = await repositories.findUserByLogin(username);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return publicUser(user);
}

export async function createLoginSession(user) {
  await ensureWebModels();
  const activeSessionId = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await getWebUserModel().update(
    { activeSessionId, lastLoginAt: now, lastSeenAt: now },
    { where: { id: user.id } },
  );
  return createSessionToken({ ...user, activeSessionId, lastLoginAt: now, lastSeenAt: now });
}

export async function ensureDefaultUsers() {
  if (defaultUsersSeeded) return;
  await ensureWebModels();
  const WebUser = getWebUserModel();
  const existingUserCount = await WebUser.count();

  if (existingUserCount > 0) {
    defaultUsersSeeded = true;
    return;
  }

  const configuredUsers = getConfiguredUsers();
  if (!configuredUsers.length) {
    console.warn('No admin seed user configured. Set WEB_USERNAME and WEB_PASSWORD or WEB_USERS.');
    defaultUsersSeeded = true;
    return;
  }

  const workspace = await ensureDefaultWorkspace();
  for (const user of configuredUsers) {
    await WebUser.create({
      username: user.username,
      email: user.username.includes('@') ? user.username.toLowerCase() : null,
      passwordHash: hashPassword(user.password),
      role: user.role || 'admin',
      workspaceId: workspace.id,
    });
  }

  defaultUsersSeeded = true;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto
    .pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString('base64url');
  return `pbkdf2:${PASSWORD_DIGEST}:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false;
  const [, digest, iterations, salt, expectedHash] = parts;
  const actualHash = crypto
    .pbkdf2Sync(String(password), salt, Number(iterations), PASSWORD_KEY_LENGTH, digest)
    .toString('base64url');
  return constantEqual(actualHash, expectedHash);
}

export function createSessionToken(user) {
  const payload = {
    sub: user.username,
    role: user.role,
    sid: user.activeSessionId,
    exp: Math.floor((Date.now() + SESSION_TTL_MS) / 1000),
  };
  return signJwt(payload);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: 'strict',
    secure: ENV.NODE_ENV === 'production',
  };
}

export function expiredSessionCookieOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: 0,
  };
}

export function readSession(req) {
  const token = bearerToken(req) || cookieToken(req);
  if (!token) return null;

  const payload = verifyJwt(token);
  if (!payload || Number(payload.exp || 0) * 1000 < Date.now()) return null;
  return { username: payload.sub, role: payload.role || 'user', activeSessionId: payload.sid || '' };
}

export async function readValidSession(req) {
  const session = readSession(req);
  if (!session?.activeSessionId) return null;

  await ensureDefaultUsers();
  const user = await repositories.findUserByUsername(session.username);
  if (!user || user.activeSessionId !== session.activeSessionId) return null;

  req.authUserRow = user;
  scheduleUserActivityTouch(user);
  return publicUser(user);
}

export async function clearActiveSession(req) {
  const session = readSession(req);
  if (!session?.activeSessionId) return;

  await ensureWebModels();
  await getWebUserModel().update(
    { activeSessionId: null },
    { where: { username: session.username, activeSessionId: session.activeSessionId } },
  );
}

export function publicUser(row) {
  const lastSeenAt = row.lastSeenAt || null;
  const workspaceMembershipRows = row.workspaceMemberships || row.get?.('workspaceMemberships') || [];
  return {
    id: row.id,
    username: row.username,
    email: row.email || null,
    role: row.role,
    workspaceId: row.workspaceId || null,
    workspace: row.workspace ? {
      id: row.workspace.id,
      name: row.workspace.name,
      slug: row.workspace.slug,
    } : null,
    workspaceMemberships: workspaceMembershipRows.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      workspaceId: membership.workspaceId,
      accessRole: membership.accessRole,
      status: membership.status,
      workspace: membership.workspace ? {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
      } : null,
    })),
    dailyBidGoal: row.dailyBidGoal ?? null,
    timezone: row.timezone || 'America/New_York',
    profileHubAccess: Boolean(row.profileHubAccess),
    profileCount: Number(row.get?.('profileCount') ?? row.profileCount ?? 0),
    lastLoginAt: row.lastLoginAt || null,
    lastSeenAt,
    isActive: Boolean(row.activeSessionId && lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() <= ACTIVE_WINDOW_MS),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createUserActivityTracker({
  intervalMs = ACTIVITY_TOUCH_INTERVAL_MS,
  now = () => Date.now(),
  update = updateUserActivity,
} = {}) {
  const scheduledAtByUserId = new Map();

  return function trackUserActivity(user) {
    const userId = String(user?.id || '');
    if (!userId) return false;

    const currentTime = now();
    const persistedAt = new Date(user.lastSeenAt || 0).getTime();
    const lastActivityAt = Math.max(
      Number.isFinite(persistedAt) ? persistedAt : 0,
      scheduledAtByUserId.get(userId) || 0,
    );
    if (currentTime - lastActivityAt < intervalMs) return false;

    const lastSeenAt = new Date(currentTime);
    scheduledAtByUserId.set(userId, currentTime);
    user.lastSeenAt = lastSeenAt;
    Promise.resolve().then(() => update(user.id, lastSeenAt)).catch((error) => {
      if (scheduledAtByUserId.get(userId) === currentTime) scheduledAtByUserId.delete(userId);
      console.warn(`Unable to update activity for user ${userId}:`, error?.message || error);
    });
    pruneActivityTracker(scheduledAtByUserId, currentTime, intervalMs);
    return true;
  };
}

function updateUserActivity(userId, lastSeenAt) {
  return getWebUserModel().update({ lastSeenAt }, { where: { id: userId }, silent: true });
}

function pruneActivityTracker(scheduledAtByUserId, currentTime, intervalMs) {
  if (scheduledAtByUserId.size < 1000) return;
  for (const [userId, scheduledAt] of scheduledAtByUserId) {
    if (currentTime - scheduledAt >= intervalMs * 2) scheduledAtByUserId.delete(userId);
  }
}

function parseConfiguredUser(entry) {
  const parts = entry.split(':');
  if (parts.length < 2) return null;
  return {
    username: parts[0].trim(),
    password: parts[1],
    role: parts[2] || 'admin',
  };
}

function signJwt(payload) {
  const encodedHeader = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = hmac(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token) {
  const [encodedHeader, encodedPayload, signature] = String(token).split('.');
  if (!encodedHeader || !encodedPayload || !signature) return null;
  if (!constantEqual(hmac(`${encodedHeader}.${encodedPayload}`), signature)) return null;

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function hmac(value) {
  return crypto.createHmac('sha256', ENV.WEB_SESSION_SECRET).update(value).digest('base64url');
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function bearerToken(req) {
  const [scheme, token] = String(req.headers.authorization || '').split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' && token ? token : '';
}

function cookieToken(req) {
  const cookieHeader = String(req.headers.cookie || '');
  if (!cookieHeader) return '';
  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName !== SESSION_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(rawValue.join('=') || '');
    } catch {
      return rawValue.join('=') || '';
    }
  }
  return '';
}

function constantEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
