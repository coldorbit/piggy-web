import { DataTypes, QueryTypes } from 'sequelize';
import { getSequelize } from './connection.js';
import {
  getAssessmentModel,
  getBidProfileModel,
  getCollaborationEventModel,
  getConsumptionAccountModel,
  getConsumptionLedgerEntryModel,
  getConsumptionTransactionModel,
  getFaqModel,
  getForwardedMailboxMessageModel,
  getInterviewCallModel,
  getInterviewLogModel,
  getInterviewModel,
  getJobBidModel,
  getLearningArticleModel,
  getMarketplaceCallerProfileModel,
  getMarketplaceInterviewOpportunityModel,
  getMarketplaceMatchModel,
  getMarketplaceParticipantModel,
  getProfileShareRequestModel,
  getProfileIntelligenceModel,
  getProfilePrepPlanModel,
  getProfileStoryModel,
  getScrapedJobModel,
  getTailoredResumeModel,
  getTeamConsumptionModel,
  getUserWorkspaceMembershipModel,
  getWebUserModel,
  getWorkspaceModel,
  setupWebAssociations,
} from './models/index.js';
import { addMissingColumns, removeExistingColumns } from './utils.js';

let initializationPromise;

export async function ensureWebModels() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await getScrapedJobModel().sync();
      await getWorkspaceModel().sync();
      await getWebUserModel().sync();
      setupWebAssociations();
      await getUserWorkspaceMembershipModel().sync();
      await getFaqModel().sync();
      await getLearningArticleModel().sync();
      await getBidProfileModel().sync();
      await getProfileIntelligenceModel().sync();
      await getProfilePrepPlanModel().sync();
      await getProfileStoryModel().sync();
      await getCollaborationEventModel().sync();
      await getProfileShareRequestModel().sync();
      await getForwardedMailboxMessageModel().sync();
      await getAssessmentModel().sync();
      await ensureAssessmentColumns();
      await getJobBidModel().sync();
      await getInterviewModel().sync();
      await getInterviewCallModel().sync();
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
      await ensureWebUserProfileHubAccessColumn();
      await ensureBidProfileColumns();
      await ensureBidProfileStaticResumeColumns();
      await ensureJobBidInterviewColumns();
      await ensureInterviewJourneyColumns();
      await ensureTailoredResumeStatusColumns();
      await ensureTailoredResumeManualColumns();
      await ensureTailoredResumeCvDataColumn();
      await ensureConsumptionTransactionSpenderColumns();
      await ensureWebUserEmailColumn();
      await ensureWebUserDailyBidGoalColumn();
      await ensureWebUserTimezoneColumn();
      await ensureWebUserWorkspaceColumn();
      await ensureTenantWorkspaceColumns();
      await ensureForwardedMailboxMessageColumns();
      await removeDeprecatedBidProfileColumns();
      await ensureDuplicateKeyColumn();
      await ensureScrapedJobNormalizationColumns();
      await ensureSpamReviewColumns();
      await ensureHiddenJobColumns();
      await ensureScrapedJobPublicIdColumn();
      await ensureTenantWorkspaceIndexes();
      await ensureBidPageIndexes();
      await ensureCollaborationIndexes();
      await ensureProfileShareIndexes();
      await ensureForwardedMailboxMessageIndexes();
      await ensureJobBidProfileScopedUniqueness();
      await ensureInterviewIndexes();
      await ensureAssessmentIndexes();
      await ensureMarketplaceIndexes();
      await ensureWorkspaceIndexes();
      await ensureUserWorkspaceMembershipIndexes();
    })().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }

  await initializationPromise;
}

async function ensureUserWorkspaceMembershipIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_workspace_memberships_user_workspace_unique
    ON user_workspace_memberships (user_id, workspace_id)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS user_workspace_memberships_workspace_status_idx
    ON user_workspace_memberships (workspace_id, status)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS user_workspace_memberships_user_status_idx
    ON user_workspace_memberships (user_id, status)
  `);
}

export const DEFAULT_WORKSPACE_SLUG = 'default';
export const DEFAULT_WORKSPACE_NAME = 'ApplyPilot';

export async function ensureDefaultWorkspace() {
  const Workspace = getWorkspaceModel();
  const [workspace] = await Workspace.findOrCreate({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    defaults: { name: DEFAULT_WORKSPACE_NAME },
  });
  return workspace;
}

async function ensureWebUserWorkspaceColumn() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'web_users';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    workspace_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'workspaces', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
  });

  const workspace = await ensureDefaultWorkspace();
  await queryInterface.sequelize.query(
    `
      UPDATE web_users
      SET workspace_id = :workspaceId
      WHERE workspace_id IS NULL
    `,
    { replacements: { workspaceId: workspace.id } },
  );
}

async function ensureWorkspaceIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_unique
    ON workspaces (slug)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS web_users_workspace_role_idx
    ON web_users (workspace_id, role)
  `);
}

async function ensureTenantWorkspaceColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const defaultWorkspace = await ensureDefaultWorkspace();

  await ensureTenantWorkspaceColumn(queryInterface, 'bid_profiles');
  await queryInterface.sequelize.query(
    `
      UPDATE bid_profiles
      SET workspace_id = COALESCE(web_users.workspace_id, :workspaceId)
      FROM web_users
      WHERE bid_profiles.user_id = web_users.id
        AND bid_profiles.workspace_id IS NULL
    `,
    { replacements: { workspaceId: defaultWorkspace.id } },
  );
  await queryInterface.sequelize.query(
    `
      UPDATE bid_profiles
      SET workspace_id = :workspaceId
      WHERE workspace_id IS NULL
    `,
    { replacements: { workspaceId: defaultWorkspace.id } },
  );
}

async function ensureTenantWorkspaceColumn(queryInterface, tableName) {
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    workspace_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'workspaces', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
  });
}

async function ensureBidProfileStaticResumeColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'bid_profiles';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    is_static: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    static_resume_data: { type: DataTypes.BLOB('long'), allowNull: true },
    static_resume_filename: { type: DataTypes.TEXT, allowNull: true },
    static_resume_content_type: { type: DataTypes.TEXT, allowNull: true },
    static_resume_uploaded_at: { type: DataTypes.DATE, allowNull: true },
  });
}

async function ensureTenantWorkspaceIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS bid_profiles_workspace_user_idx
    ON bid_profiles (workspace_id, user_id)
  `);
  await sequelize.query('DROP INDEX IF EXISTS scraped_jobs_workspace_scraped_at_idx');
  await sequelize.query('DROP INDEX IF EXISTS scraped_jobs_workspace_url_unique');
  await sequelize.query('DROP INDEX IF EXISTS scraped_jobs_workspace_duplicate_key_idx');
  await sequelize.query('ALTER TABLE scraped_jobs DROP CONSTRAINT IF EXISTS scraped_jobs_url_key');
  await ensureMd5TextIndex('scraped_jobs_url_unique', 'scraped_jobs', 'url', { unique: true });
}

async function ensureMd5TextIndex(indexName, tableName, columnName, { unique = false, where = null } = {}) {
  await ensureExpressionIndex({
    indexName,
    tableName,
    expectedExpression: `md5(${columnName})`,
    createSql: `
      CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${indexName}
      ON ${tableName} ((md5(${columnName})))${where ? `\n      WHERE ${where}` : ''}
    `,
  });
}

async function ensureExpressionIndex({ indexName, tableName, expectedExpression, createSql }) {
  const sequelize = getSequelize();
  const [{ currentSchema }] = await sequelize.query('SELECT current_schema() AS "currentSchema"', {
    type: QueryTypes.SELECT,
  });
  const [index] = await sequelize.query(
    `
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = :schema
        AND tablename = :tableName
        AND indexname = :indexName
    `,
    {
      replacements: { schema: currentSchema, tableName, indexName },
      type: QueryTypes.SELECT,
    },
  );

  if (index && !index.indexdef.includes(expectedExpression)) {
    await sequelize.query(`DROP INDEX IF EXISTS ${indexName}`);
  }

  await sequelize.query(createSql);
}

async function ensureAssessmentIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS assessments_profile_expires_at_idx
    ON assessments (profile_id, expires_at ASC NULLS LAST)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS assessments_profile_created_at_idx
    ON assessments (profile_id, created_at DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS assessments_profile_category_idx
    ON assessments (profile_id, category)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS assessments_user_created_at_idx
    ON assessments (user_id, created_at DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS assessments_profile_completed_at_idx
    ON assessments (profile_id, completed_at DESC NULLS LAST)
  `);
}

