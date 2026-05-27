import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let TailoredResume;

export function getTailoredResumeModel() {
  if (TailoredResume) return TailoredResume;

  TailoredResume = getSequelize().define(
    'TailoredResume',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        field: 'user_id',
      },
      profileId: {
        type: DataTypes.BIGINT,
        field: 'profile_id',
      },
      jobUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'job_url',
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'ready',
      },
      filePath: {
        type: DataTypes.TEXT,
        field: 'file_path',
      },
      readyAt: {
        type: DataTypes.DATE,
        field: 'ready_at',
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
        field: 'max_attempts',
      },
      lastError: {
        type: DataTypes.TEXT,
        field: 'last_error',
      },
      deadLetterAt: {
        type: DataTypes.DATE,
        field: 'dead_letter_at',
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
      tableName: 'tailored_resumes',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['job_url'] },
        { fields: ['profile_id'] },
        { fields: ['status'] },
      ],
    },
  );

  return TailoredResume;
}
