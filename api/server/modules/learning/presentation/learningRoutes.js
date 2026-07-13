import { requireAdmin, requireLearningHubAccess, requireSuperadmin } from '../../../middleware/authMiddleware.js';
import {
  createLearningCompanyRecord,
  createLearningArticleRecord,
  deleteLearningArticleRecord,
  getLearningArticle,
  listLearningCompanies,
  listLearningArticles,
  updateLearningCompanyRecord,
  updateLearningArticleRecord,
} from './learningController.js';

export function registerLearningRoutes(app) {
  app.get('/api/learning/companies', requireLearningHubAccess, listLearningCompanies);
  app.post('/api/learning/companies', requireSuperadmin, createLearningCompanyRecord);
  app.patch('/api/learning/companies/:id', requireSuperadmin, updateLearningCompanyRecord);
  app.get('/api/learning/articles', requireLearningHubAccess, listLearningArticles);
  app.get('/api/learning/articles/:id', requireLearningHubAccess, getLearningArticle);
  app.post('/api/learning/articles', requireAdmin, createLearningArticleRecord);
  app.patch('/api/learning/articles/:id', requireAdmin, updateLearningArticleRecord);
  app.delete('/api/learning/articles/:id', requireAdmin, deleteLearningArticleRecord);
}
