import express from 'express';
import http from 'node:http';
import { ensureWebModels } from './db.js';
import { ENV } from './env.js';
import { registerAdminRoutes } from './server/routes/admin.js';
import { registerAuthRoutes } from './server/routes/auth.js';
import { registerBidRoutes } from './server/routes/bids.js';
import { registerJobRoutes } from './server/routes/jobs.js';
import { startTailoringQueueWorker } from './server/services/tailoringQueue.js';

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
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

app.use(express.json({ limit: '5mb' }));

registerAuthRoutes(app);
registerAdminRoutes(app);
registerJobRoutes(app);
registerBidRoutes(app);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Unexpected server error' });
});

await ensureWebModels();
startTailoringQueueWorker();

const port = ENV.WEB_PORT;
server.listen(port, '0.0.0.0', () => {
  console.log(`ApplyPilot API listening on http://0.0.0.0:${port}`);
});

function isAllowedOrigin(origin) {
  const allowedOrigins = String(process.env.CORS_ORIGINS || ENV.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}
