import { QueryTypes } from 'sequelize';

import { getSequelize } from '../connection.js';

export async function backfillTailoredResumeFilePaths() {
  const rows = await getSequelize().query(
    `
    WITH latest_paths AS (
      SELECT DISTINCT ON (profile_id, job_url)
        profile_id,
        job_url,
        file_path
      FROM tailored_resumes
      WHERE profile_id IS NOT NULL
        AND NULLIF(BTRIM(job_url), '') IS NOT NULL
        AND NULLIF(BTRIM(file_path), '') IS NOT NULL
      ORDER BY profile_id, job_url, ready_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC
    ),
    updated AS (
      UPDATE tailored_resumes target
      SET file_path = latest_paths.file_path,
          updated_at = now()
      FROM latest_paths
      WHERE target.profile_id = latest_paths.profile_id
        AND target.job_url = latest_paths.job_url
        AND NULLIF(BTRIM(target.file_path), '') IS NULL
      RETURNING target.id
    )
    SELECT COUNT(*)::int AS "updatedCount"
    FROM updated
    `,
    { type: QueryTypes.SELECT },
  );

  return rows[0]?.updatedCount || 0;
}
