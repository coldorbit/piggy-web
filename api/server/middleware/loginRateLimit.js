const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const attempts = new Map();

export function checkLoginRateLimit(req, res, next) {
  const key = loginAttemptKey(req);
  const now = Date.now();
  const record = attempts.get(key);

  if (record?.blockedUntil && record.blockedUntil > now) {
    res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    return;
  }

  req.loginRateLimitKey = key;
  next();
}

export function recordLoginFailure(req) {
  const key = req.loginRateLimitKey || loginAttemptKey(req);
  const now = Date.now();
  const current = attempts.get(key);
  const count = current && current.resetAt > now ? current.count + 1 : 1;
  attempts.set(key, {
    count,
    resetAt: now + WINDOW_MS,
    blockedUntil: count >= MAX_FAILURES ? now + BLOCK_MS : 0,
  });
}

export function clearLoginFailures(req) {
  attempts.delete(req.loginRateLimitKey || loginAttemptKey(req));
}

function loginAttemptKey(req) {
  const username = String(req.body?.username || '').trim().toLowerCase();
  return `${clientIp(req)}:${username || 'unknown'}`;
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '')
    .split(',')[0]
    .trim();
}
