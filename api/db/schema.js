import { DataTypes } from 'sequelize';
import { getSequelize } from './connection.js';
import {
  getBidProfileModel,
  getJobBidModel,
  getProfileShareRequestModel,
  getScrapedJobModel,
  getTailoredResumeModel,
  getWebUserModel,
  setupWebAssociations,
} from './models/index.js';
import {
  backfillTailoredResumeFilePaths,
  ensureTailoredResumeFilePathNormalizer,
  selectTailoredResumeFilePathRows,
} from './backfills/tailoredResumeFilePaths.js';
import { addMissingColumns, removeExistingColumns } from './utils.js';

let initializationPromise;

export async function ensureWebModels({ runBackfills = true } = {}) {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await getScrapedJobModel().sync();
      await getWebUserModel().sync();
      setupWebAssociations();
      await getBidProfileModel().sync();
      await getProfileShareRequestModel().sync();
      await getJobBidModel().sync();
      await getTailoredResumeModel().sync();
      await ensureWebUserSessionColumns();
      await ensureBidProfileColumns();
      await ensureJobBidInterviewColumns();
      await ensureTailoredResumeStatusColumns();
      if (runBackfills) await runTailoredResumeFilePathBackfill();
      await removeDeprecatedBidProfileColumns();
      await ensureDuplicateKeyColumn();
      await ensureSpamReviewColumns();
      await ensureHiddenJobColumns();
      await ensureBidPageIndexes();
      await ensureProfileShareIndexes();
      await ensureJobBidProfileScopedUniqueness();
    })().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }

  await initializationPromise;
}

async function runTailoredResumeFilePathBackfill() {
  console.log('Running tailored resume file_path backfill.');
  await ensureTailoredResumeFilePathNormalizer();
  console.log(
    'tailored_resumes rows before file_path backfill:',
    JSON.stringify(await selectTailoredResumeFilePathRows(), null, 2),
  );
  const updatedCount = await backfillTailoredResumeFilePaths();
  console.log(`Tailored resume file_path backfill completed; updated ${updatedCount} record${updatedCount === 1 ? '' : 's'}.`);
  console.log(
    'tailored_resumes rows after file_path backfill:',
    JSON.stringify(await selectTailoredResumeFilePathRows(), null, 2),
  );
}

async function ensureProfileShareIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS profile_share_requests_profile_recipient_idx
    ON profile_share_requests (profile_id, recipient_user_id)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS profile_share_requests_recipient_status_idx
    ON profile_share_requests (recipient_user_id, status)
  `);
}

async function ensureJobBidProfileScopedUniqueness() {
  const sequelize = getSequelize();

  await sequelize.query('DROP INDEX IF EXISTS job_bids_profile_id_job_id_unique');
  await sequelize.query('DROP INDEX IF EXISTS job_bids_user_profile_job_unique_idx');
  await sequelize.query(`
    DELETE FROM job_bids loser
    USING job_bids keeper
    WHERE loser.profile_id = keeper.profile_id
      AND loser.job_id = keeper.job_id
      AND loser.id > keeper.id
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS job_bids_profile_id_job_id
    ON job_bids (profile_id, job_id)
  `);
}

async function ensureWebUserSessionColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'web_users';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    active_session_id: { type: DataTypes.TEXT, allowNull: true },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    last_seen_at: { type: DataTypes.DATE, allowNull: true },
  });
}

async function ensureTailoredResumeStatusColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'tailored_resumes';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    last_error: { type: DataTypes.TEXT, allowNull: true },
    dead_letter_at: { type: DataTypes.DATE, allowNull: true },
    downloaded_at: { type: DataTypes.DATE, allowNull: true },
  });

  await queryInterface.sequelize.query(
    `
    UPDATE tailored_resumes
    SET status = 'dead_letter',
        dead_letter_at = COALESCE(dead_letter_at, updated_at, now())
    WHERE status = 'failed'
    `,
  );

  await queryInterface.sequelize.query('DROP INDEX IF EXISTS tailored_resumes_queue_idx');
}

async function ensureBidPageIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS scraped_jobs_scraped_at_desc_idx
    ON scraped_jobs (scraped_at DESC NULLS LAST)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS scraped_jobs_posted_at_desc_idx
    ON scraped_jobs (posted_at DESC NULLS LAST)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS scraped_jobs_source_idx
    ON scraped_jobs (source)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS scraped_jobs_category_idx
    ON scraped_jobs (category)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS scraped_jobs_is_spam_idx
    ON scraped_jobs (is_spam)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS scraped_jobs_is_hidden_idx
    ON scraped_jobs (is_hidden)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS job_bids_profile_job_status_idx
    ON job_bids (profile_id, job_id, status)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS job_bids_profile_status_job_idx
    ON job_bids (profile_id, status, job_id)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS job_bids_profile_status_updated_at_idx
    ON job_bids (profile_id, status, updated_at DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS job_bids_profile_interview_next_at_idx
    ON job_bids (profile_id, status, interview_next_at ASC NULLS LAST)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS job_bids_caller_status_idx
    ON job_bids (caller_user_id, status)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS tailored_resumes_profile_job_status_idx
    ON tailored_resumes (profile_id, job_url, status)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS tailored_resumes_profile_status_job_idx
    ON tailored_resumes (profile_id, status, job_url)
  `);
}

async function ensureJobBidInterviewColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'job_bids';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    caller_user_id: { type: DataTypes.BIGINT, allowNull: true },
    interview_stage: { type: DataTypes.TEXT, allowNull: true },
    interview_next_at: { type: DataTypes.DATE, allowNull: true },
    interview_notes: { type: DataTypes.TEXT, allowNull: true },
  });
}

async function ensureBidProfileColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'bid_profiles';
  const table = await queryInterface.describeTable(tableName);
  const columns = {
    location: { type: DataTypes.TEXT, allowNull: true },
    phone: { type: DataTypes.TEXT, allowNull: true },
    email: { type: DataTypes.TEXT, allowNull: true },
    linkedin: { type: DataTypes.TEXT, allowNull: true },
    years_of_experience: { type: DataTypes.TEXT, allowNull: true },
    resume_text: { type: DataTypes.TEXT, allowNull: true },
    profile_badge: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'SWE' },
    profile_status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'active' },
    closed_reason: { type: DataTypes.TEXT, allowNull: true },
    closed_at: { type: DataTypes.DATE, allowNull: true },
  };

  await addMissingColumns(queryInterface, tableName, table, columns);

  if (table.profile_badges) {
    await queryInterface.sequelize.query(`
      UPDATE bid_profiles
      SET profile_badge = profile_badges->>0
      WHERE profile_badges->>0 IN ('ML', 'DE', 'SWE')
    `);
  }
}

async function removeDeprecatedBidProfileColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'bid_profiles';
  const table = await queryInterface.describeTable(tableName);

  await removeExistingColumns(queryInterface, tableName, table, [
    'headline',
    'hourly_rate',
    'summary',
    'skills',
    'profile_badges',
    'companies',
    'education',
  ]);
}

async function ensureDuplicateKeyColumn() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'scraped_jobs';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    duplicate_key: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });
}

async function ensureSpamReviewColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'scraped_jobs';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    is_spam: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    spam_reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });
}

async function ensureHiddenJobColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'scraped_jobs';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    is_hidden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hidden_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });
}
