import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let JobProfileScore;

export function getJobProfileScoreModel() {
  if (JobProfileScore) return JobProfileScore;

  JobProfileScore = getSequelize().define(
    'JobProfileScore',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      profileId: { type: DataTypes.BIGINT, allowNull: false, field: 'profile_id' },
      jobId: { type: DataTypes.BIGINT, allowNull: false, field: 'job_id' },
      modelVersion: { type: DataTypes.TEXT, allowNull: false, field: 'model_version' },
      score: { type: DataTypes.DOUBLE, allowNull: false },
      components: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      reasons: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      profileFingerprint: { type: DataTypes.TEXT, allowNull: false, field: 'profile_fingerprint' },
      jobFingerprint: { type: DataTypes.TEXT, allowNull: false, field: 'job_fingerprint' },
      scoredAt: { type: DataTypes.DATE, allowNull: false, field: 'scored_at' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'job_profile_scores',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { unique: true, fields: ['profile_id', 'job_id', 'model_version'] },
        { fields: ['profile_id', 'model_version', 'score'] },
        { fields: ['job_id'] },
      ],
    },
  );

  return JobProfileScore;
}
