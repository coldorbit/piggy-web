import { requireJobAccess } from '../../../middleware/authMiddleware.js';
import {
  bulkMarkJobsHidden,
  bulkMarkJobsSpam,
  deleteJob,
  getJob,
  getMeta,
  importJobsCsv,
  listJobs,
  markJobHidden,
  markJobSpam,
  markLinkedInEasyApply,
  updateLinkedInExternalUrl,
} from './jobsController.js';

export function registerJobRoutes(app) {
  app.get('/api/jobs', requireJobAccess, listJobs);
  app.get('/api/jobs/:id', requireJobAccess, getJob);
  app.post('/api/jobs/import-csv', requireJobAccess, importJobsCsv);
  app.patch('/api/jobs/bulk/spam', requireJobAccess, bulkMarkJobsSpam);
  app.patch('/api/jobs/bulk/hidden', requireJobAccess, bulkMarkJobsHidden);
  app.delete('/api/jobs/:id', requireJobAccess, deleteJob);
  app.patch('/api/jobs/:id/spam', requireJobAccess, markJobSpam);
  app.patch('/api/jobs/:id/hidden', requireJobAccess, markJobHidden);
  app.patch('/api/jobs/:id/linkedin/easy-apply', requireJobAccess, markLinkedInEasyApply);
  app.patch('/api/jobs/:id/linkedin/external-url', requireJobAccess, updateLinkedInExternalUrl);
  app.get('/api/meta', requireJobAccess, getMeta);
}
