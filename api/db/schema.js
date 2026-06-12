import { DataTypes } from 'sequelize';
import { getSequelize } from './connection.js';
import {
  getBidProfileModel,
  getConsumptionAccountModel,
  getConsumptionLedgerEntryModel,
  getConsumptionTransactionModel,
  getFaqModel,
  getInterviewLogModel,
  getInterviewModel,
  getJobBidModel,
  getMarketplaceCallerProfileModel,
  getMarketplaceInterviewOpportunityModel,
  getMarketplaceMatchModel,
  getMarketplaceParticipantModel,
  getProfileShareRequestModel,
  getScrapedJobModel,
  getTailoredResumeModel,
  getTeamConsumptionModel,
  getWebUserModel,
  setupWebAssociations,
} from './models/index.js';
import { addMissingColumns, removeExistingColumns } from './utils.js';

let initializationPromise;

export async function ensureWebModels() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await getScrapedJobModel().sync();
      await getWebUserModel().sync();
      setupWebAssociations();
      await getFaqModel().sync();
      await getBidProfileModel().sync();
      await getProfileShareRequestModel().sync();
      await getJobBidModel().sync();
      await getInterviewModel().sync();
      await getInterviewLogModel().sync();
      await getTailoredResumeModel().sync();
      await getMarketplaceParticipantModel().sync();
      await getMarketplaceInterviewOpportunityModel().sync();
      await getMarketplaceCallerProfileModel().sync();
      await getMarketplaceMatchModel().sync();
      await getTeamConsumptionModel().sync();
      await getConsumptionAccountModel().sync();
      await getConsumptionTransactionModel().sync();
      await getConsumptionLedgerEntryModel().sync();
      await ensureWebUserSessionColumns();
      await ensureBidProfileColumns();
      await ensureJobBidInterviewColumns();
      await ensureInterviewJourneyColumns();
      await ensureTailoredResumeStatusColumns();
      await ensureTailoredResumeManualColumns();
      await ensureConsumptionTransactionSpenderColumns();
      await ensureWebUserEmailColumn();
      await removeDeprecatedBidProfileColumns();
      await ensureDuplicateKeyColumn();
      await ensureSpamReviewColumns();
      await ensureHiddenJobColumns();
      await backfillManualJobSources();
      await ensureBidPageIndexes();
      await ensureProfileShareIndexes();
      await ensureJobBidProfileScopedUniqueness();
      await ensureInterviewIndexes();
      await ensureMarketplaceIndexes();
      await backfillInterviewsFromJobBids();
      await backfillInterviewStageNotes();
    })().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }

  await initializationPromise;
}

async function ensureMarketplaceIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS marketplace_participants_user_id_unique
    ON marketplace_participants (user_id)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS marketplace_interviews_owner_review_idx
    ON marketplace_interview_opportunities (owner_user_id, review_status, match_status)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS marketplace_callers_owner_review_idx
    ON marketplace_caller_profiles (owner_user_id, review_status, availability_status)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS marketplace_matches_status_scheduled_idx
    ON marketplace_matches (status, scheduled_at ASC NULLS LAST)
  `);
}

async function backfillManualJobSources() {
  const sequelize = getSequelize();

  await sequelize.query(`
    UPDATE scraped_jobs
    SET source = 'Manual',
        source_url = NULL,
        raw_job = COALESCE(raw_job, '{}'::jsonb)
          - 'source'
          - 'sourceurl'
          - 'source_url'
          - 'source url'
    WHERE raw_job->>'importType' = 'manual'
       OR raw_job->>'isManualImport' = 'true'
  `);
}

async function ensureInterviewJourneyColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'interviews';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    first_interview_scheduled_at: { type: DataTypes.DATE, allowNull: true },
    interview_duration_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    stage_notes: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    stage_meeting_links: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  });
}

async function ensureInterviewIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS interviews_job_bid_id_unique
    ON interviews (job_bid_id)
    WHERE job_bid_id IS NOT NULL
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interviews_profile_status_next_at_idx
    ON interviews (profile_id, status, interview_next_at ASC NULLS LAST)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interviews_caller_status_idx
    ON interviews (caller_user_id, status)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interview_logs_interview_created_at_idx
    ON interview_logs (interview_id, created_at)
  `);
}

