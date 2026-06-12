import {
  backfillManualJobCategoriesByTitle,
  printManualJobCategorySummary,
} from '../db/backfills/manualJobCategoriesByTitle.js';
import { getSequelize } from '../db/connection.js';

const APPLY_FLAG = '--apply';
const ONLY_SOFTWARE_FLAG = '--only-software';

const args = new Set(process.argv.slice(2));
const shouldApply = args.has(APPLY_FLAG);
const onlySoftware = args.has(ONLY_SOFTWARE_FLAG);

try {
  const summary = await backfillManualJobCategoriesByTitle({
    apply: shouldApply,
    onlySoftware,
  });
  printManualJobCategorySummary(summary);
  if (!shouldApply) console.log(`Dry run only. Re-run with ${APPLY_FLAG} to update rows.`);
  else console.log(`Updated ${summary.candidateCount} manual job categor${summary.candidateCount === 1 ? 'y' : 'ies'}.`);
  await getSequelize().close();
} catch (error) {
  console.error('Failed to backfill manual job categories:', error);
  await closeQuietly();
  process.exitCode = 1;
}

async function closeQuietly() {
  try {
    await getSequelize().close();
  } catch {
    // Ignore close failures while reporting the original error.
  }
}
