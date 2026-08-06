import { getSequelize } from '../connection.js';

export async function migrateManualTailoringBidsToTailored(transaction) {
  await getSequelize().query(
    `
      UPDATE job_bids AS bid
      SET status = 'tailoring', updated_at = NOW()
      FROM scraped_jobs AS job
      WHERE bid.job_id = job.id
        AND bid.status = 'submitted'
        AND job.raw_job->>'importType' = 'manual_tailoring'
        AND EXISTS (
          SELECT 1
          FROM tailored_resumes AS resume
          WHERE resume.profile_id = bid.profile_id
            AND resume.job_url = job.url
            AND resume.request_type = 'manual'
            AND resume.status IN ('requested', 'processing', 'ready', 'dead_letter')
        )
    `,
    { transaction },
  );
}
