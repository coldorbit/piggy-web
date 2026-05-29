import { QueryTypes } from 'sequelize';

import { getSequelize } from '../connection.js';

export async function backfillTailoredResumeFilePaths({ tailoredResumeId = null } = {}) {
  const rows = await getSequelize().query(
    `
    WITH candidate_updates AS (
      SELECT
        target.id,
        source.file_path
      FROM tailored_resumes target
      CROSS JOIN LATERAL (
        SELECT candidate.file_path
        FROM tailored_resumes candidate
        WHERE candidate.id <> target.id
          AND candidate.job_url = target.job_url
          AND NULLIF(BTRIM(candidate.file_path), '') IS NOT NULL
          AND (
            candidate.profile_id = target.profile_id
            OR (
              target.user_id IS NOT NULL
              AND candidate.user_id = target.user_id
              AND (
                target.profile_id IS NULL
                OR candidate.profile_id IS NULL
              )
            )
          )
        ORDER BY
          CASE WHEN candidate.profile_id = target.profile_id THEN 0 ELSE 1 END,
          candidate.ready_at DESC NULLS LAST,
          candidate.updated_at DESC NULLS LAST,
          candidate.id DESC
        LIMIT 1
      ) source
      WHERE NULLIF(BTRIM(target.file_path), '') IS NULL
        AND NULLIF(BTRIM(target.job_url), '') IS NOT NULL
        AND (CAST(:tailoredResumeId AS bigint) IS NULL OR target.id = CAST(:tailoredResumeId AS bigint))
    ),
    updated AS (
      UPDATE tailored_resumes target
      SET file_path = candidate_updates.file_path,
          updated_at = now()
      FROM candidate_updates
      WHERE target.id = candidate_updates.id
      RETURNING target.id
    )
    SELECT COUNT(*)::int AS "updatedCount"
    FROM updated
    `,
    {
      replacements: { tailoredResumeId },
      type: QueryTypes.SELECT,
    },
  );

  return rows[0]?.updatedCount || 0;
}
