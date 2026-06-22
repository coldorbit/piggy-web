import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let InterviewCall;

export function getInterviewCallModel() {
  if (InterviewCall) return InterviewCall;

  InterviewCall = getSequelize().define(
    'InterviewCall',
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
      callerUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'caller_user_id',
      },
      interviewStage: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'todo',
        field: 'interview_stage',
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'scheduled_at',
      },
      durationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60,
        field: 'duration_minutes',
      },
      meetingLink: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'meeting_link',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sourceType: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'current_schedule',
        field: 'source_type',
      },
      sourceKey: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'source_key',
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
      tableName: 'interview_calls',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['interview_id', 'scheduled_at'] },
        { fields: ['caller_user_id', 'scheduled_at'] },
        { unique: true, fields: ['source_key'] },
      ],
    },
  );

  return InterviewCall;
}
