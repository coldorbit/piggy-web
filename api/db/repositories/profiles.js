import { getBidProfileModel } from '../models/index.js';

export function listProfilesForUser(userId, options = {}) {
  const workspaceWhere = workspaceWhereFromOptions(options);
  return getBidProfileModel().findAll({
    where: { userId, ...workspaceWhere },
    order: [['createdAt', 'ASC']],
  });
}

export function findProfileForUser(params) {
  const workspaceWhere = workspaceWhereFromOptions(params);
  return getBidProfileModel().findOne({ where: { id: params.id, userId: params.userId, ...workspaceWhere } });
}

function workspaceWhereFromOptions(options = {}) {
  return Object.prototype.hasOwnProperty.call(options, 'workspaceId')
    ? { workspaceId: options.workspaceId ?? null }
    : {};
}

export function createProfile(values) {
  return getBidProfileModel().create(values);
}
