import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ProfileShareRequest;

export function getProfileShareRequestModel() {
  if (ProfileShareRequest) return ProfileShareRequest;

  ProfileShareRequest = getSequelize().define(
    'ProfileShareRequest',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      profileId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'profile_id',
      },
      ownerUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'owner_user_id',
      },
      recipientUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'recipient_user_id',
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending',
      },
      respondedAt: {
        type: DataTypes.DATE,
        field: 'responded_at',
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
      tableName: 'profile_share_requests',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { unique: true, fields: ['profile_id', 'recipient_user_id'] },
        { fields: ['owner_user_id'] },
        { fields: ['recipient_user_id', 'status'] },
      ],
    },
  );

  return ProfileShareRequest;
}
