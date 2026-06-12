import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

let TeamConsumption;

export function getTeamConsumptionModel() {
  if (TeamConsumption) return TeamConsumption;

  TeamConsumption = getSequelize().define(
    'TeamConsumption',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      amount: {
        type: DataTypes.DECIMAL(18, 8),
        allowNull: false,
      },
      currency: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      channel: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'other',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      spentAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'spent_at',
      },
      createdByUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'created_by_user_id',
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
      tableName: 'team_consumption',
      underscored: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['spent_at'] },
        { fields: ['currency', 'spent_at'] },
        { fields: ['channel', 'spent_at'] },
      ],
    },
  );

  return TeamConsumption;
}
