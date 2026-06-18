import { requireAssessmentAccess } from '../../../middleware/authMiddleware.js';
import {
  createAssessment,
  deleteAssessment,
  listAssessmentProfiles,
  listAssessments,
  markAssessmentDone,
} from './assessmentsController.js';

export function registerAssessmentRoutes(app) {
  app.get('/api/assessments/profiles', requireAssessmentAccess, listAssessmentProfiles);
  app.get('/api/assessments', requireAssessmentAccess, listAssessments);
  app.post('/api/assessments', requireAssessmentAccess, createAssessment);
  app.patch('/api/assessments/:id/done', requireAssessmentAccess, markAssessmentDone);
  app.delete('/api/assessments/:id', requireAssessmentAccess, deleteAssessment);
}
