import {
  requireBidWorkspaceAccess,
  requireBidJobsAccess,
  requireBidOrInterviewAccess,
  requireBidderDirectoryAccess,
  requireCallerManagement,
  requireInboxAccess,
  requireInterviewAccess,
  requirePersonalDashboardAccess,
  requireProfileHubAccess,
} from '../../../middleware/authMiddleware.js';
import {
  createJobBid,
  bulkCreateTailoredResumes,
  bulkUpdateJobBids,
  createCaller,
  createCollaborationEvent,
  createManualInterviewCall,
  createManualInterview,
  createManualTailoredResume,
  createProfile,
  createTailoredResume,
  changeProfileOwner,
  deleteProfile,
  deleteInterview,
  deleteInterviewCall,
  downloadProfileStaticResume,
  downloadTailoredResume,
  downloadTailoredResumesZip,
  listBidders,
  listCallers,
  listCalendarInterviews,
  listRelatedCalendarCalls,
  listCollaborationEvents,
  listBidJobs,
  listBidJobCounts,
  listProfileShareRequests,
  listProfileShareRecipients,
  listTailoringRequests,
  listProfiles,
  listSourceRoi,
  respondToProfileShare,
  shareProfile,
  updateJobBid,
  updateInterview,
  updateInterviewCall,
  updateProfile,
  updateCollaborationEvent,
  updateProfileStatus,
  cancelTailoredResume,
  exportCalendarIcs,
} from './biddingController.js';
import {
  createProfileStory,
  deleteProfileStory,
  geocodeProfileLocation,
  getProfileHub,
  getProfileLearningReview,
  updateProfileIntelligence,
  updateProfileLearningReview,
  updateProfilePrepPlan,
  updateProfileStory,
} from './profileIntelligenceController.js';
import {
  getForwardingMailboxBootstrap,
  getForwardingMailboxStatus,
  getForwardingMailboxSummary,
  listForwardingMailboxMessages,
  listForwardingMailboxNotifications,
  listProfileForwardedMessages,
  markProfileForwardedMessageRead,
} from './forwardingMailboxController.js';
import { getPersonalDashboard } from './personalDashboardController.js';
import { listActionQueue } from './actionQueueController.js';
import { subscribeTailoredResumeEvents } from '../application/tailoringQueueService.js';

