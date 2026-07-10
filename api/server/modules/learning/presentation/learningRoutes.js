import { requireAdmin, requireLearningHubAccess } from '../../../middleware/authMiddleware.js';
import {
  createLearningArticleRecord,
  deleteLearningArticleRecord,
  getLearningArticle,
  listLearningArticles,
  updateLearningArticleRecord,
} from './learningController.js';

export function registerLearningRoutes(app) {
  app.get('/api/learning/articles', requireLearningHubAccess, listLearningArticles);
  app.get('/api/learning/articles/:id', requireLearningHubAccess, getLearningArticle);
  app.post('/api/learning/articles', requireAdmin, createLearningArticleRecord);
  app.patch('/api/learning/articles/:id', requireAdmin, updateLearningArticleRecord);
  app.delete('/api/learning/articles/:id', requireAdmin, deleteLearningArticleRecord);
}