async function ensureAssessmentColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'assessments';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    completed_at: { type: DataTypes.DATE, allowNull: true },
  });
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

async function ensureWebUserDailyBidGoalColumn() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'web_users';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    daily_bid_goal: { type: DataTypes.INTEGER, allowNull: true },
  });

  await queryInterface.sequelize.query(`
    UPDATE web_users
    SET daily_bid_goal = CASE
      WHEN role IN ('bidder', 'readonly_bidder', 'editable_bidder') THEN 50
      WHEN role = 'user' THEN 100
      ELSE NULL
    END
    WHERE daily_bid_goal IS NULL
      AND role IN ('bidder', 'readonly_bidder', 'editable_bidder', 'user')
  `);
  await queryInterface.sequelize.query(`
    UPDATE web_users
    SET daily_bid_goal = NULL
    WHERE role IN ('superadmin', 'admin')
      AND daily_bid_goal IS NOT NULL
  `);
}

async function ensureWebUserProfileHubAccessColumn() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'web_users';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    profile_hub_access: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  });

  await queryInterface.sequelize.query(`
    UPDATE web_users
    SET profile_hub_access = false
    WHERE profile_hub_access IS NULL
  `);
}

async function ensureWebUserTimezoneColumn() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'web_users';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    timezone: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'America/New_York' },
  });

  await queryInterface.sequelize.query(`
    UPDATE web_users
    SET timezone = 'America/New_York'
    WHERE timezone IS NULL OR trim(timezone) = ''
  `);
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
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interview_calls_interview_scheduled_at_idx
    ON interview_calls (interview_id, scheduled_at)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interview_calls_caller_scheduled_at_idx
    ON interview_calls (caller_user_id, scheduled_at)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS interview_calls_scheduled_at_idx
    ON interview_calls (scheduled_at)
  `);
  await sequelize.query(`
    DELETE FROM interview_calls loser
    USING interview_calls keeper
    WHERE loser.interview_id = keeper.interview_id
      AND loser.interview_stage = keeper.interview_stage
      AND (
        loser.updated_at < keeper.updated_at
        OR (loser.updated_at = keeper.updated_at AND loser.id < keeper.id)
      )
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS interview_calls_interview_stage_unique
    ON interview_calls (interview_id, interview_stage)
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS interview_calls_source_key_unique
    ON interview_calls (source_key)
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

async function ensureForwardedMailboxMessageIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS forwarded_mailbox_messages_message_id_unique
    ON forwarded_mailbox_messages (message_id)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS forwarded_mailbox_messages_profile_received_idx
    ON forwarded_mailbox_messages (profile_id, received_at DESC NULLS LAST, id DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS forwarded_mailbox_messages_profile_unread_idx
    ON forwarded_mailbox_messages (profile_id, is_read, received_at DESC NULLS LAST)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS forwarded_mailbox_messages_match_received_idx
    ON forwarded_mailbox_messages (match_value, received_at DESC NULLS LAST, id DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS forwarded_mailbox_messages_match_unread_idx
    ON forwarded_mailbox_messages (match_value, is_read, received_at DESC NULLS LAST)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS forwarded_mailbox_messages_unread_received_idx
    ON forwarded_mailbox_messages (is_read, received_at DESC NULLS LAST)
  `);
}

async function ensureForwardedMailboxMessageColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'forwarded_mailbox_messages';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    calendar_event: { type: DataTypes.JSONB, allowNull: true },
  });
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

async function ensureTailoredResumeCvDataColumn() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'tailored_resumes';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    cv_data: { type: DataTypes.JSONB, allowNull: true },
  });
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
  await ensureMd5TextIndex('scraped_jobs_duplicate_key_idx', 'scraped_jobs', 'duplicate_key', {
    where: 'duplicate_key IS NOT NULL',
  });
  await ensureMd5TextIndex('scraped_jobs_normalized_company_idx', 'scraped_jobs', 'normalized_company', {
    where: 'normalized_company IS NOT NULL',
  });
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
    CREATE INDEX IF NOT EXISTS job_bids_profile_user_bid_at_idx
    ON job_bids (profile_id, user_id, bid_at DESC)
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
  await sequelize.query('DROP INDEX IF EXISTS tailored_resumes_job_url');
  await sequelize.query('DROP INDEX IF EXISTS tailored_resumes_job_url_idx');
  await ensureExpressionIndex({
    indexName: 'tailored_resumes_profile_job_status_idx',
    tableName: 'tailored_resumes',
    expectedExpression: 'md5(job_url)',
    createSql: `
      CREATE INDEX IF NOT EXISTS tailored_resumes_profile_job_status_idx
      ON tailored_resumes (profile_id, (md5(job_url)), status)
    `,
  });
  await ensureExpressionIndex({
    indexName: 'tailored_resumes_profile_status_job_idx',
    tableName: 'tailored_resumes',
    expectedExpression: 'md5(job_url)',
    createSql: `
      CREATE INDEX IF NOT EXISTS tailored_resumes_profile_status_job_idx
      ON tailored_resumes (profile_id, status, (md5(job_url)))
    `,
  });
  await ensureMd5TextIndex('tailored_resumes_job_url_hash_idx', 'tailored_resumes', 'job_url');
}

async function ensureCollaborationIndexes() {
  const sequelize = getSequelize();

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS collaboration_events_entity_created_idx
    ON collaboration_events (entity_type, entity_id, created_at DESC)
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS collaboration_events_profile_created_idx
    ON collaboration_events (profile_id, created_at DESC)
    WHERE profile_id IS NOT NULL
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS collaboration_events_assignee_open_idx
    ON collaboration_events (assigned_to_user_id, resolved_at)
    WHERE assigned_to_user_id IS NOT NULL
  `);
}

async function ensureJobBidInterviewColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'job_bids';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    caller_user_id: { type: DataTypes.BIGINT, allowNull: true },
    interview_stage: { type: DataTypes.TEXT, allowNull: true },
    interview_at: { type: DataTypes.DATE, allowNull: true },
    interview_next_at: { type: DataTypes.DATE, allowNull: true },
    interview_duration_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    interview_notes: { type: DataTypes.TEXT, allowNull: true },
    stage_meeting_links: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  });
  await queryInterface.sequelize.query(`
    UPDATE job_bids
    SET interview_at = COALESCE(updated_at, bid_at, created_at)
    WHERE status = 'interviewing'
      AND interview_at IS NULL
  `);
}

