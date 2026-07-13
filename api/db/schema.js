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
  getLearningCompanyModel,
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
      await getLearningCompanyModel().sync();
      await getLearningArticleModel().sync();
      await ensureLearningArticleColumns();
      await ensureLearningCompanies();
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
    company_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'learning_companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
  });

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS learning_articles_company_idx
    ON learning_articles (company_id, status, updated_at)
  `);
}

const UBER_COMPANY = {
  slug: 'uber',
  name: 'Uber',
  description: 'Uber is a technology platform that helps people move and earn around the world through mobility, food and goods delivery, healthcare transportation, freight booking, and business travel.',
  website: 'https://www.uber.com/',
  logoUrl: 'https://d1a3f4spazzrp4.cloudfront.net/uberex/duc/images/logos/Uber_Logotype_Digital_black.png',
  industry: 'Technology platform · Mobility, delivery, and freight',
  headquarters: '1725 Third Street, San Francisco, CA',
};

async function ensureLearningCompanies() {
  const Company = getLearningCompanyModel();
  const Article = getLearningArticleModel();
  const [uber] = await Company.findOrCreate({ where: { slug: UBER_COMPANY.slug }, defaults: UBER_COMPANY });
  const missingUberDetails = Object.fromEntries(Object.entries(UBER_COMPANY).filter(([key, value]) => key !== 'slug' && value && !uber[key]));
  if (Object.keys(missingUberDetails).length) await uber.update(missingUberDetails);

  const unlinkedArticles = await Article.findAll({
    attributes: ['companyName', 'companyWebsite', 'companyLogoUrl'],
    where: { category: 'companies', companyId: null },
    raw: true,
  });
  for (const article of unlinkedArticles) {
    const name = String(article.companyName || '').trim();
    if (!name) continue;
    const slug = learningCompanySlug(name);
    const [company] = slug === UBER_COMPANY.slug
      ? [uber]
      : await Company.findOrCreate({
        where: { slug },
        defaults: { slug, name, description: '', website: article.companyWebsite || null, logoUrl: article.companyLogoUrl || null },
      });
    await Article.update({ companyId: company.id }, { where: { category: 'companies', companyId: null, companyName: article.companyName } });
  }
}

function learningCompanySlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'company';
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
