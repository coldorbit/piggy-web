import { requireAdmin, requireAuth } from '../../../middleware/authMiddleware.js';
import { createFaqRecord, deleteFaqRecord, getFaq, listFaqs, updateFaqRecord } from './faqsController.js';

export function registerFaqRoutes(app) {
  app.get('/api/faqs', requireAuth, listFaqs);
  app.get('/api/faqs/:id', requireAuth, getFaq);
  app.post('/api/faqs', requireAdmin, createFaqRecord);
  app.patch('/api/faqs/:id', requireAdmin, updateFaqRecord);
  app.delete('/api/faqs/:id', requireAdmin, deleteFaqRecord);
}
