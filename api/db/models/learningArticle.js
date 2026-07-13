import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let LearningArticle;

export function getLearningArticleModel() {
  if (LearningArticle) return LearningArticle;

  LearningArticle = getSequelize().define(
    'LearningArticle',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      category: { type: DataTypes.TEXT, allowNull: false },
      title: { type: DataTypes.TEXT, allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      excalidrawData: { type: DataTypes.JSONB, field: 'excalidraw_data' },
      mermaidScript: { type: DataTypes.TEXT, field: 'mermaid_script' },
      tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      companyName: { type: DataTypes.TEXT, field: 'company_name' },
      companyWebsite: { type: DataTypes.TEXT, field: 'company_website' },
      companyLogoUrl: { type: DataTypes.TEXT, field: 'company_logo_url' },
      city: DataTypes.TEXT,
      region: DataTypes.TEXT,
      countryCode: { type: DataTypes.TEXT, field: 'country_code' },
      difficulty: DataTypes.TEXT,
      sourceLinks: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'source_links' },
      featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'draft' },
      createdByUserId: { type: DataTypes.BIGINT, field: 'created_by_user_id' },
      publishedAt: { type: DataTypes.DATE, field: 'published_at' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'learning_articles',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['category', 'status', 'updated_at'] },
        { fields: ['featured', 'published_at'] },
        { fields: ['company_name'] },
        { fields: ['city', 'region', 'country_code'] },
      ],
    },
  );

  return LearningArticle;
}
