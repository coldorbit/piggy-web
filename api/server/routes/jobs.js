import { requireAuth } from '../../auth.js';
import {
  deleteJob,
  getMeta,
  importJobsCsv,
  listJobs,
  markJobHidden,
  markJobSpam,
  markLinkedInEasyApply,
  updateLinkedInExternalUrl,
} from '../controllers/jobs.js';

export function registerJobRoutes(app) {
  app.get('/api/jobs', requireAuth, listJobs);
  app.post('/api/jobs/import-csv', requireAuth, importJobsCsv);
  app.delete('/api/jobs/:id', requireAuth, deleteJob);
  app.patch('/api/jobs/:id/spam', requireAuth, markJobSpam);
  app.patch('/api/jobs/:id/hidden', requireAuth, markJobHidden);
  app.patch('/api/jobs/:id/linkedin/easy-apply', requireAuth, markLinkedInEasyApply);
  app.patch('/api/jobs/:id/linkedin/external-url', requireAuth, updateLinkedInExternalUrl);
  app.get('/api/meta', requireAuth, getMeta);
}
