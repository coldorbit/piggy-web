import { requireAuth } from '../../../middleware/authMiddleware.js';
import { getMarketplaceDashboard } from './marketplaceController.js';

export function registerMarketplaceRoutes(app) {
  app.get('/api/marketplace', requireAuth, getMarketplaceDashboard);
}
