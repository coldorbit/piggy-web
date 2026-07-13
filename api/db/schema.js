import { DataTypes } from 'sequelize';
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
import {
  ensureAssessmentColumns,
  ensureAssessmentIndexes,
  ensureBidPageIndexes,
  ensureBidProfileColumns,
  ensureBidProfileStaticResumeColumns,
  ensureCollaborationIndexes,
  ensureConsumptionTransactionSpenderColumns,
  ensureDuplicateKeyColumn,
  ensureForwardedMailboxMessageColumns,
  ensureForwardedMailboxMessageIndexes,
  ensureHiddenJobColumns,
  ensureInterviewIndexes,
  ensureInterviewJourneyColumns,
  ensureJobBidInterviewColumns,
  ensureJobBidProfileScopedUniqueness,
  ensureMarketplaceIndexes,
  ensureProfileShareIndexes,
  ensureScrapedJobNormalizationColumns,
  ensureScrapedJobPublicIdColumn,
  ensureSpamReviewColumns,
  ensureTailoredResumeCvDataColumn,
  ensureTailoredResumeManualColumns,
  ensureTailoredResumeStatusColumns,
  ensureTenantWorkspaceIndexes,
  ensureWebUserDailyBidGoalColumn,
  ensureWebUserEmailColumn,
  ensureWebUserProfileHubAccessColumn,
  ensureWebUserSessionColumns,
  ensureWebUserTimezoneColumn,
  removeDeprecatedBidProfileColumns,
} from './schema/migrations.js';
import { addMissingColumns } from './utils.js';

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
      await ensureLearningArticleColumns();
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

async function ensureLearningArticleColumns() {
  const queryInterface = getSequelize().getQueryInterface();
  const tableName = 'learning_articles';
  const table = await queryInterface.describeTable(tableName);

  await addMissingColumns(queryInterface, tableName, table, {
    excalidraw_data: { type: DataTypes.JSONB, allowNull: true },
    mermaid_script: { type: DataTypes.TEXT, allowNull: true },
    company_website: { type: DataTypes.TEXT, allowNull: true },
    company_logo_url: { type: DataTypes.TEXT, allowNull: true },
  });
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
