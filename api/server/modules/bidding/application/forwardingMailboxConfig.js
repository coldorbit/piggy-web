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

import { classifyForwardedMessage, classifyMailboxMessageIntent, emptyMailboxStats, formatStoredMailboxMessage, formatStoredMailboxNotificationMessage, mailboxNotificationProfilesForUser, mailboxProfileForStoredRow, mailboxProfileForUser, mailboxProfilesMessageWhere, mailboxStatsByProfile, mailboxStatsForWhere, profileMailboxMessageConditions, storedForwardedMailboxMessagePageForProfiles, storedForwardedProfileMessagePage, storedMailboxProfileInclude, upsertForwardedMailboxMessage } from './forwardingMailboxFormatting.js';
import { applicationResultForMailboxMessage, booleanOption, emptyMailboxApplicationSyncStats, fetchRecentMailboxMessages, integerOption, markImapMessageRefRead, normalizedMessageLimit, notificationMessageLimit, runForwardingMailboxApplicationSync, storedMailboxMessageOrder } from './forwardingMailboxPersistence.js';
import { assertForwardingMailboxConfigured, mailboxMessageRefFromId, mailboxPort, mailboxSecure, profileMessagePage } from './forwardingMailboxImap.js';

export function forwardingMailboxConfigured() {
  return Boolean(
    clean(ENV.MAILBOX_EMAIL)
    && clean(ENV.MAILBOX_PASSWORD)
    && clean(ENV.MAILBOX_IMAP_HOST),
  );
}

export function forwardingMailboxStatus() {
  return {
    configured: forwardingMailboxConfigured(),
    email: clean(ENV.MAILBOX_EMAIL) || null,
    host: clean(ENV.MAILBOX_IMAP_HOST) || null,
    port: mailboxPort(),
    secure: mailboxSecure(),
  };
}

export function forwardingMailboxApplicationSyncConfig(options = {}) {
  const syncEnabled = booleanOption(options.enabled ?? ENV.MAILBOX_SYNC_ENABLED, true);
  const mailboxConfigured = options.mailboxConfigured ?? forwardingMailboxConfigured();
  const enabled = syncEnabled && mailboxConfigured;
  return {
    enabled,
    reason: enabled ? 'enabled' : syncEnabled ? 'not_configured' : 'disabled',
    intervalMs: integerOption(options.intervalMs ?? ENV.MAILBOX_SYNC_INTERVAL_MS, {
      defaultValue: DEFAULT_MAILBOX_SYNC_INTERVAL_MS,
      min: MIN_MAILBOX_SYNC_INTERVAL_MS,
    }),
    messageLimit: integerOption(options.messageLimit ?? ENV.MAILBOX_SYNC_MESSAGE_LIMIT, {
      defaultValue: DEFAULT_MAILBOX_SYNC_MESSAGE_LIMIT,
      min: 1,
      max: MAX_MESSAGE_FETCH,
    }),
  };
}

export function startForwardingMailboxApplicationSync(options = {}) {
  const config = forwardingMailboxApplicationSyncConfig(options);
  if (!config.enabled) return { started: false, config };
  if (mailboxApplicationSyncTimer) return { started: false, config: { ...config, reason: 'already_started' } };

  const syncNow = () => {
    void runForwardingMailboxApplicationSync(config);
  };

  syncNow();
  mailboxApplicationSyncTimer = setInterval(syncNow, config.intervalMs);
  mailboxApplicationSyncTimer.unref?.();
  return { started: true, config };
}

export function stopForwardingMailboxApplicationSync() {
  if (!mailboxApplicationSyncTimer) return;
  clearInterval(mailboxApplicationSyncTimer);
  mailboxApplicationSyncTimer = null;
}

export async function syncForwardingMailboxApplications({ messageLimit = DEFAULT_MAILBOX_SYNC_MESSAGE_LIMIT } = {}) {
  assertForwardingMailboxConfigured();

  const profiles = await getBidProfileModel().findAll({
    attributes: ['id', 'userId', 'name', 'email', 'forwardingEmail'],
    where: { profileStatus: ['active', 'closed', 'legacy'] },
    order: [['name', 'ASC']],
  });
  const parsedMessages = await fetchRecentMailboxMessages(normalizedMessageLimit(messageLimit));
  const stats = emptyMailboxApplicationSyncStats({
    scanned: parsedMessages.length,
    profiles: profiles.length,
  });

  for (const message of parsedMessages) {
    const row = classifyForwardedMessage(message, profiles);
    const classification = classifyMailboxMessageIntent(row.message);
    let application = null;

    if (row.profile) {
      stats.matchedMessages += 1;

      try {
        application = await applicationResultForMailboxMessage(row.message, row.profile);
        if (application) {
          stats.confirmations += 1;
          stats.results[application.status] = (stats.results[application.status] || 0) + 1;
          if (application.status === 'applied') stats.applied += 1;
          if (application.status === 'already_applied') stats.alreadyApplied += 1;
        }
      } catch (error) {
        stats.errors += 1;
        console.warn('Forwarding mailbox application sync skipped a message:', message.id || message.subject || '(unknown)', error.message);
      }
    }

    try {
      const stored = await upsertForwardedMailboxMessage(row.message, row.profile, row.match, { classification, application });
      stats.storedMessages += 1;
      if (stored.created) stats.newMessages += 1;
    } catch (error) {
      stats.errors += 1;
      console.warn('Forwarding mailbox sync could not store a message:', message.id || message.subject || '(unknown)', error.message);
    }
  }

  return stats;
}

