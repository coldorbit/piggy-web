import { getHealth } from './healthController.js';

export function registerHealthRoutes(app) {
  app.get('/api/health', getHealth);
}
