import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let MarketplaceParticipant;

export function getMarketplaceParticipantModel() {
  if (MarketplaceParticipant) return MarketplaceParticipant;

  MarketplaceParticipant = getSequelize().define(
    'MarketplaceParticipant',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'user_id',
      },
      participantRole: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'both',
        field: 'participant_role',
      },
      displayName: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'display_name',
      },
      timezone: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending',
        field: 'review_status',
      },
      riskStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'normal',
        field: 'risk_status',
      },
      publicNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'public_notes',
      },
      internalNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'internal_notes',
      },
      reviewedByUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'reviewed_by_user_id',
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'reviewed_at',
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
      tableName: 'marketplace_participants',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { unique: true, fields: ['user_id'] },
        { fields: ['review_status'] },
        { fields: ['participant_role'] },
      ],
    },
  );

  return MarketplaceParticipant;
}
