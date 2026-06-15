import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let BidProfile;

export function getBidProfileModel() {
  if (BidProfile) return BidProfile;

  BidProfile = getSequelize().define(
    'BidProfile',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'user_id',
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      location: DataTypes.TEXT,
      phone: DataTypes.TEXT,
      email: DataTypes.TEXT,
      linkedin: DataTypes.TEXT,
      yearsOfExperience: {
        type: DataTypes.TEXT,
        field: 'years_of_experience',
      },
      resumeText: {
        type: DataTypes.TEXT,
        field: 'resume_text',
      },
      resumeTemplate: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'classic',
        field: 'resume_template',
      },
      colorScheme: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'green',
        field: 'color_scheme',
      },
      profileBadge: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'SWE',
        field: 'profile_badge',
      },
      profileStatus: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'active',
        field: 'profile_status',
      },
      dailyBidGoal: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'daily_bid_goal',
      },
      closedReason: {
        type: DataTypes.TEXT,
        field: 'closed_reason',
      },
      closedAt: {
        type: DataTypes.DATE,
        field: 'closed_at',
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
      tableName: 'bid_profiles',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ fields: ['user_id'] }],
    },
  );

  return BidProfile;
}