async function backfillInterviewsFromJobBids() {
  const sequelize = getSequelize();

  await sequelize.query(`
    INSERT INTO interviews (
      user_id,
      caller_user_id,
      profile_id,
      job_id,
      job_bid_id,
      title,
      company,
      location,
      job_url,
      status,
      interview_stage,
      interview_next_at,
      interview_duration_minutes,
      interview_notes,
      stage_meeting_links,
      created_at,
      updated_at
    )
    SELECT
      job_bids.user_id,
      job_bids.caller_user_id,
      job_bids.profile_id,
      job_bids.job_id,
      job_bids.id,
      COALESCE(NULLIF(scraped_jobs.title, ''), 'Untitled role'),
      COALESCE(NULLIF(scraped_jobs.company, ''), 'Unknown company'),
      scraped_jobs.location,
      scraped_jobs.url,
      job_bids.status,
      COALESCE(NULLIF(job_bids.interview_stage, ''), 'todo'),
      job_bids.interview_next_at,
      COALESCE(job_bids.interview_duration_minutes, 60),
      job_bids.interview_notes,
      COALESCE(job_bids.stage_meeting_links, '{}'::jsonb),
      job_bids.created_at,
      job_bids.updated_at
    FROM job_bids
    JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
    WHERE job_bids.status IN ('interviewing', 'won', 'lost')
    ON CONFLICT (job_bid_id) WHERE job_bid_id IS NOT NULL DO NOTHING
  `);
}

async function backfillInterviewStageNotes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    UPDATE interviews
    SET stage_notes = jsonb_build_object(COALESCE(NULLIF(interview_stage, ''), 'todo'), interview_notes)
    WHERE COALESCE(stage_notes, '{}'::jsonb) = '{}'::jsonb
      AND NULLIF(interview_notes, '') IS NOT NULL
  `);
  await sequelize.query(`
    UPDATE interviews
    SET first_interview_scheduled_at = interview_next_at
    WHERE first_interview_scheduled_at IS NULL
      AND interview_next_at IS NOT NULL
  `);
  await sequelize.query(`
    INSERT INTO interview_logs (
      interview_id,
      user_id,
      event_type,
      from_value,
      to_value,
      metadata,
      created_at,
      updated_at
    )
    SELECT
      interviews.id,
      interviews.user_id,
      'created',
      NULL,
      interviews.interview_stage,
      jsonb_build_object('backfilled', true),
      interviews.created_at,
      interviews.created_at
    FROM interviews
    WHERE NOT EXISTS (
      SELECT 1
      FROM interview_logs
      WHERE interview_logs.interview_id = interviews.id
        AND interview_logs.event_type = 'created'
    )
  `);
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

async function ensureWebUserEmailColumn() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'web_users';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    email: { type: DataTypes.TEXT, allowNull: true },
  });

  await queryInterface.sequelize.query(`
    UPDATE web_users
    SET email = lower(username)
    WHERE email IS NULL
      AND username LIKE '%@%'
  `);
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS web_users_email_unique
    ON web_users (lower(email))
    WHERE email IS NOT NULL
  `);
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

async function ensureTailoredResumeManualColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'tailored_resumes';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    request_type: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'job' },
    manual_company: { type: DataTypes.TEXT, allowNull: true },
    manual_role: { type: DataTypes.TEXT, allowNull: true },
    manual_job_description: { type: DataTypes.TEXT, allowNull: true },
  });

  await queryInterface.sequelize.query(`
    UPDATE tailored_resumes
    SET request_type = 'job'
    WHERE request_type IS NULL OR request_type = ''
  `);
}

async function ensureConsumptionTransactionSpenderColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'consumption_transactions';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    spent_by_type: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'team' },
    spent_by_user_id: { type: DataTypes.BIGINT, allowNull: true },
  });

  await queryInterface.sequelize.query(`
    UPDATE consumption_transactions
    SET spent_by_type = 'team'
    WHERE spent_by_type IS NULL OR spent_by_type = ''
  `);
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS consumption_transactions_spent_by_idx
    ON consumption_transactions (spent_by_type, spent_by_user_id)
  `);
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
    CREATE INDEX IF NOT EXISTS job_bids_bid_at_idx
    ON job_bids (bid_at DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS job_bids_user_bid_at_idx
    ON job_bids (user_id, bid_at DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interviews_created_at_idx
    ON interviews (created_at DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interviews_updated_at_idx
    ON interviews (updated_at DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interviews_user_updated_at_idx
    ON interviews (user_id, updated_at DESC)
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
    interview_duration_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    interview_notes: { type: DataTypes.TEXT, allowNull: true },
    stage_meeting_links: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
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
    resume_template: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'classic' },
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
