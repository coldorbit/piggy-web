import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let Interview;

export function getInterviewModel() {
  if (Interview) return Interview;

  Interview = getSequelize().define(
    'Interview',
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
      callerUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'caller_user_id',
      },
      profileId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'profile_id',
      },
      jobId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'job_id',
      },
      jobBidId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'job_bid_id',
      },
      title: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      company: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      location: DataTypes.TEXT,
      jobUrl: {
        type: DataTypes.TEXT,
        field: 'job_url',
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'interviewing',
      },
      interviewStage: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'todo',
        field: 'interview_stage',
      },
      interviewNextAt: {
        type: DataTypes.DATE,
        field: 'interview_next_at',
      },
      interviewNotes: {
        type: DataTypes.TEXT,
        field: 'interview_notes',
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
      tableName: 'interviews',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['profile_id', 'status'] },
        { fields: ['caller_user_id', 'status'] },
        { unique: true, fields: ['job_bid_id'] },
      ],
    },
  );

  return Interview;
}
