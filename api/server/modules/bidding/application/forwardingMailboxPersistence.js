import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { Op, QueryTypes, literal } from 'sequelize';
import { ENV } from '../../../../env.js';
import {
  getBidProfileModel,
  getForwardedMailboxMessageModel,
  getJobBidModel,
  getProfileShareRequestModel,
  getSequelize,
} from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';
import { BIDDER_ROLES, CALLER_BLOCKED_ROLES, isAdminRole } from '../../../utils/roles.js';
import { currentDbUser, profilesManagedByUser, profilesVisibleToUser } from './profilesService.js';

const DEFAULT_PROFILE_MESSAGE_LIMIT = 10;
const DEFAULT_NOTIFICATION_MESSAGE_LIMIT = 25;
const DEFAULT_MAILBOX_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MAILBOX_SYNC_MESSAGE_LIMIT = 100;
const MIN_MAILBOX_SYNC_INTERVAL_MS = 30 * 1000;
const MAX_MESSAGE_FETCH = 200;
const SKIPPED_MAILBOX_SPECIAL_USE = new Set(['\\All', '\\Drafts', '\\Junk', '\\Sent', '\\Trash']);
const APPLIED_STATUSES = new Set(['submitted', 'interviewing', 'won', 'lost']);
let mailboxApplicationSyncTimer = null;
let mailboxApplicationSyncRunning = false;

import { syncForwardingMailboxApplications } from './forwardingMailboxConfig.js';
import { classifyMailboxMessageIntent } from './forwardingMailboxFormatting.js';
import { dedupeMessages, fetchRecentMailboxMessagesFromPath, normalizedMatchingText, readableMailboxPaths, searchableMessageText } from './forwardingMailboxClassification.js';
import { compareMessagesByReceivedAtDesc, mailboxClient } from './forwardingMailboxImap.js';
import { jobIdentityCandidatesFromConfirmationMessage, matchingJobDateWindow } from './forwardingMailboxJobIdentity.js';

export function storedMailboxMessageOrder() {
  return [
    ['receivedAt', 'DESC'],
    ['id', 'DESC'],
  ];
}

