import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';
import { addMissingColumns } from '../utils.js';

export async function ensureScrapedJobNormalizationColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'scraped_jobs';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    normalized_company: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    normalized_title: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION app_normalize_job_identity(value TEXT)
    RETURNS TEXT
    LANGUAGE SQL
    IMMUTABLE
    PARALLEL SAFE
    AS $$
      SELECT NULLIF(
        btrim(
          regexp_replace(
            replace(lower(btrim(coalesce(value, ''))), '&', ' and '),
            '[^a-z0-9]+',
            ' ',
            'g'
          )
        ),
        ''
      )
    $$
  `);

  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION app_normalize_job_company(value TEXT)
    RETURNS TEXT
    LANGUAGE SQL
    IMMUTABLE
    PARALLEL SAFE
    AS $$
      SELECT NULLIF(
        btrim(
          regexp_replace(
            coalesce(app_normalize_job_identity(value), ''),
            '\\s+(incorporated|inc|llc|ltd|limited|corp|corporation|company|co)$',
            '',
            'i'
          )
        ),
        ''
      )
    $$
  `);

  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION app_set_scraped_job_identity()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.normalized_company := app_normalize_job_company(NEW.company);
      NEW.normalized_title := app_normalize_job_identity(NEW.title);
      RETURN NEW;
    END
    $$
  `);

  await queryInterface.sequelize.query(`
    DROP TRIGGER IF EXISTS scraped_jobs_normalized_identity_trigger ON scraped_jobs
  `);
  await queryInterface.sequelize.query(`
    CREATE TRIGGER scraped_jobs_normalized_identity_trigger
    BEFORE INSERT OR UPDATE OF company, title ON scraped_jobs
    FOR EACH ROW
    EXECUTE FUNCTION app_set_scraped_job_identity()
  `);

  await queryInterface.sequelize.query(`
    UPDATE scraped_jobs
    SET normalized_company = app_normalize_job_company(company)
    WHERE normalized_company IS NULL
      OR normalized_company = ''
  `);

  await queryInterface.sequelize.query(`
    UPDATE scraped_jobs
    SET normalized_title = app_normalize_job_identity(title)
    WHERE normalized_title IS NULL
      OR normalized_title = ''
  `);

  await queryInterface.sequelize.query(`
    UPDATE scraped_jobs
    SET duplicate_key = CASE
      WHEN NULLIF(regexp_replace(lower(btrim(coalesce(company, ''))), '[^a-z0-9]+', ' ', 'g'), '') IS NOT NULL
       AND NULLIF(regexp_replace(lower(btrim(coalesce(title, ''))), '[^a-z0-9]+', ' ', 'g'), '') IS NOT NULL
      THEN concat_ws(
        '::',
        'job',
        NULLIF(
          btrim(regexp_replace(
            regexp_replace(
              lower(btrim(coalesce(company, ''))),
              '\\m(incorporated|inc|llc|ltd|limited|corp|corporation|company|co)\\M\\.?$',
              '',
              'gi'
            ),
            '[^a-z0-9]+',
            ' ',
            'g'
          )),
          ''
        ),
        NULLIF(regexp_replace(lower(btrim(coalesce(title, ''))), '[^a-z0-9]+', ' ', 'g'), ''),
        COALESCE(NULLIF(regexp_replace(lower(btrim(coalesce(location, ''))), '[^a-z0-9]+', ' ', 'g'), ''), 'unknown location')
      )
      ELSE concat('url::', lower(btrim(coalesce(url, ''))))
    END
    WHERE duplicate_key IS NULL
      OR duplicate_key = ''
      OR duplicate_key = url
  `);
}
