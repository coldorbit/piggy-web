import { getWebUserModel } from '../models/index.js';

export function findUserByUsername(username) {
  return getWebUserModel().findOne({ where: { username } });
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
