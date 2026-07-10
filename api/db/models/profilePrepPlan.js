import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ProfilePrepPlan;

export function getProfilePrepPlanModel() {
  if (ProfilePrepPlan) return ProfilePrepPlan;

  ProfilePrepPlan = getSequelize().define(
    'ProfilePrepPlan',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      profileId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
        field: 'profile_id',
      },
      status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'draft' },
      competencyScores: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        field: 'competency_scores',
      },
      focusAreas: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'focus_areas' },
      notes: DataTypes.TEXT,
      nextMockAt: { type: DataTypes.DATE, field: 'next_mock_at' },
      updatedByUserId: { type: DataTypes.BIGINT, field: 'updated_by_user_id' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'profile_prep_plans',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ unique: true, fields: ['profile_id'] }],
    },
  );

  return ProfilePrepPlan;
}
