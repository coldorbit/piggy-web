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
      workspaceId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'workspace_id',
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      location: DataTypes.TEXT,
      phone: DataTypes.TEXT,
      email: DataTypes.TEXT,
      forwardingEmail: {
        type: DataTypes.TEXT,
        field: 'forwarding_email',
      },
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
      isStatic: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_static',
      },
      staticResumeData: {
        type: DataTypes.BLOB('long'),
        field: 'static_resume_data',
      },
      staticResumeFilename: {
        type: DataTypes.TEXT,
        field: 'static_resume_filename',
      },
      staticResumeContentType: {
        type: DataTypes.TEXT,
        field: 'static_resume_content_type',
      },
      staticResumeUploadedAt: {
        type: DataTypes.DATE,
        field: 'static_resume_uploaded_at',
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
        allowNull: false,
        defaultValue: 60,
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
      defaultScope: {
        attributes: { exclude: ['staticResumeData'] },
      },
      scopes: {
        withStaticResume: {},
      },
      indexes: [{ fields: ['user_id'] }],
    },
  );

  return BidProfile;
}
