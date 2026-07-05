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
      requestType: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'job',
        field: 'request_type',
      },
      manualCompany: {
        type: DataTypes.TEXT,
        field: 'manual_company',
      },
      manualRole: {
        type: DataTypes.TEXT,
        field: 'manual_role',
      },
      manualJobDescription: {
        type: DataTypes.TEXT,
        field: 'manual_job_description',
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
      cvData: {
        type: DataTypes.JSONB,
        field: 'cv_data',
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
      downloadedAt: {
        type: DataTypes.DATE,
        field: 'downloaded_at',
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
        { fields: ['profile_id'] },
        { fields: ['status'] },
      ],
    },
  );

  return TailoredResume;
}
