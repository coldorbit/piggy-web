import { requireAuth } from '../../../middleware/authMiddleware.js';
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
  app.get('/api/marketplace', requireAuth, getMarketplaceDashboard);
  app.post('/api/marketplace/participant', requireAuth, upsertMarketplaceParticipant);
  app.patch('/api/marketplace/participants/:id/review', requireAuth, reviewMarketplaceParticipant);
  app.post('/api/marketplace/interviews', requireAuth, createInterviewOpportunity);
  app.patch('/api/marketplace/interviews/:id/review', requireAuth, reviewInterviewOpportunity);
  app.post('/api/marketplace/callers', requireAuth, createCallerProfile);
  app.patch('/api/marketplace/callers/:id/review', requireAuth, reviewCallerProfile);
  app.post('/api/marketplace/matches', requireAuth, createMarketplaceMatch);
  app.patch('/api/marketplace/matches/:id', requireAuth, updateMarketplaceMatch);
}
