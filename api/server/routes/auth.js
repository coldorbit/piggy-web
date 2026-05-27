import { login, logout, me } from '../controllers/auth.js';

export function registerAuthRoutes(app) {
  app.post('/api/login', login);
  app.post('/api/logout', logout);
  app.get('/api/me', me);
}
