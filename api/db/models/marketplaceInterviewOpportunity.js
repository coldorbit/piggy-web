import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let MarketplaceInterviewOpportunity;

export function getMarketplaceInterviewOpportunityModel() {
  if (MarketplaceInterviewOpportunity) return MarketplaceInterviewOpportunity;

  MarketplaceInterviewOpportunity = getSequelize().define(
    'MarketplaceInterviewOpportunity',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      ownerUserId: { type: DataTypes.BIGINT, allowNull: false, field: 'owner_user_id' },
      title: { type: DataTypes.TEXT, allowNull: false },
      company: DataTypes.TEXT,
      stage: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'screen' },
      format: DataTypes.TEXT,
      timezone: DataTypes.TEXT,
      availabilityWindows: { type: DataTypes.TEXT, field: 'availability_windows' },
      requiredSkills: { type: DataTypes.TEXT, field: 'required_skills' },
      budget: DataTypes.TEXT,
      jobUrl: { type: DataTypes.TEXT, field: 'job_url' },
      notes: DataTypes.TEXT,
      reviewStatus: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'pending', field: 'review_status' },
      matchStatus: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'submitted', field: 'match_status' },
      internalNotes: { type: DataTypes.TEXT, field: 'internal_notes' },
      reviewedByUserId: { type: DataTypes.BIGINT, field: 'reviewed_by_user_id' },
      reviewedAt: { type: DataTypes.DATE, field: 'reviewed_at' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'marketplace_interview_opportunities',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ fields: ['owner_user_id'] }, { fields: ['review_status', 'match_status'] }],
    },
  );

  return MarketplaceInterviewOpportunity;
}
