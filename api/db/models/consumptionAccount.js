import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ConsumptionAccount;

export function getConsumptionAccountModel() {
  if (ConsumptionAccount) return ConsumptionAccount;

  ConsumptionAccount = getSequelize().define(
    'ConsumptionAccount',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.TEXT, allowNull: false, unique: true },
      currency: { type: DataTypes.TEXT, allowNull: false },
      type: { type: DataTypes.TEXT, allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'consumption_accounts',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { unique: true, fields: ['name'] },
        { fields: ['currency'] },
      ],
    },
  );

  return ConsumptionAccount;
}
