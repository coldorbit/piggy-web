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
    },
  );

  return BidProfile;
}
