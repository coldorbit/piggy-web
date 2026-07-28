import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';
import { addMissingColumns } from '../utils.js';

const AI_ML_CATEGORY_SQL = `
  'ai_ml',
  'ml_engineer',
  'data_scientist',
  'applied_scientist',
  'research_scientist',
  'other_ai_ml'
`;

export async function ensureScrapedJobClassificationColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'scraped_jobs';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    ai_ml_area: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  await queryInterface.sequelize.query(`
    UPDATE scraped_jobs
    SET ai_ml_area = NULL
    WHERE ai_ml_area IS NOT NULL
      AND COALESCE(category, '') NOT IN (${AI_ML_CATEGORY_SQL})
  `);

  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION app_enforce_scraped_job_ai_ml_classification()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.ai_ml_area IS NOT NULL
        AND COALESCE(NEW.category, '') NOT IN (${AI_ML_CATEGORY_SQL})
      THEN
        NEW.ai_ml_area := NULL;
      END IF;
      RETURN NEW;
    END
    $$
  `);
  await queryInterface.sequelize.query(`
    DROP TRIGGER IF EXISTS scraped_jobs_ai_ml_classification_trigger ON scraped_jobs
  `);
  await queryInterface.sequelize.query(`
    CREATE TRIGGER scraped_jobs_ai_ml_classification_trigger
    BEFORE INSERT OR UPDATE OF category, ai_ml_area ON scraped_jobs
    FOR EACH ROW
    EXECUTE FUNCTION app_enforce_scraped_job_ai_ml_classification()
  `);
}
