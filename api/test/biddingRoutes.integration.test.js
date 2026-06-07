import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { registerBidRoutes } from '../server/modules/bidding/presentation/biddingRoutes.js';

describe('bidding API routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json());
    registerBidRoutes(app);
    app.use((error, _req, res, _next) => {
      res.status(500).json({ error: error.message || 'Unexpected server error' });
    });

    server = await listen(app);
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await close(server);
  });

  it('rejects unauthenticated bid job requests before controller work', async () => {
    const response = await request(`${baseUrl}/api/bid/jobs?bidTab=todo`);

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: 'Authentication required' });
  });

  it('rejects malformed bearer tokens on protected bid routes', async () => {
    const response = await request(`${baseUrl}/api/bid/profiles`, {
      headers: { authorization: 'Bearer not-a-valid-token' },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: 'Authentication required' });
  });
});

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET', ...options }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data ? JSON.parse(data) : null,
        });
      });
    });
    req.once('error', reject);
    req.end();
  });
}
