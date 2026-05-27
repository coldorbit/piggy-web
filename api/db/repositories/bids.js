import { getJobBidModel, getTailoredResumeModel } from '../models/index.js';

export function createJobBid(values) {
  return getJobBidModel().create(values);
}

export function deleteBidsForProfile(profileId) {
  return getJobBidModel().destroy({ where: { profileId } });
}

export function findJobBidForUser({ id, userId }) {
  return getJobBidModel().findOne({ where: { id, userId } });
}

export function findLatestTailoredResume({ profileId, jobUrl }) {
  return getTailoredResumeModel().findOne({
    where: { profileId, jobUrl },
    order: [['updatedAt', 'DESC']],
  });
}
