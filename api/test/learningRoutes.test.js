import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requireLearningHubAccess, requireSuperadmin } from '../server/middleware/authMiddleware.js';
import { registerLearningRoutes } from '../server/modules/learning/presentation/learningRoutes.js';

describe('learning company routes', () => {
  it('allows Learning Hub readers to list companies but reserves company writes for superadmins', () => {
    const routes = captureRoutes(registerLearningRoutes);
    assert.equal(routes.get.get('/api/learning/companies')[0], requireLearningHubAccess);
    assert.equal(routes.post.get('/api/learning/companies')[0], requireSuperadmin);
    assert.equal(routes.patch.get('/api/learning/companies/:id')[0], requireSuperadmin);
  });
});

function captureRoutes(register) {
  const routes = { get: new Map(), post: new Map(), patch: new Map(), delete: new Map() };
  const app = Object.fromEntries(Object.keys(routes).map((method) => [method, (path, ...handlers) => routes[method].set(path, handlers)]));
  register(app);
  return routes;
}
