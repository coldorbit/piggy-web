import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let RankingImpression;

export function getRankingImpressionModel() {
  if (RankingImpression) return RankingImpression;

  RankingImpression = getSequelize().define(
    'RankingImpression',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      requestId: { type: DataTypes.TEXT, allowNull: false, field: 'request_id' },
      userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id' },
      profileId: { type: DataTypes.BIGINT, allowNull: false, field: 'profile_id' },
      jobId: { type: DataTypes.BIGINT, allowNull: false, field: 'job_id' },
      modelVersion: { type: DataTypes.TEXT, allowNull: false, field: 'model_version' },
      score: { type: DataTypes.DOUBLE, allowNull: false },
      displayRank: { type: DataTypes.INTEGER, allowNull: false, field: 'display_rank' },
      surface: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'bid_jobs' },
      shownAt: { type: DataTypes.DATE, allowNull: false, field: 'shown_at' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'ranking_impressions',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { unique: true, fields: ['request_id', 'job_id'] },
        { fields: ['profile_id', 'shown_at'] },
        { fields: ['user_id', 'shown_at'] },
      ],
    },
  );

  return RankingImpression;
}