export async function mailboxProfileForRequest(req, profileId) {
  const user = await currentDbUser(req);
  return { user, profile: await mailboxProfileForUser(user, profileId) };
}

export async function listForwardedProfileMessages(profile, { limit = DEFAULT_PROFILE_MESSAGE_LIMIT, offset = 0 } = {}) {
  const { limit: messageLimit, offset: messageOffset } = profileMessagePage(limit, offset);
  const page = await storedForwardedProfileMessagePage(profile, {
    limit: messageLimit,
    offset: messageOffset,
  });
  const nextOffset = Math.min(messageOffset + page.messages.length, page.total);

  return {
    mailbox: forwardingMailboxStatus(),
    messages: page.messages,
    pagination: {
      limit: messageLimit,
      offset: messageOffset,
      total: page.total,
      unreadTotal: page.unreadTotal,
      nextOffset,
      hasMore: nextOffset < page.total,
    },
  };
}

export async function markForwardedProfileMessageRead(profile, { messageId } = {}) {
  const id = clean(messageId);
  if (!id) throw new InputError('Message is required');

  const storedMessage = await getForwardedMailboxMessageModel().findOne({
    where: {
      messageId: id,
      [Op.or]: profileMailboxMessageConditions(profile),
    },
    include: [storedMailboxProfileInclude()],
  });

  if (storedMessage) {
    const attrs = {};
    if (!storedMessage.isRead) {
      attrs.isRead = true;
    }
    if (storedMessage.profileId === null || storedMessage.profileId === undefined) {
      attrs.profileId = profile.id;
    }
    if (Object.keys(attrs).length) {
      await storedMessage.update(attrs);
    }
    const messageRef = mailboxMessageRefFromId(id);
    if (messageRef && forwardingMailboxConfigured()) {
      await markImapMessageRefRead(messageRef).catch((error) => {
        console.warn('Unable to mark IMAP mailbox message as read:', id, error.message);
      });
    }
    return formatStoredMailboxMessage(storedMessage, profile);
  }

  throw new NotFoundError('Message not found');
}

export async function listForwardedInboxMessages(req, { limit = DEFAULT_PROFILE_MESSAGE_LIMIT, offset = 0 } = {}) {
  const user = await currentDbUser(req);
  const profiles = await mailboxNotificationProfilesForUser(user);
  const { limit: messageLimit, offset: messageOffset } = profileMessagePage(limit, offset);
  const page = await storedForwardedMailboxMessagePageForProfiles(profiles, {
    limit: messageLimit,
    offset: messageOffset,
  });
  const nextOffset = Math.min(messageOffset + page.messages.length, page.total);

  return {
    mailbox: forwardingMailboxStatus(),
    messages: page.messages,
    pagination: {
      limit: messageLimit,
      offset: messageOffset,
      total: page.total,
      unreadTotal: page.unreadTotal,
      nextOffset,
      hasMore: nextOffset < page.total,
    },
  };
}

export async function listForwardedMailboxSummary(req) {
  const user = await currentDbUser(req);
  const profiles = await mailboxNotificationProfilesForUser(user);
  const aggregateWhere = mailboxProfilesMessageWhere(profiles);
  const [aggregateStats, profileStatsById] = await Promise.all([
    aggregateWhere ? mailboxStatsForWhere(aggregateWhere) : emptyMailboxStats(),
    mailboxStatsByProfile(profiles),
  ]);

  return {
    mailbox: forwardingMailboxStatus(),
    unreadTotal: aggregateStats.unreadTotal,
    stats: aggregateStats,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      unreadTotal: profileStatsById.get(String(profile.id))?.unreadTotal || 0,
      stats: profileStatsById.get(String(profile.id)) || emptyMailboxStats(),
    })),
  };
}

export async function listForwardedMailboxNotificationMessages(req, { limit = DEFAULT_NOTIFICATION_MESSAGE_LIMIT } = {}) {
  const user = await currentDbUser(req);
  const profiles = await mailboxNotificationProfilesForUser(user);
  if (!profiles.length) {
    return {
      mailbox: forwardingMailboxStatus(),
      unreadTotal: 0,
      messages: [],
    };
  }

  const where = mailboxProfilesMessageWhere(profiles, { isRead: false });
  if (!where) return { mailbox: forwardingMailboxStatus(), unreadTotal: 0, messages: [] };
  const [rows, unreadTotal] = await Promise.all([
    getForwardedMailboxMessageModel().findAll({
      where,
      include: [storedMailboxProfileInclude()],
      limit: notificationMessageLimit(limit),
      order: storedMailboxMessageOrder(),
    }),
    getForwardedMailboxMessageModel().count({ where }),
  ]);

  return {
    mailbox: forwardingMailboxStatus(),
    unreadTotal,
    messages: rows.map((row) => formatStoredMailboxNotificationMessage(row, mailboxProfileForStoredRow(row, profiles))),
  };
}
