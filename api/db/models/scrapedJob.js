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
      url: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      duplicateKey: {
        type: DataTypes.TEXT,
        field: 'duplicate_key',
      },
      source: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      sourceUrl: {
        type: DataTypes.TEXT,
        field: 'source_url',
      },
      title: DataTypes.TEXT,
      company: DataTypes.TEXT,
      location: DataTypes.TEXT,
      category: DataTypes.TEXT,
      postedAt: {
        type: DataTypes.DATE,
        field: 'posted_at',
      },
      scrapedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'scraped_at',
      },
      listingText: {
        type: DataTypes.TEXT,
        field: 'listing_text',
      },
      rawJob: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: 'raw_job',
      },
      isSpam: {
        type: DataTypes.BOOLEAN,
        field: 'is_spam',
      },
      spamReviewedAt: {
        type: DataTypes.DATE,
        field: 'spam_reviewed_at',
      },
      isHidden: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_hidden',
      },
      hiddenAt: {
        type: DataTypes.DATE,
        field: 'hidden_at',
      },
      firstSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'first_seen_at',
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
      createdAt: 'firstSeenAt',
      updatedAt: 'updatedAt',
    },
  );

  return ScrapedJob;
}