export function registerBidRoutes(app) {
  app.get('/api/bid/dashboard', requirePersonalDashboardAccess, getPersonalDashboard);
  app.get('/api/bid/action-queue', requireBidWorkspaceAccess, listActionQueue);
  app.get('/api/bid/profiles', requireBidWorkspaceAccess, listProfiles);
  app.get('/api/bid/profile-shares', requireBidWorkspaceAccess, listProfileShareRequests);
  app.get('/api/bid/profile-share-recipients', requireBidWorkspaceAccess, listProfileShareRecipients);
  app.get('/api/bid/collaboration', requireBidWorkspaceAccess, listCollaborationEvents);
  app.post('/api/bid/collaboration', requireBidWorkspaceAccess, createCollaborationEvent);
  app.patch('/api/bid/collaboration/:id', requireBidWorkspaceAccess, updateCollaborationEvent);
  app.get('/api/bid/bidders', requireBidderDirectoryAccess, listBidders);
  app.get('/api/bid/source-roi', requireBidderDirectoryAccess, listSourceRoi);
  app.get('/api/bid/callers', requireCallerManagement, listCallers);
  app.post('/api/bid/callers', requireCallerManagement, createCaller);
  app.post('/api/bid/profiles', requireBidWorkspaceAccess, createProfile);
  app.get('/api/bid/profiles/:id/hub', requireProfileHubAccess, getProfileHub);
  app.get('/api/bid/profiles/:id/learning-review', requireProfileHubAccess, getProfileLearningReview);
  app.patch('/api/bid/profiles/:id/learning-review/:sourceType/:sourceId', requireProfileHubAccess, updateProfileLearningReview);
  app.patch('/api/bid/profiles/:id/intelligence', requireProfileHubAccess, updateProfileIntelligence);
  app.post('/api/bid/profiles/:id/location/geocode', requireProfileHubAccess, geocodeProfileLocation);
  app.post('/api/bid/profiles/:id/stories', requireProfileHubAccess, createProfileStory);
  app.patch('/api/bid/profiles/:id/stories/:storyId', requireProfileHubAccess, updateProfileStory);
  app.delete('/api/bid/profiles/:id/stories/:storyId', requireProfileHubAccess, deleteProfileStory);
  app.patch('/api/bid/profiles/:id/prep-plan', requireProfileHubAccess, updateProfilePrepPlan);
  app.get('/api/bid/mailbox/bootstrap', requireInboxAccess, getForwardingMailboxBootstrap);
  app.get('/api/bid/mailbox/status', requireInboxAccess, getForwardingMailboxStatus);
  app.get('/api/bid/mailbox/summary', requireInboxAccess, getForwardingMailboxSummary);
  app.get('/api/bid/mailbox/notifications', requireInboxAccess, listForwardingMailboxNotifications);
  app.get('/api/bid/mailbox/messages', requireInboxAccess, listForwardingMailboxMessages);
  app.get('/api/bid/profiles/:id/mailbox/messages', requireInboxAccess, listProfileForwardedMessages);
  app.patch('/api/bid/profiles/:id/mailbox/messages/read', requireInboxAccess, markProfileForwardedMessageRead);
  app.patch('/api/bid/profiles/:id', requireBidWorkspaceAccess, updateProfile);
  app.patch('/api/bid/profiles/:id/owner', requireBidWorkspaceAccess, changeProfileOwner);
  app.patch('/api/bid/profiles/:id/status', requireBidWorkspaceAccess, updateProfileStatus);
  app.get('/api/bid/profiles/:id/static-resume/download', requireBidWorkspaceAccess, downloadProfileStaticResume);
  app.delete('/api/bid/profiles/:id', requireBidWorkspaceAccess, deleteProfile);
  app.post('/api/bid/profiles/:id/share', requireBidWorkspaceAccess, shareProfile);
  app.patch('/api/bid/profile-shares/:id', requireBidWorkspaceAccess, respondToProfileShare);
  app.get('/api/bid/tailored-resume-events', requireBidWorkspaceAccess, subscribeTailoredResumeEvents);
  app.get('/api/bid/calendar', requireInterviewAccess, listCalendarInterviews);
  app.get('/api/bid/calendar/interviews/:id/related-calls', requireInterviewAccess, listRelatedCalendarCalls);
  app.get('/api/bid/calendar.ics', requireInterviewAccess, exportCalendarIcs);
  app.get('/api/bid/jobs', requireBidJobsAccess, listBidJobs);
  app.get('/api/bid/job-counts', requireBidJobsAccess, listBidJobCounts);
  app.get('/api/bid/tailoring-requests', requireBidWorkspaceAccess, listTailoringRequests);
  app.get('/api/bid/tailored-resumes/download', requireBidOrInterviewAccess, downloadTailoredResumesZip);
  app.get('/api/bid/tailored-resumes/:id/download', requireBidOrInterviewAccess, downloadTailoredResume);
  app.patch('/api/bid/tailored-resumes/:id/cancel', requireBidWorkspaceAccess, cancelTailoredResume);
  app.post('/api/bid/tailored-resumes/bulk', requireBidWorkspaceAccess, bulkCreateTailoredResumes);
  app.post('/api/bid/tailored-resumes/manual', requireBidWorkspaceAccess, createManualTailoredResume);
  app.post('/api/bid/interviews/manual', requireInterviewAccess, createManualInterview);
  app.post('/api/bid/interviews/:id/calls', requireInterviewAccess, createManualInterviewCall);
  app.patch('/api/bid/interviews/:id', requireInterviewAccess, updateInterview);
  app.patch('/api/bid/interview-calls/:id', requireInterviewAccess, updateInterviewCall);
  app.delete('/api/bid/interviews/:id', requireInterviewAccess, deleteInterview);
  app.delete('/api/bid/interview-calls/:id', requireInterviewAccess, deleteInterviewCall);
  app.post('/api/bid/jobs/:jobId/tailored-resume', requireBidWorkspaceAccess, createTailoredResume);
  app.patch('/api/bid/applications/bulk', requireBidWorkspaceAccess, bulkUpdateJobBids);
  app.post('/api/bid/jobs/:jobId', requireBidWorkspaceAccess, createJobBid);
  app.patch('/api/bid/applications/:id', requireBidWorkspaceAccess, updateJobBid);
}
