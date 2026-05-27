import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let JobBid;

export function getJobBidModel() {
  if (JobBid) return JobBid;

  JobBid = getSequelize().define(
    'JobBid',
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
      profileId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'profile_id',
      },
      jobId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'job_id',
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'planned',
      },
      bidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        field: 'bid_amount',
      },
      coverLetter: {
        type: DataTypes.TEXT,
        field: 'cover_letter',
      },
      notes: DataTypes.TEXT,
      bidAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'bid_at',
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
      tableName: 'job_bids',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { unique: true, fields: ['profile_id', 'job_id'] },
        { fields: ['user_id'] },
        { fields: ['job_id'] },
      ],
    },
  );

  return JobBid;
}
