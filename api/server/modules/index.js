import { registerAdminRoutes } from './admin/presentation/adminRoutes.js';
import { registerAuthRoutes } from './auth/presentation/authRoutes.js';
import { registerBidRoutes } from './bidding/presentation/biddingRoutes.js';
import { startTailoringQueueWorker } from './bidding/application/tailoringQueueService.js';
import { registerFaqRoutes } from './faqs/presentation/faqsRoutes.js';
import { registerJobRoutes } from './jobs/presentation/jobsRoutes.js';
import { registerMarketplaceRoutes } from './marketplace/presentation/marketplaceRoutes.js';

export function registerApiRoutes(app) {
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerJobRoutes(app);
  registerBidRoutes(app);
  registerMarketplaceRoutes(app);
  registerFaqRoutes(app);
}

export function startModuleWorkers() {
  startTailoringQueueWorker();
}
