import { backfillTailoredResumeFilePaths } from '../db/backfills/tailoredResumeFilePaths.js';
import { ensureWebModels } from '../db/schema.js';
import { getSequelize } from '../db/connection.js';

const tailoredResumeId = parseTailoredResumeId(process.argv[2]);

try {
  const scope = tailoredResumeId ? ` for tailored resume ${tailoredResumeId}` : '';
  console.log(`Running tailored resume file_path backfill${scope}.`);
  await ensureWebModels({ runBackfills: false });
  const updatedCount = await backfillTailoredResumeFilePaths({ tailoredResumeId });
  console.log(`Tailored resume file_path backfill completed; updated ${updatedCount} record${updatedCount === 1 ? '' : 's'}.`);
  await getSequelize().close();
} catch (error) {
  console.error('Failed to backfill tailored resume file paths:', error);
  await closeQuietly();
  process.exitCode = 1;
}

function parseTailoredResumeId(value) {
  if (!value) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Usage: node scripts/backfillTailoredResumeFilePaths.js [tailoredResumeId]');
  }
  return id;
}

async function closeQuietly() {
  try {
    await getSequelize().close();
  } catch {
    // Ignore close failures while reporting the original error.
  }
}
