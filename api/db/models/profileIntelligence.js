import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ProfileIntelligence;

export function getProfileIntelligenceModel() {
  if (ProfileIntelligence) return ProfileIntelligence;

  ProfileIntelligence = getSequelize().define(
    'ProfileIntelligence',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      profileId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
        field: 'profile_id',
      },
      targetLevel: { type: DataTypes.TEXT, field: 'target_level' },
      targetTitles: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'target_titles' },
      specializations: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      professionalSummary: { type: DataTypes.TEXT, field: 'professional_summary' },
      workAuthorization: { type: DataTypes.TEXT, field: 'work_authorization' },
      remotePreference: { type: DataTypes.TEXT, field: 'remote_preference' },
      relocationPreference: { type: DataTypes.TEXT, field: 'relocation_preference' },
      city: DataTypes.TEXT,
      region: DataTypes.TEXT,
      countryCode: { type: DataTypes.TEXT, field: 'country_code' },
      postalCode: { type: DataTypes.TEXT, field: 'postal_code' },
      timezone: DataTypes.TEXT,
      coarseLatitude: { type: DataTypes.DOUBLE, field: 'coarse_latitude' },
      coarseLongitude: { type: DataTypes.DOUBLE, field: 'coarse_longitude' },
      locationProvider: { type: DataTypes.TEXT, field: 'location_provider' },
      locationConfidence: { type: DataTypes.TEXT, field: 'location_confidence' },
      locationVerifiedAt: { type: DataTypes.DATE, field: 'location_verified_at' },
      regionalContextNotes: { type: DataTypes.TEXT, field: 'regional_context_notes' },
      regionalContextSources: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: 'regional_context_sources',
      },
      updatedByUserId: { type: DataTypes.BIGINT, field: 'updated_by_user_id' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'profile_intelligence',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ unique: true, fields: ['profile_id'] }, { fields: ['city', 'region', 'country_code'] }],
    },
  );

  return ProfileIntelligence;
}
