import { requireAuth } from '../../../middleware/authMiddleware.js';
import { checkLoginRateLimit } from '../../../middleware/loginRateLimit.js';
import { login, logout, me, updateMe } from './authController.js';

export function registerAuthRoutes(app) {
  app.post('/api/login', checkLoginRateLimit, login);
  app.post('/api/logout', logout);
  app.get('/api/me', me);
  app.patch('/api/me', requireAuth, updateMe);
}
