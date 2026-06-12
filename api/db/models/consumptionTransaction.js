import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ConsumptionTransaction;

export function getConsumptionTransactionModel() {
  if (ConsumptionTransaction) return ConsumptionTransaction;

  ConsumptionTransaction = getSequelize().define(
    'ConsumptionTransaction',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      type: { type: DataTypes.TEXT, allowNull: false },
      occurredAt: { type: DataTypes.DATE, allowNull: false, field: 'occurred_at' },
      notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      etherscanUrl: { type: DataTypes.TEXT, allowNull: true, field: 'etherscan_url' },
      txHash: { type: DataTypes.TEXT, allowNull: true, field: 'tx_hash' },
      spentByType: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'team', field: 'spent_by_type' },
      spentByUserId: { type: DataTypes.BIGINT, allowNull: true, field: 'spent_by_user_id' },
      createdByUserId: { type: DataTypes.BIGINT, allowNull: true, field: 'created_by_user_id' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'consumption_transactions',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['occurred_at'] },
        { fields: ['type', 'occurred_at'] },
        { fields: ['tx_hash'] },
      ],
    },
  );

  return ConsumptionTransaction;
}
