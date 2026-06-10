import { requireMarketplaceAccess } from '../../../middleware/authMiddleware.js';
import {
  createCallerProfile,
  createInterviewOpportunity,
  createMarketplaceMatch,
  getMarketplaceDashboard,
  reviewCallerProfile,
  reviewInterviewOpportunity,
  reviewMarketplaceParticipant,
  updateMarketplaceMatch,
  upsertMarketplaceParticipant,
} from './marketplaceController.js';

export function registerMarketplaceRoutes(app) {
  app.get('/api/marketplace', requireMarketplaceAccess, getMarketplaceDashboard);
  app.post('/api/marketplace/participant', requireMarketplaceAccess, upsertMarketplaceParticipant);
  app.patch('/api/marketplace/participants/:id/review', requireMarketplaceAccess, reviewMarketplaceParticipant);
  app.post('/api/marketplace/interviews', requireMarketplaceAccess, createInterviewOpportunity);
  app.patch('/api/marketplace/interviews/:id/review', requireMarketplaceAccess, reviewInterviewOpportunity);
  app.post('/api/marketplace/callers', requireMarketplaceAccess, createCallerProfile);
  app.patch('/api/marketplace/callers/:id/review', requireMarketplaceAccess, reviewCallerProfile);
  app.post('/api/marketplace/matches', requireMarketplaceAccess, createMarketplaceMatch);
  app.patch('/api/marketplace/matches/:id', requireMarketplaceAccess, updateMarketplaceMatch);
}
