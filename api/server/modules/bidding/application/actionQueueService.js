import { QueryTypes } from 'sequelize';
import { ensureWebModels, getSequelize } from '../../../../db.js';
import { currentDbUser, profilesVisibleToUser } from './profilesService.js';
import { isAdminRole } from '../../../utils/roles.js';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;

export async function getActionQueue(req, options = {}) {
  await ensureWebModels();
  const user = await currentDbUser(req);
  const profileIds = await visibleProfileIds(user);
  if (!profileIds.length) return emptyQueue(user);

  const limit = boundedLimit(options.limit ?? req.query?.limit);
  const rows = await getSequelize().query(actionQueueSql(), {
    type: QueryTypes.SELECT,
    replacements: {
      profileIds,
      limit,
    },
  });
  const items = rows.map(formatActionQueueItem);

  return {
    generatedAt: new Date().toISOString(),
    user: { id: String(user.id), username: user.username, role: user.role },
    counts: actionQueueCounts(items),
    items,
  };
}

async function visibleProfileIds(user) {
  if (isAdminRole(user)) {
    const rows = await getSequelize().query('SELECT id FROM bid_profiles', { type: QueryTypes.SELECT });
    return rows.map((row) => row.id).filter(Boolean);
  }
  const profiles = await profilesVisibleToUser(user);
  return profiles.map((profile) => String(profile.id)).filter(Boolean);
}

