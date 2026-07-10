import { registerAdminRoutes } from './admin/presentation/adminRoutes.js';
import { registerAssessmentRoutes } from './assessments/presentation/assessmentsRoutes.js';
import { registerAuthRoutes } from './auth/presentation/authRoutes.js';
import { registerBidRoutes } from './bidding/presentation/biddingRoutes.js';
import { registerFaqRoutes } from './faqs/presentation/faqsRoutes.js';
import { registerJobRoutes } from './jobs/presentation/jobsRoutes.js';
import { registerLearningRoutes } from './learning/presentation/learningRoutes.js';
import { registerMarketplaceRoutes } from './marketplace/presentation/marketplaceRoutes.js';

export function registerApiRoutes(app) {
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerAssessmentRoutes(app);
  registerJobRoutes(app);
  registerLearningRoutes(app);
  registerBidRoutes(app);
  registerMarketplaceRoutes(app);
  registerFaqRoutes(app);
}
