import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ProfileStory;

export function getProfileStoryModel() {
  if (ProfileStory) return ProfileStory;

  ProfileStory = getSequelize().define(
    'ProfileStory',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      profileId: { type: DataTypes.BIGINT, allowNull: false, field: 'profile_id' },
      title: { type: DataTypes.TEXT, allowNull: false },
      situation: DataTypes.TEXT,
      responsibility: DataTypes.TEXT,
      actions: DataTypes.TEXT,
      result: DataTypes.TEXT,
      metrics: DataTypes.TEXT,
      lessons: DataTypes.TEXT,
      competencies: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      verificationStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'draft',
        field: 'verification_status',
      },
      createdByUserId: { type: DataTypes.BIGINT, field: 'created_by_user_id' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'profile_stories',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ fields: ['profile_id', 'updated_at'] }],
    },
  );

  return ProfileStory;
}
