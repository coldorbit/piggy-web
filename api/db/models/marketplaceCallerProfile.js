import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let MarketplaceCallerProfile;

export function getMarketplaceCallerProfileModel() {
  if (MarketplaceCallerProfile) return MarketplaceCallerProfile;

  MarketplaceCallerProfile = getSequelize().define(
    'MarketplaceCallerProfile',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      ownerUserId: { type: DataTypes.BIGINT, allowNull: false, field: 'owner_user_id' },
      callerName: { type: DataTypes.TEXT, allowNull: false, field: 'caller_name' },
      skills: DataTypes.TEXT,
      languages: DataTypes.TEXT,
      experience: DataTypes.TEXT,
      timezone: DataTypes.TEXT,
      availabilityWindows: { type: DataTypes.TEXT, field: 'availability_windows' },
      preferredCategories: { type: DataTypes.TEXT, field: 'preferred_categories' },
      rateExpectation: { type: DataTypes.TEXT, field: 'rate_expectation' },
      constraints: DataTypes.TEXT,
      reviewStatus: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'pending', field: 'review_status' },
      availabilityStatus: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'available', field: 'availability_status' },
      performanceNotes: { type: DataTypes.TEXT, field: 'performance_notes' },
      internalNotes: { type: DataTypes.TEXT, field: 'internal_notes' },
      reviewedByUserId: { type: DataTypes.BIGINT, field: 'reviewed_by_user_id' },
      reviewedAt: { type: DataTypes.DATE, field: 'reviewed_at' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'marketplace_caller_profiles',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ fields: ['owner_user_id'] }, { fields: ['review_status', 'availability_status'] }],
    },
  );

  return MarketplaceCallerProfile;
}
