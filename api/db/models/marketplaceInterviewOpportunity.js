import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let MarketplaceInterviewOpportunity;

export function getMarketplaceInterviewOpportunityModel() {
  if (MarketplaceInterviewOpportunity) return MarketplaceInterviewOpportunity;

  MarketplaceInterviewOpportunity = getSequelize().define(
    'MarketplaceInterviewOpportunity',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      ownerUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'owner_user_id',
      },
      title: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      company: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      stage: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'screen',
      },
      format: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      timezone: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      availabilityWindows: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'availability_windows',
      },
      requiredSkills: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'required_skills',
      },
      budget: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      jobUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'job_url',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending',
        field: 'review_status',
      },
      matchStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'submitted',
        field: 'match_status',
      },
      internalNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'internal_notes',
      },
      reviewedByUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'reviewed_by_user_id',
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'reviewed_at',
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
      tableName: 'marketplace_interview_opportunities',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['owner_user_id'] },
        { fields: ['review_status', 'match_status'] },
      ],
    },
  );

  return MarketplaceInterviewOpportunity;
}
