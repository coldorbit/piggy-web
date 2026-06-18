import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let Assessment;

export function getAssessmentModel() {
  if (Assessment) return Assessment;

  Assessment = getSequelize().define(
    'Assessment',
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
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'user_id',
      },
      jobId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'job_id',
      },
      category: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      assessmentLink: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'assessment_link',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'expires_at',
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at',
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
      tableName: 'assessments',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['profile_id'] },
        { fields: ['user_id'] },
        { fields: ['job_id'] },
        { fields: ['expires_at'] },
      ],
    },
  );

  return Assessment;
}
