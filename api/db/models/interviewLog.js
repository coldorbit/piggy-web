import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let InterviewLog;

export function getInterviewLogModel() {
  if (InterviewLog) return InterviewLog;

  InterviewLog = getSequelize().define(
    'InterviewLog',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      interviewId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'interview_id',
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'user_id',
      },
      eventType: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'event_type',
      },
      fromValue: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'from_value',
      },
      toValue: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'to_value',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
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
      tableName: 'interview_logs',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['interview_id', 'created_at'] },
        { fields: ['event_type'] },
      ],
    },
  );

  return InterviewLog;
}