function actionQueueSql() {
  return `
    WITH visible_profiles AS (
      SELECT id, name
      FROM bid_profiles
      WHERE id IN (:profileIds)
    ),
    due_assessments AS (
      SELECT
        'assessment_expiring' AS type,
        CASE WHEN a.expires_at < now() THEN 'critical' ELSE 'high' END AS priority,
        a.id::text AS source_id,
        a.profile_id,
        vp.name AS profile_name,
        COALESCE(sj.title, initcap(replace(a.category, '_', ' ')) || ' assessment') AS title,
        sj.company,
        a.expires_at AS due_at,
        '/assessments?profileId=' || a.profile_id::text AS href,
        CASE WHEN a.expires_at < now() THEN 'Assessment expired' ELSE 'Assessment expires soon' END AS reason,
        'Complete or request an extension before the link expires.' AS suggested_action
      FROM assessments a
      JOIN visible_profiles vp ON vp.id = a.profile_id
      LEFT JOIN scraped_jobs sj ON sj.id = a.job_id
      WHERE a.completed_at IS NULL
        AND a.expires_at IS NOT NULL
        AND a.expires_at <= now() + interval '48 hours'
    ),
    follow_ups AS (
      SELECT
        'follow_up_due' AS type,
        'medium' AS priority,
        jb.id::text AS source_id,
        jb.profile_id,
        vp.name AS profile_name,
        sj.title,
        sj.company,
        jb.bid_at + interval '5 days' AS due_at,
        '/bids?profileId=' || jb.profile_id::text || '&tab=done' AS href,
        'Submitted application has aged without movement' AS reason,
        'Send a recruiter follow-up or mark as stale if there is no response.' AS suggested_action
      FROM job_bids jb
      JOIN visible_profiles vp ON vp.id = jb.profile_id
      JOIN scraped_jobs sj ON sj.id = jb.job_id
      WHERE jb.status = 'submitted'
        AND jb.bid_at <= now() - interval '5 days'
    ),
    stale_applications AS (
      SELECT
        'stale_application' AS type,
        'low' AS priority,
        jb.id::text AS source_id,
        jb.profile_id,
        vp.name AS profile_name,
        sj.title,
        sj.company,
        jb.bid_at + interval '14 days' AS due_at,
        '/bids?profileId=' || jb.profile_id::text || '&tab=done' AS href,
        'Application has been submitted for 14+ days' AS reason,
        'Review the posting and move to stale or blocked if no action remains.' AS suggested_action
      FROM job_bids jb
      JOIN visible_profiles vp ON vp.id = jb.profile_id
      JOIN scraped_jobs sj ON sj.id = jb.job_id
      WHERE jb.status IN ('submitted', 'needs_follow_up')
        AND jb.bid_at <= now() - interval '14 days'
    ),
    missing_meeting_links AS (
      SELECT
        'missing_meeting_link' AS type,
        CASE WHEN i.interview_next_at <= now() + interval '24 hours' THEN 'critical' ELSE 'high' END AS priority,
        i.id::text AS source_id,
        i.profile_id,
        vp.name AS profile_name,
        i.title,
        i.company,
        i.interview_next_at AS due_at,
        '/interviews?profileId=' || i.profile_id::text AS href,
        'Scheduled interview is missing a meeting link' AS reason,
        'Ask the recruiter for the meeting link and add it to the interview stage.' AS suggested_action
      FROM interviews i
      JOIN visible_profiles vp ON vp.id = i.profile_id
      WHERE i.status = 'interviewing'
        AND i.interview_next_at IS NOT NULL
        AND i.interview_next_at <= now() + interval '7 days'
        AND NULLIF(BTRIM(COALESCE(i.stage_meeting_links ->> i.interview_stage, '')), '') IS NULL
    ),
    caller_gaps AS (
      SELECT
        'caller_assignment_gap' AS type,
        'high' AS priority,
        i.id::text AS source_id,
        i.profile_id,
        vp.name AS profile_name,
        i.title,
        i.company,
        i.interview_next_at AS due_at,
        '/interviews?profileId=' || i.profile_id::text AS href,
        'Interview has no caller assigned' AS reason,
        'Assign a caller before interview prep or handoff starts.' AS suggested_action
      FROM interviews i
      JOIN visible_profiles vp ON vp.id = i.profile_id
      WHERE i.status = 'interviewing'
        AND i.caller_user_id IS NULL
    ),
    mailbox_actions AS (
      SELECT
        'mailbox_action' AS type,
        CASE
          WHEN fmm.classification ->> 'type' IN ('interview_invite', 'assessment_link') THEN 'high'
          WHEN fmm.classification ->> 'type' = 'recruiter_reply' THEN 'medium'
          ELSE 'low'
        END AS priority,
        fmm.message_id AS source_id,
        fmm.profile_id,
        vp.name AS profile_name,
        COALESCE(NULLIF(fmm.subject, ''), 'Mailbox message') AS title,
        COALESCE(NULLIF(fmm.from_name, ''), NULLIF(fmm.from_address, '')) AS company,
        fmm.received_at AS due_at,
        '/inbox?profileId=' || fmm.profile_id::text || '&messageId=' || fmm.message_id AS href,
        COALESCE(fmm.classification ->> 'label', 'Mailbox message needs review') AS reason,
        COALESCE(fmm.classification ->> 'suggestedAction', 'Review the message and update the application record.') AS suggested_action
      FROM forwarded_mailbox_messages fmm
      JOIN visible_profiles vp ON vp.id = fmm.profile_id
      WHERE fmm.is_read = false
        AND COALESCE(fmm.classification ->> 'type', '') <> ''
    )
    SELECT * FROM due_assessments
    UNION ALL SELECT * FROM follow_ups
    UNION ALL SELECT * FROM stale_applications
    UNION ALL SELECT * FROM missing_meeting_links
    UNION ALL SELECT * FROM caller_gaps
    UNION ALL SELECT * FROM mailbox_actions
    ORDER BY
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      due_at ASC NULLS LAST
    LIMIT :limit
  `;
}

function formatActionQueueItem(row) {
  return {
    id: `${row.type}:${row.source_id}`,
    type: row.type,
    priority: row.priority,
    sourceId: row.source_id,
    profileId: row.profile_id ? String(row.profile_id) : null,
    profileName: row.profile_name,
    title: row.title,
    company: row.company,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    href: row.href,
    reason: row.reason,
    suggestedAction: row.suggested_action,
  };
}

function actionQueueCounts(items) {
  const byType = {};
  const byPriority = {};
  for (const item of items) {
    byType[item.type] = (byType[item.type] || 0) + 1;
    byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
  }
  return {
    total: items.length,
    byType,
    byPriority,
  };
}

function emptyQueue(user) {
  return {
    generatedAt: new Date().toISOString(),
    user: { id: String(user.id), username: user.username, role: user.role },
    counts: { total: 0, byType: {}, byPriority: {} },
    items: [],
  };
}

function boundedLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(parsed, MAX_LIMIT));
}
