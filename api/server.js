import express from 'express';
import http from 'node:http';
import { ensureWebModels } from './db.js';
import { ENV } from './env.js';
import { requestLogger } from './server/middleware/requestLogger.js';
import { securityHeaders } from './server/middleware/securityHeaders.js';
import { startForwardingMailboxApplicationSync } from './server/modules/bidding/application/forwardingMailboxService.js';
import { registerApiRoutes } from './server/modules/index.js';

const app = express();
const server = http.createServer(app);
const allowedOrigins = configuredAllowedOrigins();

app.disable('x-powered-by');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin, allowedOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'content-disposition, content-length, content-type');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use((req, res, next) => {
  if (!isStateChangingMethod(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if ((origin && !isAllowedOrigin(origin, allowedOrigins)) || fetchSite === 'cross-site') {
    res.status(403).json({ error: 'Cross-site request blocked' });
    return;
  }

  next();
});

app.use(securityHeaders);
app.use(requestLogger);
app.use(express.json({ limit: '5mb' }));

registerApiRoutes(app);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: ENV.NODE_ENV === 'production' ? 'Unexpected server error' : error.message || 'Unexpected server error' });
});

await ensureWebModels();
const mailboxApplicationSync = startForwardingMailboxApplicationSync();

const port = ENV.WEB_PORT;
server.listen(port, '0.0.0.0', () => {
  console.log(`ApplyPilot API listening on http://0.0.0.0:${port}`);
  if (mailboxApplicationSync.started) {
    console.log(
      'Forwarding mailbox application sync enabled:',
      `intervalMs=${mailboxApplicationSync.config.intervalMs}`,
      `messageLimit=${mailboxApplicationSync.config.messageLimit}`,
    );
  } else if (mailboxApplicationSync.config.reason !== 'not_configured') {
    console.log(`Forwarding mailbox application sync not started: ${mailboxApplicationSync.config.reason}`);
  }
});

function configuredAllowedOrigins() {
  const origins = String(process.env.CORS_ORIGINS || ENV.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (ENV.NODE_ENV === 'production' && origins.includes('*')) {
    throw new Error('CORS_ORIGINS must not include "*" in production');
  }

  return origins;
}

function isAllowedOrigin(origin, origins) {
  return origins.includes('*') || origins.includes(origin);
}

function isStateChangingMethod(method) {
  return ['POST', 'PATCH', 'PUT', 'DELETE'].includes(String(method || '').toUpperCase());
}
