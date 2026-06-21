import { DataTypes } from 'sequelize';

export { getSequelize } from './db/connection.js';
export {
  getBidProfileModel,
  getScrapedJobModel,
  getTailoredResumeModel,
} from './db/models/index.js';

export async function initializeWorkerModels() {
  const { getSequelize } = await import('./db/connection.js');
  const { getBidProfileModel, getScrapedJobModel, getTailoredResumeModel } = await import('./db/models/index.js');

  getBidProfileModel();
  getScrapedJobModel();
  getTailoredResumeModel();
  await getSequelize().authenticate();
  await ensureTailoredResumeManualColumns(getSequelize());
}

async function ensureTailoredResumeManualColumns(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = 'tailored_resumes';
  const table = await queryInterface.describeTable(tableName);
  const columns = {
    request_type: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'job' },
    manual_company: { type: DataTypes.TEXT, allowNull: true },
    manual_role: { type: DataTypes.TEXT, allowNull: true },
    manual_job_description: { type: DataTypes.TEXT, allowNull: true },
    cv_data: { type: DataTypes.JSONB, allowNull: true },
  };

  for (const [column, definition] of Object.entries(columns)) {
    if (!table[column]) await queryInterface.addColumn(tableName, column, definition);
  }

  await sequelize.query(`
    UPDATE tailored_resumes
    SET request_type = 'job'
    WHERE request_type IS NULL OR request_type = ''
  `);
}
