import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let LearningCompany;

export function getLearningCompanyModel() {
  if (LearningCompany) return LearningCompany;

  LearningCompany = getSequelize().define(
    'LearningCompany',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      slug: { type: DataTypes.TEXT, allowNull: false, unique: true },
      name: { type: DataTypes.TEXT, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      website: DataTypes.TEXT,
      logoUrl: { type: DataTypes.TEXT, field: 'logo_url' },
      industry: DataTypes.TEXT,
      headquarters: DataTypes.TEXT,
      createdByUserId: { type: DataTypes.BIGINT, field: 'created_by_user_id' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'learning_companies',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ unique: true, fields: ['slug'] }, { fields: ['name'] }],
    },
  );

  return LearningCompany;
}
