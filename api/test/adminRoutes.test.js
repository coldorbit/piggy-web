import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requireAdmin, requireConsumptionAccess, requireSuperadmin } from '../server/middleware/authMiddleware.js';
import { registerAdminRoutes } from '../server/modules/admin/presentation/adminRoutes.js';

describe('admin routes', () => {
  it('protects the lightweight workspace selector endpoint with admin access', () => {
    const routes = captureRoutes(registerAdminRoutes);
    assert.equal(routes.get.get('/api/admin/workspace-options')[0], requireAdmin);
  });

  it('reserves workspace inbox settings for superadmins', () => {
    const routes = captureRoutes(registerAdminRoutes);
    assert.equal(routes.get.get('/api/admin/workspaces/:id/inbox-settings')[0], requireSuperadmin);
    assert.equal(routes.patch.get('/api/admin/workspaces/:id/inbox-settings')[0], requireSuperadmin);
  });

  it('protects consumption workbook exports with consumption access', () => {
    const routes = captureRoutes(registerAdminRoutes);
    assert.equal(routes.get.get('/api/admin/consumption/export')[0], requireConsumptionAccess);
  });
});

function captureRoutes(register) {
  const routes = { get: new Map(), post: new Map(), patch: new Map(), delete: new Map() };
  const app = Object.fromEntries(Object.keys(routes).map((method) => [method, (path, ...handlers) => routes[method].set(path, handlers)]));
  register(app);
  return routes;
}
