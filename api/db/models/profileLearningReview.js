import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ProfileLearningReview;

export function getProfileLearningReviewModel() {
  if (ProfileLearningReview) return ProfileLearningReview;

  ProfileLearningReview = getSequelize().define(
    'ProfileLearningReview',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      profileId: { type: DataTypes.BIGINT, allowNull: false, field: 'profile_id', references: { model: 'bid_profiles', key: 'id' }, onDelete: 'CASCADE' },
      jobBidId: { type: DataTypes.BIGINT, allowNull: true, field: 'job_bid_id', references: { model: 'job_bids', key: 'id' }, onDelete: 'CASCADE' },
      interviewId: { type: DataTypes.BIGINT, allowNull: true, field: 'interview_id', references: { model: 'interviews', key: 'id' }, onDelete: 'CASCADE' },
      outcomeReason: { type: DataTypes.TEXT, allowNull: true, field: 'outcome_reason' },
      outcomeAt: { type: DataTypes.DATEONLY, allowNull: true, field: 'outcome_at' },
      learningSummary: { type: DataTypes.TEXT, allowNull: true, field: 'learning_summary' },
      nextAction: { type: DataTypes.TEXT, allowNull: true, field: 'next_action' },
      updatedByUserId: { type: DataTypes.BIGINT, allowNull: true, field: 'updated_by_user_id', references: { model: 'web_users', key: 'id' }, onDelete: 'SET NULL' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'profile_learning_reviews',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['profile_id', 'updated_at'] },
        { unique: true, fields: ['job_bid_id'] },
        { unique: true, fields: ['interview_id'] },
      ],
    },
  );

  return ProfileLearningReview;
}
