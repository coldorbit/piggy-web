import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { registerHealthRoutes } from '../server/modules/health/presentation/healthRoutes.js';

describe('API health route', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    registerHealthRoutes(app);
    server = await listen(app);
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await close(server);
  });

  it('reports healthy without authentication and disables caching', async () => {
    const response = await request(`${baseUrl}/api/health`);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body, {
      ok: true,
      status: 'healthy',
      service: 'applypilot-api',
    });
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

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        });
      });
    });
    req.once('error', reject);
  });
}
