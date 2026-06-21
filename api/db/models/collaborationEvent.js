import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let CollaborationEvent;

export function getCollaborationEventModel() {
  if (CollaborationEvent) return CollaborationEvent;

  CollaborationEvent = getSequelize().define(
    'CollaborationEvent',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      entityType: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'entity_type',
      },
      entityId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'entity_id',
      },
      profileId: {
        type: DataTypes.BIGINT,
        field: 'profile_id',
      },
      jobId: {
        type: DataTypes.BIGINT,
        field: 'job_id',
      },
      bidId: {
        type: DataTypes.BIGINT,
        field: 'bid_id',
      },
      authorUserId: {
        type: DataTypes.BIGINT,
        field: 'author_user_id',
      },
      assignedToUserId: {
        type: DataTypes.BIGINT,
        field: 'assigned_to_user_id',
      },
      eventType: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'event_type',
      },
      body: DataTypes.TEXT,
      mentions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      resolvedAt: {
        type: DataTypes.DATE,
        field: 'resolved_at',
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
      tableName: 'collaboration_events',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['entity_type', 'entity_id', 'created_at'] },
        { fields: ['profile_id', 'created_at'] },
        { fields: ['assigned_to_user_id', 'resolved_at'] },
      ],
    },
  );

  return CollaborationEvent;
}
