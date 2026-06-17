import { requireAssessmentAccess } from '../../../middleware/authMiddleware.js';
import {
  createAssessment,
  deleteAssessment,
  listAssessmentProfiles,
  listAssessments,
} from './assessmentsController.js';

export function registerAssessmentRoutes(app) {
  app.get('/api/assessments/profiles', requireAssessmentAccess, listAssessmentProfiles);
  app.get('/api/assessments', requireAssessmentAccess, listAssessments);
  app.post('/api/assessments', requireAssessmentAccess, createAssessment);
  app.delete('/api/assessments/:id', requireAssessmentAccess, deleteAssessment);
}
