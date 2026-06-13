import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ScrapedJob;

export function getScrapedJobModel() {
  if (ScrapedJob) return ScrapedJob;

  ScrapedJob = getSequelize().define(
    'ScrapedJob',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      publicJobId: {
        type: DataTypes.TEXT,
        field: 'public_job_id',
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      title: DataTypes.TEXT,
      company: DataTypes.TEXT,
      location: DataTypes.TEXT,
      listingText: {
        type: DataTypes.TEXT,
        field: 'listing_text',
      },
      rawJob: {
        type: DataTypes.JSONB,
        field: 'raw_job',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      tableName: 'scraped_jobs',
      underscored: true,
      createdAt: false,
      updatedAt: 'updatedAt',
    },
  );

  return ScrapedJob;
}
