import { getBidProfileModel } from '../models/index.js';

export function listProfilesForUser(userId) {
  return getBidProfileModel().findAll({
    where: { userId },
    order: [['createdAt', 'ASC']],
  });
}

export function findProfileForUser({ id, userId }) {
  return getBidProfileModel().findOne({ where: { id, userId } });
}

export function createProfile(values) {
  return getBidProfileModel().create(values);
}
