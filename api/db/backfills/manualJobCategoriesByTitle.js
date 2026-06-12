import { QueryTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

export const MANUAL_JOB_CATEGORY_SAMPLE_LIMIT = 25;

export async function backfillManualJobCategoriesByTitle({
  apply = true,
  onlySoftware = true,
  log = false,
  sampleLimit = MANUAL_JOB_CATEGORY_SAMPLE_LIMIT,
} = {}) {
  const sequelize = getSequelize();
  const manualJobs = await selectManualJobs(sequelize);
  const candidates = manualJobs
    .map((job) => ({ ...job, inferredCategory: inferCategoryFromTitle(job.title) }))
    .filter((job) => job.inferredCategory)
    .filter((job) => !onlySoftware || !job.category || job.category === 'software')
    .filter((job) => job.inferredCategory !== job.category);

  const summary = buildSummary({ manualJobs, candidates, apply, onlySoftware, sampleLimit });
  if (log) printManualJobCategorySummary(summary);
  if (apply && candidates.length) await applyCategoryUpdates(sequelize, candidates);

  return summary;
}

export async function selectManualJobs(sequelize = getSequelize()) {
  return sequelize.query(
    `
    SELECT id, title, company, category, url
    FROM scraped_jobs
    WHERE raw_job->>'importType' = 'manual'
       OR raw_job->>'isManualImport' = 'true'
    ORDER BY id ASC
    `,
    { type: QueryTypes.SELECT },
  );
}

export function inferCategoryFromTitle(title) {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return '';

  if (matchesAny(normalizedTitle, AI_ML_TITLE_PATTERNS)) return 'ai_ml';
  if (matchesAny(normalizedTitle, DATA_TITLE_PATTERNS)) return 'data';
  if (matchesAny(normalizedTitle, SOFTWARE_TITLE_PATTERNS)) return 'software';
  return '';
}

export function buildSummary({ manualJobs, candidates, apply, onlySoftware, sampleLimit = MANUAL_JOB_CATEGORY_SAMPLE_LIMIT }) {
  return {
    apply,
    onlySoftware,
    scanned: manualJobs.length,
    candidateCount: candidates.length,
    currentCategoryCounts: countBy(manualJobs, (job) => job.category || '<null>'),
    candidateChangeCounts: countBy(candidates, (job) => `${job.category || '<null>'} -> ${job.inferredCategory}`),
    sample: candidates.slice(0, sampleLimit).map((job) => ({
      id: job.id,
      current: job.category || '<null>',
      next: job.inferredCategory,
      title: job.title,
      company: job.company,
    })),
  };
}

export function printManualJobCategorySummary(summary) {
  console.log(`Manual job category backfill mode: ${summary.apply ? 'apply' : 'dry-run'}`);
  console.log(`Scope: manual jobs${summary.onlySoftware ? ' currently software/null only' : ''}`);
  console.log(`Manual jobs scanned: ${summary.scanned}`);
  console.log(`Candidate updates: ${summary.candidateCount}`);
  console.log('Current category counts:', JSON.stringify(summary.currentCategoryCounts, null, 2));
  console.log('Candidate change counts:', JSON.stringify(summary.candidateChangeCounts, null, 2));
  if (summary.sample.length) {
    console.log('Sample changes:');
    console.table(summary.sample);
  }
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[/_+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

const AI_ML_TITLE_PATTERNS = [
  /\b(ai|ml)\b/,
  /\bmachine learning\b/,
  /\bartificial intelligence\b/,
  /\bdeep learning\b/,
  /\bgenerative ai\b/,
  /\bgenai\b/,
  /\bllm(s)?\b/,
  /\blarge language model(s)?\b/,
  /\bnlp\b/,
  /\bnatural language processing\b/,
  /\bcomputer vision\b/,
  /\bmlops\b/,
  /\bmodeling engineer\b/,
  /\bmodel engineer\b/,
  /\bdata scientist\b/,
  /\bapplied scientist\b/,
  /\bresearch scientist\b/,
  /\bprompt engineer\b/,
];

const DATA_TITLE_PATTERNS = [
  /\bdata engineer\b/,
  /\banalytics engineer\b/,
  /\bdata analyst\b/,
  /\banalyst\b/,
  /\bbusiness intelligence\b/,
  /\bbi engineer\b/,
  /\betl\b/,
  /\belt\b/,
  /\bdata platform\b/,
  /\bdata warehouse\b/,
  /\bdata architect\b/,
  /\bbig data\b/,
  /\bdatabase engineer\b/,
];

const SOFTWARE_TITLE_PATTERNS = [
  /\bsoftware engineer\b/,
  /\bsoftware developer\b/,
  /\bbackend\b/,
  /\bback end\b/,
  /\bfrontend\b/,
  /\bfront end\b/,
  /\bfull stack\b/,
  /\bweb developer\b/,
  /\bmobile engineer\b/,
  /\bios engineer\b/,
  /\bandroid engineer\b/,
  /\bplatform engineer\b/,
  /\bsite reliability\b/,
  /\bsre\b/,
  /\bdevops\b/,
  /\binfrastructure engineer\b/,
  /\bcloud engineer\b/,
  /\bsecurity engineer\b/,
  /\bapplication developer\b/,
  /\bqa engineer\b/,
  /\btest automation\b/,
  /\bembedded\b/,
  /\bfirmware\b/,
  /\bsystems engineer\b/,
];

function countBy(rows, getKey) {
  const counts = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function applyCategoryUpdates(sequelize, candidates) {
  await sequelize.transaction(async (transaction) => {
    for (const candidate of candidates) {
      await sequelize.query(
        `
        UPDATE scraped_jobs
        SET category = :category
        WHERE id = :id
          AND (raw_job->>'importType' = 'manual' OR raw_job->>'isManualImport' = 'true')
        `,
        {
          replacements: { id: candidate.id, category: candidate.inferredCategory },
          transaction,
        },
      );
    }
  });
}
