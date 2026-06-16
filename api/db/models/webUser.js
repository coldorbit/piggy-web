import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let WebUser;

export function getWebUserModel() {
  if (WebUser) return WebUser;

  WebUser = getSequelize().define(
    'WebUser',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      username: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.TEXT,
        allowNull: true,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'password_hash',
      },
      role: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'user',
      },
      dailyBidGoal: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'daily_bid_goal',
      },
      timezone: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'America/New_York',
      },
      activeSessionId: {
        type: DataTypes.TEXT,
        field: 'active_session_id',
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        field: 'last_login_at',
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        field: 'last_seen_at',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      tableName: 'web_users',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  );

  return WebUser;
}
