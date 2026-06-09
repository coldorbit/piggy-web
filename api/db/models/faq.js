import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let Faq;

export function getFaqModel() {
  if (Faq) return Faq;

  Faq = getSequelize().define(
    'Faq',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'draft',
      },
      createdByUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'created_by_user_id',
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'published_at',
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
      tableName: 'faqs',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['status', 'updated_at'] },
        { fields: ['published_at'] },
      ],
    },
  );

  return Faq;
}
