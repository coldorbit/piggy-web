import { requireBidWorkspaceAccess } from '../../../middleware/authMiddleware.js';
import {
  createJobBid,
  createCaller,
  createManualInterview,
  createManualTailoredResume,
  createProfile,
  createTailoredResume,
  deleteProfile,
  deleteInterview,
  downloadTailoredResume,
  downloadTailoredResumesZip,
  listBidders,
  listCallers,
  listCalendarInterviews,
  listBidJobs,
  listProfileShareRequests,
  listProfileShareRecipients,
  listTailoringRequests,
  listProfiles,
  respondToProfileShare,
  shareProfile,
  updateJobBid,
  updateInterview,
  updateProfile,
  updateProfileStatus,
  cancelTailoredResume,
} from './biddingController.js';
import {
  getForwardingMailboxStatus,
  getForwardingMailboxSummary,
  listForwardingMailboxMessages,
  listForwardingMailboxNotifications,
  listProfileForwardedMessages,
  markProfileForwardedMessageRead,
} from './forwardingMailboxController.js';
import { getPersonalDashboard } from './personalDashboardController.js';
import { subscribeTailoredResumeEvents } from '../application/tailoringQueueService.js';

export function registerBidRoutes(app) {
  app.get('/api/bid/dashboard', requireBidWorkspaceAccess, getPersonalDashboard);
  app.get('/api/bid/profiles', requireBidWorkspaceAccess, listProfiles);
  app.get('/api/bid/profile-shares', requireBidWorkspaceAccess, listProfileShareRequests);
  app.get('/api/bid/profile-share-recipients', requireBidWorkspaceAccess, listProfileShareRecipients);
  app.get('/api/bid/bidders', requireBidWorkspaceAccess, listBidders);
  app.get('/api/bid/callers', requireBidWorkspaceAccess, listCallers);
  app.post('/api/bid/callers', requireBidWorkspaceAccess, createCaller);
  app.post('/api/bid/profiles', requireBidWorkspaceAccess, createProfile);
  app.get('/api/bid/mailbox/status', requireBidWorkspaceAccess, getForwardingMailboxStatus);
  app.get('/api/bid/mailbox/summary', requireBidWorkspaceAccess, getForwardingMailboxSummary);
  app.get('/api/bid/mailbox/notifications', requireBidWorkspaceAccess, listForwardingMailboxNotifications);
  app.get('/api/bid/mailbox/messages', requireBidWorkspaceAccess, listForwardingMailboxMessages);
  app.get('/api/bid/profiles/:id/mailbox/messages', requireBidWorkspaceAccess, listProfileForwardedMessages);
  app.patch('/api/bid/profiles/:id/mailbox/messages/read', requireBidWorkspaceAccess, markProfileForwardedMessageRead);
  app.patch('/api/bid/profiles/:id', requireBidWorkspaceAccess, updateProfile);
  app.patch('/api/bid/profiles/:id/status', requireBidWorkspaceAccess, updateProfileStatus);
  app.delete('/api/bid/profiles/:id', requireBidWorkspaceAccess, deleteProfile);
  app.post('/api/bid/profiles/:id/share', requireBidWorkspaceAccess, shareProfile);
  app.patch('/api/bid/profile-shares/:id', requireBidWorkspaceAccess, respondToProfileShare);
  app.get('/api/bid/tailored-resume-events', requireBidWorkspaceAccess, subscribeTailoredResumeEvents);
  app.get('/api/bid/calendar', requireBidWorkspaceAccess, listCalendarInterviews);
  app.get('/api/bid/jobs', requireBidWorkspaceAccess, listBidJobs);
  app.get('/api/bid/tailoring-requests', requireBidWorkspaceAccess, listTailoringRequests);
  app.get('/api/bid/tailored-resumes/download', requireBidWorkspaceAccess, downloadTailoredResumesZip);
  app.get('/api/bid/tailored-resumes/:id/download', requireBidWorkspaceAccess, downloadTailoredResume);
  app.patch('/api/bid/tailored-resumes/:id/cancel', requireBidWorkspaceAccess, cancelTailoredResume);
  app.post('/api/bid/tailored-resumes/manual', requireBidWorkspaceAccess, createManualTailoredResume);
  app.post('/api/bid/interviews/manual', requireBidWorkspaceAccess, createManualInterview);
  app.patch('/api/bid/interviews/:id', requireBidWorkspaceAccess, updateInterview);
  app.delete('/api/bid/interviews/:id', requireBidWorkspaceAccess, deleteInterview);
  app.post('/api/bid/jobs/:jobId/tailored-resume', requireBidWorkspaceAccess, createTailoredResume);
  app.post('/api/bid/jobs/:jobId', requireBidWorkspaceAccess, createJobBid);
  app.patch('/api/bid/applications/:id', requireBidWorkspaceAccess, updateJobBid);
}
