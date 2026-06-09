import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let MarketplaceCallerProfile;

export function getMarketplaceCallerProfileModel() {
  if (MarketplaceCallerProfile) return MarketplaceCallerProfile;

  MarketplaceCallerProfile = getSequelize().define(
    'MarketplaceCallerProfile',
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
      callerName: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'caller_name',
      },
      skills: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      languages: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      experience: {
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
      preferredCategories: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'preferred_categories',
      },
      rateExpectation: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'rate_expectation',
      },
      constraints: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending',
        field: 'review_status',
      },
      availabilityStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'available',
        field: 'availability_status',
      },
      performanceNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'performance_notes',
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
      tableName: 'marketplace_caller_profiles',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['owner_user_id'] },
        { fields: ['review_status', 'availability_status'] },
      ],
    },
  );

  return MarketplaceCallerProfile;
}
