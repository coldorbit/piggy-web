import { getWebUserModel, getWorkspaceModel } from '../models/index.js';
import { Op } from 'sequelize';

export function findUserByUsername(username) {
  return getWebUserModel().findOne({ where: { username }, include: userWithWorkspace() });
}

export function findUserByLogin(login) {
  const value = String(login || '').trim().toLowerCase();
  if (!value) return null;
  return getWebUserModel().findOne({
    where: {
      [Op.or]: [
        getWebUserModel().sequelize.where(getWebUserModel().sequelize.fn('lower', getWebUserModel().sequelize.col('username')), value),
        getWebUserModel().sequelize.where(getWebUserModel().sequelize.fn('lower', getWebUserModel().sequelize.col('email')), value),
      ],
    },
    include: userWithWorkspace(),
  });
}

export function findUserByUsernameCaseInsensitive(username) {
  return getWebUserModel().findOne({
    where: getWebUserModel().sequelize.where(
      getWebUserModel().sequelize.fn('lower', getWebUserModel().sequelize.col('username')),
      String(username || '').trim().toLowerCase(),
    ),
    include: userWithWorkspace(),
  });
}

export function listUsers() {
  return getWebUserModel().findAll({ include: userWithWorkspace(), order: [['username', 'ASC']] });
}

export function findUserById(id) {
  return getWebUserModel().findByPk(id, { include: userWithWorkspace() });
}

export function createUser(values) {
  return getWebUserModel().create(values);
}

function userWithWorkspace() {
  return [{ model: getWorkspaceModel(), as: 'workspace', required: false }];
}
