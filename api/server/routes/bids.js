import { requireAuth } from '../../auth.js';
import {
  createJobBid,
  createManualInterview,
  createProfile,
  createTailoredResume,
  deleteProfile,
  downloadTailoredResume,
  downloadTailoredResumesZip,
  listBidders,
  listCallers,
  listBidJobs,
  listProfileShareRequests,
  listProfileShareRecipients,
  listProfiles,
  respondToProfileShare,
  shareProfile,
  updateJobBid,
  updateInterview,
  updateProfile,
  updateProfileStatus,
} from '../controllers/bids.js';
import { subscribeTailoredResumeEvents } from '../services/tailoringQueue.js';

export function registerBidRoutes(app) {
  app.get('/api/bid/profiles', requireAuth, listProfiles);
  app.get('/api/bid/profile-shares', requireAuth, listProfileShareRequests);
  app.get('/api/bid/profile-share-recipients', requireAuth, listProfileShareRecipients);
  app.get('/api/bid/bidders', requireAuth, listBidders);
  app.get('/api/bid/callers', requireAuth, listCallers);
  app.post('/api/bid/profiles', requireAuth, createProfile);
  app.patch('/api/bid/profiles/:id', requireAuth, updateProfile);
  app.patch('/api/bid/profiles/:id/status', requireAuth, updateProfileStatus);
  app.delete('/api/bid/profiles/:id', requireAuth, deleteProfile);
  app.post('/api/bid/profiles/:id/share', requireAuth, shareProfile);
  app.patch('/api/bid/profile-shares/:id', requireAuth, respondToProfileShare);
  app.get('/api/bid/tailored-resume-events', requireAuth, subscribeTailoredResumeEvents);
  app.get('/api/bid/jobs', requireAuth, listBidJobs);
  app.get('/api/bid/tailored-resumes/download', requireAuth, downloadTailoredResumesZip);
  app.get('/api/bid/tailored-resumes/:id/download', requireAuth, downloadTailoredResume);
  app.post('/api/bid/interviews/manual', requireAuth, createManualInterview);
  app.patch('/api/bid/interviews/:id', requireAuth, updateInterview);
  app.post('/api/bid/jobs/:jobId/tailored-resume', requireAuth, createTailoredResume);
  app.post('/api/bid/jobs/:jobId', requireAuth, createJobBid);
  app.patch('/api/bid/applications/:id', requireAuth, updateJobBid);
}
