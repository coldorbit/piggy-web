import 'dotenv/config';
import { Op, QueryTypes } from 'sequelize';
import {
  getBidProfileModel,
  getJobProfileScoreModel,
  getProfileIntelligenceModel,
  getScrapedJobModel,
} from '../db/models/index.js';
import { getSequelize } from '../db/connection.js';
import { ensureWebModels } from '../db/schema.js';
import {
  buildProfileContext,
  JOB_PROFILE_RANKING_MODEL_VERSION,
  scoreJobForProfile,
} from '../server/modules/bidding/application/jobProfileRankingService.js';

function parseArgs(argv) {
  const options = { batchSize: 500, dryRun: false, profileId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') continue;
    if (token === '--dry-run') options.dryRun = true;
    else if (token === '--batch-size') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 5000) {
        throw new Error('--batch-size must be an integer from 1 to 5000');
      }
      options.batchSize = value;
      index += 1;
    } else if (token === '--profile-id') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--profile-id must be a positive integer');
      options.profileId = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  return options;
}

async function scorePairs(options) {
  const sequelize = getSequelize();
  const profileClause = options.profileId ? 'WHERE profile_id = :profileId' : '';
  const pairs = await sequelize.query(
    `
      SELECT DISTINCT profile_id AS "profileId", job_id AS "jobId"
      FROM (
        SELECT profile_id, job_id FROM job_profile_scores
        UNION
        SELECT profile_id, job_id FROM ranking_impressions
      ) ranking_pairs
      ${profileClause}
      ORDER BY profile_id, job_id
    `,
    { replacements: { profileId: options.profileId }, type: QueryTypes.SELECT },
  );
  const summary = { pairsFound: pairs.length, scored: 0, skipped: 0, dryRun: options.dryRun, modelVersion: JOB_PROFILE_RANKING_MODEL_VERSION };

  for (let offset = 0; offset < pairs.length; offset += options.batchSize) {
    const batch = pairs.slice(offset, offset + options.batchSize);
    const profileIds = [...new Set(batch.map((pair) => pair.profileId))];
    const jobIds = [...new Set(batch.map((pair) => pair.jobId))];
    const [profiles, intelligenceRows, jobs] = await Promise.all([
      getBidProfileModel().findAll({ where: { id: { [Op.in]: profileIds } } }),
      getProfileIntelligenceModel().findAll({ where: { profileId: { [Op.in]: profileIds } } }),
      getScrapedJobModel().findAll({ where: { id: { [Op.in]: jobIds } } }),
    ]);
    const profilesById = new Map(profiles.map((row) => [String(row.id), row]));
    const intelligenceByProfileId = new Map(intelligenceRows.map((row) => [String(row.profileId), row]));
    const jobsById = new Map(jobs.map((row) => [String(row.id), row]));
    const contextByProfileId = new Map();
    const records = [];

    for (const pair of batch) {
      const profile = profilesById.get(String(pair.profileId));
      const job = jobsById.get(String(pair.jobId));
      if (!profile || !job) {
        summary.skipped += 1;
        continue;
      }
      let profileContext = contextByProfileId.get(String(profile.id));
      if (!profileContext) {
        profileContext = buildProfileContext(profile, intelligenceByProfileId.get(String(profile.id)) || null);
        contextByProfileId.set(String(profile.id), profileContext);
      }
      const match = scoreJobForProfile({ profileContext, job });
      records.push({
        profileId: profile.id,
        jobId: job.id,
        modelVersion: match.modelVersion,
        score: match.score,
        components: match.components,
        reasons: match.reasons,
        profileFingerprint: match.profileFingerprint,
        jobFingerprint: match.jobFingerprint,
        scoredAt: new Date(match.scoredAt),
      });
    }

    if (!options.dryRun && records.length) {
      await getJobProfileScoreModel().bulkCreate(records, {
        updateOnDuplicate: ['score', 'components', 'reasons', 'profileFingerprint', 'jobFingerprint', 'scoredAt', 'updatedAt'],
      });
    }
    summary.scored += records.length;
  }
  return summary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    await ensureWebModels();
    const summary = await scorePairs(options);
    console.log(`Job-profile score recalculation complete: ${JSON.stringify(summary)}`);
  } finally {
    await getSequelize().close();
  }
}

main().catch((error) => {
  console.error(`Job-profile score recalculation failed: ${error.message}`);
  process.exitCode = 1;
});