export async function markImapMessageRefRead(messageRef) {
  const client = mailboxClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock(messageRef.mailboxPath);
    try {
      await client.messageFlagsAdd(String(messageRef.uid), ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function fetchRecentMailboxMessages(limit) {
  const client = mailboxClient();

  await client.connect();
  try {
    const mailboxPaths = await readableMailboxPaths(client);
    const messages = [];
    const perMailboxLimit = Math.min(limit, MAX_MESSAGE_FETCH);

    for (const mailboxPath of mailboxPaths) {
      messages.push(...await fetchRecentMailboxMessagesFromPath(client, mailboxPath, perMailboxLimit));
    }

    return dedupeMessages(messages).sort(compareMessagesByReceivedAtDesc).slice(0, limit);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function applicationResultForMailboxMessage(message, profile) {
  const classification = classifyMailboxMessageIntent(message);
  if (classification?.type !== 'application_confirmation') return null;
  return markMatchedJobAppliedFromMessage(message, profile);
}

export async function markMatchedJobAppliedFromMessage(message, profile) {
  const match = await matchingJobFromConfirmationMessage(message, profile);
  if (!match.job) {
    return {
      status: match.status,
      reason: match.reason || null,
      candidates: match.candidates || [],
    };
  }

  const now = new Date();
  const JobBid = getJobBidModel();
  const existingBid = await existingBidForJobIdentity(profile, match.job);

  if (existingBid) {
    if (APPLIED_STATUSES.has(existingBid.status)) {
      return applicationResult('already_applied', match.job, existingBid);
    }
    if (existingBid.status !== 'planned') {
      return applicationResult('skipped_existing_status', match.job, existingBid);
    }

    await existingBid.update({
      status: 'submitted',
      bidAt: now,
      updatedAt: now,
    });
    return applicationResult('applied', match.job, existingBid);
  }

  const bid = await JobBid.create({
    userId: profile.userId,
    profileId: profile.id,
    jobId: match.job.id,
    status: 'submitted',
    bidAt: now,
    updatedAt: now,
  });
  return applicationResult('applied', match.job, bid);
}

export async function existingBidForJobIdentity(profile, job) {
  const rows = await getSequelize().query(
    `
    SELECT job_bids.id
    FROM job_bids
    JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
    WHERE job_bids.profile_id = :profileId
      AND lower(regexp_replace(btrim(coalesce(scraped_jobs.company, '')), '\\s+', ' ', 'g')) = lower(:company)
      AND lower(regexp_replace(btrim(coalesce(scraped_jobs.title, '')), '\\s+', ' ', 'g')) = lower(:title)
    ORDER BY
      CASE WHEN job_bids.job_id = :jobId THEN 0 ELSE 1 END,
      job_bids.updated_at DESC NULLS LAST,
      job_bids.id DESC
    LIMIT 1
    `,
    {
      replacements: {
        profileId: profile.id,
        jobId: job.id,
        company: normalizedMatchingText(job.company),
        title: normalizedMatchingText(job.title),
      },
      type: QueryTypes.SELECT,
    },
  );

  const bidId = rows[0]?.id;
  return bidId ? getJobBidModel().findByPk(bidId) : null;
}

export function applicationResult(status, job, bid) {
  return {
    status,
    jobId: job.id,
    jobTitle: job.title || 'Untitled role',
    company: job.company || 'Unknown company',
    bidId: bid?.id || null,
  };
}

export async function runForwardingMailboxApplicationSync(config) {
  if (mailboxApplicationSyncRunning) return;
  mailboxApplicationSyncRunning = true;
  try {
    const stats = await syncForwardingMailboxApplications({ messageLimit: config.messageLimit });
    if (stats.applied || stats.errors) {
      console.log(
        'Forwarding mailbox application sync:',
        `scanned=${stats.scanned}`,
        `stored=${stats.storedMessages}`,
        `new=${stats.newMessages}`,
        `matched=${stats.matchedMessages}`,
        `confirmations=${stats.confirmations}`,
        `applied=${stats.applied}`,
        `alreadyApplied=${stats.alreadyApplied}`,
        `errors=${stats.errors}`,
      );
    }
  } catch (error) {
    console.error('Forwarding mailbox application sync failed:', error);
  } finally {
    mailboxApplicationSyncRunning = false;
  }
}

export function emptyMailboxApplicationSyncStats({ scanned = 0, profiles = 0 } = {}) {
  return {
    profiles,
    scanned,
    storedMessages: 0,
    newMessages: 0,
    matchedMessages: 0,
    confirmations: 0,
    applied: 0,
    alreadyApplied: 0,
    errors: 0,
    results: {},
  };
}

export function normalizedMessageLimit(value) {
  return integerOption(value, {
    defaultValue: DEFAULT_MAILBOX_SYNC_MESSAGE_LIMIT,
    min: 1,
    max: MAX_MESSAGE_FETCH,
  });
}

export function notificationMessageLimit(value) {
  return integerOption(value, {
    defaultValue: DEFAULT_NOTIFICATION_MESSAGE_LIMIT,
    min: 1,
    max: MAX_MESSAGE_FETCH,
  });
}

export function booleanOption(value, defaultValue) {
  if (value === undefined || value === null || value === '') return Boolean(defaultValue);
  const normalized = String(value).trim();
  if (!normalized) return Boolean(defaultValue);
  return !['0', 'false', 'no', 'off'].includes(normalized.toLowerCase());
}

export function integerOption(value, { defaultValue, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

export async function matchingJobFromConfirmationMessage(message, profile = null) {
  const messageText = normalizedMatchingText(searchableMessageText(message));
  if (!messageText) return { status: 'job_not_found', reason: 'No readable confirmation text' };

  const identities = jobIdentityCandidatesFromConfirmationMessage(message);
  let rows = identities.length ? await jobsMatchingExtractedIdentities(identities) : [];
  if (!rows.length && profile?.id) rows = await profileJobsContainedInMessage(profile.id, messageText);
  if (!rows.length) rows = await recentJobsContainedInMessage(message, messageText);
  return matchingJobResult(rows);
}

async function jobsMatchingExtractedIdentities(identities) {
  const bind = {};
  const clauses = identities.map((identity, index) => {
    bind[`company${index}`] = identity.company;
    bind[`title${index}`] = identity.title;
    return `
      (
        md5(normalized_company) = md5(app_normalize_job_company($company${index}))
        AND md5(normalized_title) = md5(app_normalize_job_identity($title${index}))
        AND normalized_company = app_normalize_job_company($company${index})
        AND normalized_title = app_normalize_job_identity($title${index})
      )
    `;
  });

  return getSequelize().query(
    `
    SELECT id, title, company, normalized_company, normalized_title, scraped_at
    FROM scraped_jobs
    WHERE normalized_company IS NOT NULL
      AND normalized_title IS NOT NULL
      AND (${clauses.join('\nOR ')})
    ORDER BY length(title) DESC, scraped_at DESC NULLS LAST, id DESC
    LIMIT 10
    `,
    {
      bind,
      type: QueryTypes.SELECT,
    },
  );
}

async function profileJobsContainedInMessage(profileId, messageText) {
  return getSequelize().query(
    `
    WITH input AS (
      SELECT app_normalize_job_identity($messageText) AS message_text
    )
    SELECT
      scraped_jobs.id,
      scraped_jobs.title,
      scraped_jobs.company,
      scraped_jobs.normalized_company,
      scraped_jobs.normalized_title,
      scraped_jobs.scraped_at
    FROM job_bids
    JOIN scraped_jobs ON scraped_jobs.id = job_bids.job_id
    CROSS JOIN input
    WHERE job_bids.profile_id = $profileId
      AND scraped_jobs.normalized_company IS NOT NULL
      AND scraped_jobs.normalized_title IS NOT NULL
      AND position(scraped_jobs.normalized_company in input.message_text) > 0
      AND position(scraped_jobs.normalized_title in input.message_text) > 0
    ORDER BY length(scraped_jobs.title) DESC, scraped_jobs.scraped_at DESC NULLS LAST, scraped_jobs.id DESC
    LIMIT 10
    `,
    {
      bind: { messageText, profileId },
      type: QueryTypes.SELECT,
    },
  );
}

async function recentJobsContainedInMessage(message, messageText) {
  const { cutoff, ceiling } = matchingJobDateWindow(message);
  return getSequelize().query(
    `
    WITH input AS (
      SELECT app_normalize_job_identity($messageText) AS message_text
    ),
    recent_jobs AS MATERIALIZED (
      SELECT id, title, company, normalized_company, normalized_title, scraped_at
      FROM scraped_jobs
      WHERE scraped_at >= $cutoff
        AND scraped_at <= $ceiling
        AND normalized_company IS NOT NULL
        AND normalized_title IS NOT NULL
      ORDER BY scraped_at DESC, id DESC
      LIMIT 25000
    )
    SELECT
      recent_jobs.id,
      recent_jobs.title,
      recent_jobs.company,
      recent_jobs.normalized_company,
      recent_jobs.normalized_title,
      recent_jobs.scraped_at
    FROM recent_jobs
    CROSS JOIN input
    WHERE position(recent_jobs.normalized_company in input.message_text) > 0
      AND position(recent_jobs.normalized_title in input.message_text) > 0
    ORDER BY length(recent_jobs.title) DESC, recent_jobs.scraped_at DESC NULLS LAST, recent_jobs.id DESC
    LIMIT 10
    `,
    {
      bind: { messageText, cutoff, ceiling },
      type: QueryTypes.SELECT,
    },
  );
}

function matchingJobResult(rows) {
  if (!rows.length) return { status: 'job_not_found', reason: 'No matching job found' };

  const rowsByKey = new Map();
  for (const row of rows) {
    const key = `${row.normalized_company || normalizedMatchingText(row.company)}::${row.normalized_title || normalizedMatchingText(row.title)}`;
    if (!rowsByKey.has(key)) rowsByKey.set(key, []);
    rowsByKey.get(key).push(row);
  }

  if (rowsByKey.size > 1) {
    return {
      status: 'ambiguous_job_match',
      reason: 'More than one company/title pair matched',
      candidates: [...rowsByKey.values()].map(([row]) => ({
        jobId: row.id,
        jobTitle: row.title,
        company: row.company,
      })),
    };
  }

  return { status: 'matched', job: [...rowsByKey.values()][0][0] };
}
