import { requireAuth } from '../../auth.js';
import { getMeta, importJobsCsv, listJobs, markJobHidden, markJobSpam } from '../controllers/jobs.js';

export function registerJobRoutes(app) {
  app.get('/api/jobs', requireAuth, listJobs);
  app.post('/api/jobs/import-csv', requireAuth, importJobsCsv);
  app.patch('/api/jobs/:id/spam', requireAuth, markJobSpam);
  app.patch('/api/jobs/:id/hidden', requireAuth, markJobHidden);
  app.get('/api/meta', requireAuth, getMeta);
}
