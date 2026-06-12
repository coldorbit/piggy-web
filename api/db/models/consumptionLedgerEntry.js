import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let ConsumptionLedgerEntry;

export function getConsumptionLedgerEntryModel() {
  if (ConsumptionLedgerEntry) return ConsumptionLedgerEntry;

  ConsumptionLedgerEntry = getSequelize().define(
    'ConsumptionLedgerEntry',
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      transactionId: { type: DataTypes.BIGINT, allowNull: false, field: 'transaction_id' },
      accountId: { type: DataTypes.BIGINT, allowNull: false, field: 'account_id' },
      direction: { type: DataTypes.TEXT, allowNull: false },
      amount: { type: DataTypes.DECIMAL(18, 8), allowNull: false },
      currency: { type: DataTypes.TEXT, allowNull: false },
      entryKind: { type: DataTypes.TEXT, allowNull: false, field: 'entry_kind' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'consumption_ledger_entries',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['transaction_id'] },
        { fields: ['account_id'] },
      ],
    },
  );

  return ConsumptionLedgerEntry;
}
