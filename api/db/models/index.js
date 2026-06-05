export { getBidProfileModel } from './bidProfile.js';
export { getInterviewLogModel } from './interviewLog.js';
export { getInterviewModel } from './interview.js';
export { getJobBidModel } from './jobBid.js';
export { getProfileShareRequestModel } from './profileShareRequest.js';
export { getScrapedJobModel } from './scrapedJob.js';
export { getTailoredResumeModel } from './tailoredResume.js';
export { getWebUserModel } from './webUser.js';

import { getBidProfileModel } from './bidProfile.js';
import { getInterviewLogModel } from './interviewLog.js';
import { getInterviewModel } from './interview.js';
import { getJobBidModel } from './jobBid.js';
import { getProfileShareRequestModel } from './profileShareRequest.js';
import { getScrapedJobModel } from './scrapedJob.js';
import { getTailoredResumeModel } from './tailoredResume.js';
import { getWebUserModel } from './webUser.js';

export function setupWebAssociations() {
  const WebUserModel = getWebUserModel();
  const ScrapedJobModel = getScrapedJobModel();
  const BidProfileModel = getBidProfileModel();
  const InterviewLogModel = getInterviewLogModel();
  const InterviewModel = getInterviewModel();
  const JobBidModel = getJobBidModel();
  const ProfileShareRequestModel = getProfileShareRequestModel();
  const TailoredResumeModel = getTailoredResumeModel();

  if (BidProfileModel.associations.user) return;

  WebUserModel.hasMany(BidProfileModel, { foreignKey: 'userId', as: 'bidProfiles' });
  BidProfileModel.belongsTo(WebUserModel, { foreignKey: 'userId', as: 'user' });
  BidProfileModel.hasMany(JobBidModel, { foreignKey: 'profileId', as: 'bids' });
  JobBidModel.belongsTo(BidProfileModel, { foreignKey: 'profileId', as: 'profile' });
  BidProfileModel.hasMany(InterviewModel, { foreignKey: 'profileId', as: 'interviews' });
  InterviewModel.belongsTo(BidProfileModel, { foreignKey: 'profileId', as: 'profile' });
  InterviewModel.hasMany(InterviewLogModel, { foreignKey: 'interviewId', as: 'logs' });
  InterviewLogModel.belongsTo(InterviewModel, { foreignKey: 'interviewId', as: 'interview' });
  BidProfileModel.hasMany(TailoredResumeModel, { foreignKey: 'profileId', as: 'tailoredResumes' });
  TailoredResumeModel.belongsTo(BidProfileModel, { foreignKey: 'profileId', as: 'profile' });
  BidProfileModel.hasMany(ProfileShareRequestModel, { foreignKey: 'profileId', as: 'shareRequests' });
  ProfileShareRequestModel.belongsTo(BidProfileModel, { foreignKey: 'profileId', as: 'profile' });
  WebUserModel.hasMany(ProfileShareRequestModel, { foreignKey: 'ownerUserId', as: 'sentProfileShares' });
  WebUserModel.hasMany(ProfileShareRequestModel, { foreignKey: 'recipientUserId', as: 'receivedProfileShares' });
  ProfileShareRequestModel.belongsTo(WebUserModel, { foreignKey: 'ownerUserId', as: 'owner' });
  ProfileShareRequestModel.belongsTo(WebUserModel, { foreignKey: 'recipientUserId', as: 'recipient' });
  ScrapedJobModel.hasMany(JobBidModel, { foreignKey: 'jobId', as: 'bids' });
  JobBidModel.belongsTo(ScrapedJobModel, { foreignKey: 'jobId', as: 'job' });
  ScrapedJobModel.hasMany(InterviewModel, { foreignKey: 'jobId', as: 'interviews' });
  InterviewModel.belongsTo(ScrapedJobModel, { foreignKey: 'jobId', as: 'job' });
  JobBidModel.hasOne(InterviewModel, { foreignKey: 'jobBidId', as: 'interview' });
  InterviewModel.belongsTo(JobBidModel, { foreignKey: 'jobBidId', as: 'bid' });
}
