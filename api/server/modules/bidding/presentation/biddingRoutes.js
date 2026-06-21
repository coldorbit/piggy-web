import {
  requireBidWorkspaceAccess,
  requireBidJobsAccess,
  requireBidOrInterviewAccess,
  requireBidderDirectoryAccess,
  requireCallerManagement,
  requireInboxAccess,
  requireInterviewAccess,
  requirePersonalDashboardAccess,
} from '../../../middleware/authMiddleware.js';
import {
  createJobBid,
  bulkCreateTailoredResumes,
  bulkUpdateJobBids,
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
  app.get('/api/bid/dashboard', requirePersonalDashboardAccess, getPersonalDashboard);
  app.get('/api/bid/profiles', requireBidWorkspaceAccess, listProfiles);
  app.get('/api/bid/profile-shares', requireBidWorkspaceAccess, listProfileShareRequests);
  app.get('/api/bid/profile-share-recipients', requireBidWorkspaceAccess, listProfileShareRecipients);
  app.get('/api/bid/bidders', requireBidderDirectoryAccess, listBidders);
  app.get('/api/bid/callers', requireCallerManagement, listCallers);
  app.post('/api/bid/callers', requireCallerManagement, createCaller);
  app.post('/api/bid/profiles', requireBidWorkspaceAccess, createProfile);
  app.get('/api/bid/mailbox/status', requireInboxAccess, getForwardingMailboxStatus);
  app.get('/api/bid/mailbox/summary', requireInboxAccess, getForwardingMailboxSummary);
  app.get('/api/bid/mailbox/notifications', requireInboxAccess, listForwardingMailboxNotifications);
  app.get('/api/bid/mailbox/messages', requireInboxAccess, listForwardingMailboxMessages);
  app.get('/api/bid/profiles/:id/mailbox/messages', requireInboxAccess, listProfileForwardedMessages);
  app.patch('/api/bid/profiles/:id/mailbox/messages/read', requireInboxAccess, markProfileForwardedMessageRead);
  app.patch('/api/bid/profiles/:id', requireBidWorkspaceAccess, updateProfile);
  app.patch('/api/bid/profiles/:id/status', requireBidWorkspaceAccess, updateProfileStatus);
  app.delete('/api/bid/profiles/:id', requireBidWorkspaceAccess, deleteProfile);
  app.post('/api/bid/profiles/:id/share', requireBidWorkspaceAccess, shareProfile);
  app.patch('/api/bid/profile-shares/:id', requireBidWorkspaceAccess, respondToProfileShare);
  app.get('/api/bid/tailored-resume-events', requireBidWorkspaceAccess, subscribeTailoredResumeEvents);
  app.get('/api/bid/calendar', requireInterviewAccess, listCalendarInterviews);
  app.get('/api/bid/jobs', requireBidJobsAccess, listBidJobs);
  app.get('/api/bid/tailoring-requests', requireBidWorkspaceAccess, listTailoringRequests);
  app.get('/api/bid/tailored-resumes/download', requireBidOrInterviewAccess, downloadTailoredResumesZip);
  app.get('/api/bid/tailored-resumes/:id/download', requireBidOrInterviewAccess, downloadTailoredResume);
  app.patch('/api/bid/tailored-resumes/:id/cancel', requireBidWorkspaceAccess, cancelTailoredResume);
  app.post('/api/bid/tailored-resumes/bulk', requireBidWorkspaceAccess, bulkCreateTailoredResumes);
  app.post('/api/bid/tailored-resumes/manual', requireBidWorkspaceAccess, createManualTailoredResume);
  app.post('/api/bid/interviews/manual', requireInterviewAccess, createManualInterview);
  app.patch('/api/bid/interviews/:id', requireInterviewAccess, updateInterview);
  app.delete('/api/bid/interviews/:id', requireInterviewAccess, deleteInterview);
  app.post('/api/bid/jobs/:jobId/tailored-resume', requireBidWorkspaceAccess, createTailoredResume);
  app.patch('/api/bid/applications/bulk', requireBidWorkspaceAccess, bulkUpdateJobBids);
  app.post('/api/bid/jobs/:jobId', requireBidWorkspaceAccess, createJobBid);
  app.patch('/api/bid/applications/:id', requireBidWorkspaceAccess, updateJobBid);
}
