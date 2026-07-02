import { getBidProfileModel } from '../models/index.js';

export function listProfilesForUser(userId, { workspaceId } = {}) {
  return getBidProfileModel().findAll({
    where: { userId, ...(workspaceId ? { workspaceId } : {}) },
    order: [['createdAt', 'ASC']],
  });
}

export function findProfileForUser({ id, userId, workspaceId }) {
  return getBidProfileModel().findOne({ where: { id, userId, ...(workspaceId ? { workspaceId } : {}) } });
}

export function createProfile(values) {
  return getBidProfileModel().create(values);
}
