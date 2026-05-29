import { backfillTailoredResumeFilePaths } from '../db/backfills/tailoredResumeFilePaths.js';
import { ensureWebModels } from '../db/schema.js';
import { getSequelize } from '../db/connection.js';

const tailoredResumeId = parseTailoredResumeId(process.argv[2]);

try {
  await ensureWebModels({ runBackfills: false });
  const updatedCount = await backfillTailoredResumeFilePaths({ tailoredResumeId });
  console.log(`Backfilled file_path for ${updatedCount} tailored resume record${updatedCount === 1 ? '' : 's'}.`);
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
