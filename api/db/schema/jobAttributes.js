import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';
import { addMissingColumns } from '../utils.js';

export async function ensureScrapedJobAttributeColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'scraped_jobs';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    seniority: { type: DataTypes.TEXT, allowNull: true },
    work_mode: { type: DataTypes.TEXT, allowNull: true },
  });
}
