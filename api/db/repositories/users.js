import { getWebUserModel } from '../models/index.js';
import { Op } from 'sequelize';

export function findUserByUsername(username) {
  return getWebUserModel().findOne({ where: { username } });
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
  });
}

export function findUserByUsernameCaseInsensitive(username) {
  return getWebUserModel().findOne({
    where: getWebUserModel().sequelize.where(
      getWebUserModel().sequelize.fn('lower', getWebUserModel().sequelize.col('username')),
      String(username || '').trim().toLowerCase(),
    ),
  });
}

export function listUsers() {
  return getWebUserModel().findAll({ order: [['username', 'ASC']] });
}

export function findUserById(id) {
  return getWebUserModel().findByPk(id);
}

export function createUser(values) {
  return getWebUserModel().create(values);
}
