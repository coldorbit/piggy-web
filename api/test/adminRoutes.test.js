import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requireAdmin } from '../server/middleware/authMiddleware.js';
import { registerAdminRoutes } from '../server/modules/admin/presentation/adminRoutes.js';

describe('admin routes', () => {
  it('protects the lightweight workspace selector endpoint with admin access', () => {
    const routes = captureRoutes(registerAdminRoutes);
    assert.equal(routes.get.get('/api/admin/workspace-options')[0], requireAdmin);
  });
});

function captureRoutes(register) {
  const routes = { get: new Map(), post: new Map(), patch: new Map(), delete: new Map() };
  const app = Object.fromEntries(Object.keys(routes).map((method) => [method, (path, ...handlers) => routes[method].set(path, handlers)]));
  register(app);
  return routes;
}