async function ensureBidProfileColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'bid_profiles';
  const table = await queryInterface.describeTable(tableName);
  const columns = {
    location: { type: DataTypes.TEXT, allowNull: true },
    phone: { type: DataTypes.TEXT, allowNull: true },
    email: { type: DataTypes.TEXT, allowNull: true },
    forwarding_email: { type: DataTypes.TEXT, allowNull: true },
    linkedin: { type: DataTypes.TEXT, allowNull: true },
    years_of_experience: { type: DataTypes.TEXT, allowNull: true },
    resume_text: { type: DataTypes.TEXT, allowNull: true },
    resume_template: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'classic' },
    profile_badge: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'SWE' },
    profile_status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'active' },
    daily_bid_goal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    closed_reason: { type: DataTypes.TEXT, allowNull: true },
    closed_at: { type: DataTypes.DATE, allowNull: true },
  };

  await addMissingColumns(queryInterface, tableName, table, columns);
  await queryInterface.sequelize.query(`
    UPDATE bid_profiles
    SET daily_bid_goal = 60
    WHERE daily_bid_goal IS NULL
  `);
  await queryInterface.sequelize.query(`
    ALTER TABLE bid_profiles
    ALTER COLUMN daily_bid_goal SET DEFAULT 60
  `);
  await queryInterface.sequelize.query(`
    ALTER TABLE bid_profiles
    ALTER COLUMN daily_bid_goal SET NOT NULL
  `);

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

async function ensureScrapedJobNormalizationColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'scraped_jobs';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    normalized_company: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  await queryInterface.sequelize.query(`
    UPDATE scraped_jobs
    SET normalized_company = NULLIF(btrim(
      regexp_replace(
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
    )
    WHERE normalized_company IS NULL
      OR normalized_company = ''
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

async function ensureScrapedJobPublicIdColumn() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'scraped_jobs';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    public_job_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION scraped_job_public_id_from_id(row_id bigint)
    RETURNS text AS $$
    DECLARE
      alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      value numeric := row_id;
      result text := '';
      remainder integer;
    BEGIN
      IF row_id IS NULL OR row_id < 0 THEN
        RETURN NULL;
      END IF;

      IF row_id >= 78364164096 THEN
        RAISE EXCEPTION 'scraped_jobs.id % is too large for an 8-character public job id', row_id;
      END IF;

      IF value = 0 THEN
        result := '0';
      END IF;

      WHILE value > 0 LOOP
        remainder := mod(value, 36)::integer;
        result := substr(alphabet, remainder + 1, 1) || result;
        value := floor(value / 36);
      END LOOP;

      RETURN 'J' || lpad(result, 7, '0');
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `);

  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION set_scraped_job_public_id()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.public_job_id IS NULL OR btrim(NEW.public_job_id) = '' THEN
        NEW.public_job_id := scraped_job_public_id_from_id(NEW.id);
      ELSE
        NEW.public_job_id := upper(btrim(NEW.public_job_id));
      END IF;

      IF NEW.public_job_id !~ '^[A-Z0-9]{8}$' THEN
        RAISE EXCEPTION 'scraped_jobs.public_job_id must be exactly 8 alphanumeric characters';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS scraped_jobs_public_job_id_set ON scraped_jobs');
  await queryInterface.sequelize.query(`
    CREATE TRIGGER scraped_jobs_public_job_id_set
    BEFORE INSERT OR UPDATE OF public_job_id ON scraped_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_scraped_job_public_id()
  `);
  await queryInterface.sequelize.query(`
    UPDATE scraped_jobs
    SET public_job_id = scraped_job_public_id_from_id(id)
    WHERE public_job_id IS NULL OR public_job_id = ''
  `);
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS scraped_jobs_public_job_id_unique
    ON scraped_jobs (public_job_id)
  `);
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'scraped_jobs_public_job_id_format'
      ) THEN
        ALTER TABLE scraped_jobs
        ADD CONSTRAINT scraped_jobs_public_job_id_format
        CHECK (public_job_id ~ '^[A-Z0-9]{8}$');
      END IF;
    END;
    $$;
  `);
  await queryInterface.sequelize.query('ALTER TABLE scraped_jobs ALTER COLUMN public_job_id SET NOT NULL');
}
