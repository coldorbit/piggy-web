import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { Op, QueryTypes } from 'sequelize';
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
  const unreadWhere = mailboxProfilesMessageWhere(profiles, { isRead: false });
  const [unreadCountsByProfileId, unreadTotal] = await Promise.all([
    unreadMailboxCountsByProfile(profiles),
    unreadWhere ? getForwardedMailboxMessageModel().count({ where: unreadWhere }) : 0,
  ]);

  return {
    mailbox: forwardingMailboxStatus(),
    unreadTotal,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      unreadTotal: unreadCountsByProfileId.get(String(profile.id)) || 0,
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

export function formatMailboxMessage(message, profile = null, match = null, options = {}) {
  const classification = options.classification === undefined ? classifyMailboxMessageIntent(message) : options.classification;
  return {
    id: message.id,
    subject: message.subject || '',
    from: message.from || { name: '', address: '' },
    receivedAt: message.receivedAt || null,
    bodyPreview: message.bodyPreview || '',
    bodyHtml: message.bodyHtml || '',
    mailboxPath: message.mailboxPath || null,
    isRead: Boolean(message.isRead),
    matchedProfile: profile
      ? {
          id: profile.id,
          name: profile.name,
          email: profile.email || null,
          forwardingEmail: profile.forwardingEmail || null,
        }
      : null,
    match: match
      ? {
          value: match.value,
          source: match.source,
        }
      : null,
    classification,
    application: options.application || null,
    calendarEvent: options.calendarEvent === undefined ? message.calendarEvent || null : options.calendarEvent,
  };
}

export function formatMailboxNotificationMessage(message, profile = null, match = null) {
  const formatted = formatMailboxMessage(message, profile, match, {
    classification: classifyMailboxMessageIntent(message),
  });
  return {
    id: formatted.id,
    subject: formatted.subject,
    from: formatted.from,
    receivedAt: formatted.receivedAt,
    bodyPreview: formatted.bodyPreview,
    mailboxPath: formatted.mailboxPath,
    isRead: formatted.isRead,
    matchedProfile: formatted.matchedProfile,
    match: formatted.match,
    classification: formatted.classification,
    calendarEvent: formatted.calendarEvent,
  };
}

export function formatStoredMailboxMessage(row, profileOverride = null) {
  const profile = profileOverride || rowValue(row, 'profile');
  const message = mailboxMessageFromStoredRow(row);
  const match = rowValue(row, 'matchValue')
    ? {
        value: rowValue(row, 'matchValue'),
        source: rowValue(row, 'matchSource') || '',
      }
    : null;

  return formatMailboxMessage(message, profile, match, {
    classification: rowValue(row, 'classification') || null,
    application: rowValue(row, 'application') || null,
    calendarEvent: rowValue(row, 'calendarEvent') || null,
  });
}

export function formatStoredMailboxNotificationMessage(row, profileOverride = null) {
  const formatted = formatStoredMailboxMessage(row, profileOverride);
  return {
    id: formatted.id,
    subject: formatted.subject,
    from: formatted.from,
    receivedAt: formatted.receivedAt,
    bodyPreview: formatted.bodyPreview,
    mailboxPath: formatted.mailboxPath,
    isRead: formatted.isRead,
    matchedProfile: formatted.matchedProfile,
    match: formatted.match,
    classification: formatted.classification,
    calendarEvent: formatted.calendarEvent,
  };
}

export function classifyMailboxMessageIntent(message) {
  if (message?.calendarEvent) {
    return { type: 'interview_related', label: 'Interview related' };
  }

  const text = searchableMessageText(message);
  if (!text) return null;

  if (isDeclinedMessageText(text)) {
    return { type: 'declined', label: 'Declined email' };
  }
  if (isApplicationConfirmationText(text)) {
    return { type: 'application_confirmation', label: 'Application confirmation' };
  }
  return null;
}

export function classifyForwardedMessage(message, profiles) {
  for (const profile of profiles) {
    const match = forwardedMessageProfileMatch(message, profile);
    if (match) return { message, profile, match };
  }
  return { message, profile: null, match: null };
}

export function forwardedMessageProfileMatch(message, profile) {
  const matchers = profileMailboxMatchers(profile);
  if (!matchers.length) return null;

  const addressSet = new Set(messageEmailAddresses(message));
  for (const matcher of matchers) {
    if (addressSet.has(matcher.value)) return matcherWithSource(matcher, 'address');
  }

  const headers = messageHeaderText(message);
  for (const matcher of matchers) {
    if (headers.includes(matcher.value)) return matcherWithSource(matcher, 'header');
  }

  const body = messageBodyText(message);
  for (const matcher of matchers) {
    if (body.includes(matcher.value)) return matcherWithSource(matcher, 'body');
  }

  return null;
}

export function profileMailboxMatchers(profile) {
  return [
    { value: profile?.forwardingEmail, source: 'forwardingEmail' },
    { value: profile?.email, source: 'profileEmail' },
  ]
    .map((matcher) => ({ ...matcher, value: normalizeEmail(matcher.value) }))
    .filter((matcher, index, matchers) => matcher.value && matchers.findIndex((row) => row.value === matcher.value) === index);
}

export function messageEmailAddresses(message) {
  return [
    message.from?.address,
    message.sender?.address,
    ...addressList(message.to),
    ...addressList(message.cc),
    ...addressList(message.bcc),
  ]
    .map(normalizeEmail)
    .filter(Boolean);
}

export function parseAddressList(value) {
  if (!value?.value) return [];
  return value.value
    .map((address) => ({
      name: address.name || '',
      address: normalizeEmail(address.address),
    }))
    .filter((address) => address.address);
}

async function mailboxProfileForUser(user, profileId) {
  if (BIDDER_ROLES.includes(user?.role)) throw new InputError('Bidders cannot read profile inboxes');

  const id = clean(profileId);
  if (!id) throw new InputError('Profile is required');

  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  await ensureUserCanReadMailboxProfile(user, profile);
  return profile;
}

async function mailboxNotificationProfilesForUser(user) {
  if (CALLER_BLOCKED_ROLES.includes(user?.role)) throw new InputError('This role cannot read profile inboxes');
  const profiles = isAdminRole(user)
    ? await profilesManagedByUser(user)
    : await profilesVisibleToUser(user);

  return profiles
    .filter((profile) => ['active', 'closed', 'legacy'].includes(profile?.profileStatus || 'active'))
    .filter((profile) => profileMailboxMatchers(profile).length);
}

async function ensureUserCanReadMailboxProfile(user, profile) {
  if (isAdminRole(user)) return;
  if (String(profile.userId) === String(user?.id)) return;
  const share = await getProfileShareRequestModel().findOne({
    where: {
      profileId: profile.id,
      recipientUserId: user?.id,
      status: 'accepted',
    },
  });
  if (share) return;
  throw new NotFoundError('Profile not found');
}

async function storedForwardedProfileMessagePage(profile, { limit, offset }) {
  const where = profileMailboxMessageWhere(profile);
  return storedForwardedMailboxMessagePage(where, { limit, offset, profiles: [profile] });
}

async function storedForwardedMailboxMessagePageForProfiles(profiles, { limit, offset }) {
  const where = mailboxProfilesMessageWhere(profiles);
  if (!where) {
    return {
      messages: [],
      total: 0,
      unreadTotal: 0,
    };
  }
  return storedForwardedMailboxMessagePage(where, { limit, offset, profiles });
}

async function unreadMailboxCountsByProfile(profiles) {
  const counts = new Map(profiles.map((profile) => [String(profile.id), 0]));
  if (!profiles.length) return counts;

  const profileIds = profiles.map((profile) => profile.id).filter(Boolean);
  const aliasProfileIds = new Map();
  for (const profile of profiles) {
    for (const matcher of profileMailboxMatchers(profile)) {
      const profileIdsForAlias = aliasProfileIds.get(matcher.value) || [];
      profileIdsForAlias.push(String(profile.id));
      aliasProfileIds.set(matcher.value, profileIdsForAlias);
    }
  }
  const aliases = [...aliasProfileIds.keys()];
  const [aliasRows, legacyRows] = await Promise.all([
    aliases.length
      ? getForwardedMailboxMessageModel().findAll({
          attributes: [
            'matchValue',
            [getSequelize().fn('COUNT', getSequelize().col('id')), 'unreadTotal'],
          ],
          where: {
            matchValue: { [Op.in]: aliases },
            isRead: false,
          },
          group: ['matchValue'],
          raw: true,
        })
      : [],
    profileIds.length
      ? getForwardedMailboxMessageModel().findAll({
          attributes: [
            'profileId',
            [getSequelize().fn('COUNT', getSequelize().col('id')), 'unreadTotal'],
          ],
          where: {
            profileId: { [Op.in]: profileIds },
            isRead: false,
            [Op.or]: [
              { matchValue: { [Op.is]: null } },
              { matchValue: '' },
            ],
          },
          group: ['profileId'],
          raw: true,
        })
      : [],
  ]);

  for (const row of aliasRows) {
    const unreadTotal = Number(row.unreadTotal || 0);
    for (const profileId of aliasProfileIds.get(normalizeEmail(row.matchValue)) || []) {
      counts.set(profileId, (counts.get(profileId) || 0) + unreadTotal);
    }
  }
  for (const row of legacyRows) {
    const profileId = String(row.profileId);
    counts.set(profileId, (counts.get(profileId) || 0) + Number(row.unreadTotal || 0));
  }

  return counts;
}

export function profileMailboxMessageWhere(profile, additionalWhere = {}) {
  const conditions = profileMailboxMessageConditions(profile);
  if (!conditions.length) return null;
  return {
    ...additionalWhere,
    [Op.or]: conditions,
  };
}

function mailboxProfilesMessageWhere(profiles, additionalWhere = {}) {
  const conditions = profiles.flatMap(profileMailboxMessageConditions);
  if (!conditions.length) return null;
  return {
    ...additionalWhere,
    [Op.or]: conditions,
  };
}

function profileMailboxMessageConditions(profile) {
  const conditions = [];
  const matchValues = profileMailboxMatchers(profile).map((matcher) => matcher.value);
  if (matchValues.length) {
    conditions.push({ matchValue: { [Op.in]: matchValues } });
  }
  if (profile?.id) {
    conditions.push({
      profileId: profile.id,
      [Op.or]: [
        { matchValue: { [Op.is]: null } },
        { matchValue: '' },
      ],
    });
  }
  return conditions;
}

function mailboxProfileForStoredRow(row, profiles) {
  const matchValue = normalizeEmail(rowValue(row, 'matchValue'));
  if (matchValue) {
    const matchedProfile = profiles.find((profile) =>
      profileMailboxMatchers(profile).some((matcher) => matcher.value === matchValue),
    );
    if (matchedProfile) return matchedProfile;
  }

  const profileId = rowValue(row, 'profileId');
  if (profileId !== null && profileId !== undefined) {
    const matchedProfile = profiles.find((profile) => String(profile.id) === String(profileId));
    if (matchedProfile) return matchedProfile;
  }
  return null;
}

async function storedForwardedMailboxMessagePage(where, { limit, offset, profiles = [] }) {
  const [messages, total, unreadTotal] = await Promise.all([
    getForwardedMailboxMessageModel().findAll({
      where,
      include: [storedMailboxProfileInclude()],
      limit,
      offset,
      order: storedMailboxMessageOrder(),
    }),
    getForwardedMailboxMessageModel().count({ where }),
    getForwardedMailboxMessageModel().count({ where: { ...where, isRead: false } }),
  ]);

  return {
    messages: messages.map((row) => formatStoredMailboxMessage(row, mailboxProfileForStoredRow(row, profiles))),
    total,
    unreadTotal,
  };
}

async function upsertForwardedMailboxMessage(message, profile = null, match = null, options = {}) {
  const attrs = storedMailboxMessageAttributes(message, profile, match, options);
  if (!attrs.messageId) throw new Error('Mailbox message id is required');

  const existing = await getForwardedMailboxMessageModel().findOne({
    where: { messageId: attrs.messageId },
  });
  if (!existing) {
    const created = await getForwardedMailboxMessageModel().create(attrs);
    return { message: created, created: true };
  }

  await existing.update({
    ...attrs,
    isRead: Boolean(existing.isRead || attrs.isRead),
    firstSeenAt: existing.firstSeenAt || attrs.firstSeenAt,
  });
  return { message: existing, created: false };
}

export function storedMailboxMessageAttributes(message, profile = null, match = null, options = {}) {
  const now = new Date();
  const ref = mailboxMessageRefFromId(message.id);
  const from = message.from || {};
  const sender = message.sender || from;

  return {
    messageId: clean(message.id),
    mailboxPath: clean(message.mailboxPath || ref?.mailboxPath || 'INBOX') || 'INBOX',
    mailboxUid: ref?.uid || null,
    profileId: profile?.id || null,
    matchValue: match?.value || null,
    matchSource: match?.source || null,
    subject: message.subject || '',
    fromName: from.name || '',
    fromAddress: from.address || '',
    senderName: sender.name || '',
    senderAddress: sender.address || '',
    toAddresses: addressObjects(message.to),
    ccAddresses: addressObjects(message.cc),
    bccAddresses: addressObjects(message.bcc),
    receivedAt: dateOrNull(message.receivedAt),
    bodyPreview: message.bodyPreview || '',
    bodyHtml: message.bodyHtml || '',
    bodyText: message.bodyText || '',
    headers: serializableHeaders(message.headers),
    isRead: Boolean(message.isRead),
    classification: options.classification || null,
    application: options.application || null,
    calendarEvent: options.calendarEvent === undefined ? message.calendarEvent || null : options.calendarEvent,
    firstSeenAt: now,
    lastSeenAt: now,
  };
}

function mailboxMessageFromStoredRow(row) {
  return {
    id: rowValue(row, 'messageId'),
    subject: rowValue(row, 'subject') || '',
    from: {
      name: rowValue(row, 'fromName') || '',
      address: rowValue(row, 'fromAddress') || '',
    },
    sender: {
      name: rowValue(row, 'senderName') || '',
      address: rowValue(row, 'senderAddress') || '',
    },
    to: rowValue(row, 'toAddresses') || [],
    cc: rowValue(row, 'ccAddresses') || [],
    bcc: rowValue(row, 'bccAddresses') || [],
    receivedAt: dateToIso(rowValue(row, 'receivedAt')),
    bodyPreview: rowValue(row, 'bodyPreview') || '',
    bodyHtml: rowValue(row, 'bodyHtml') || '',
    bodyText: rowValue(row, 'bodyText') || '',
    mailboxPath: rowValue(row, 'mailboxPath') || null,
    isRead: Boolean(rowValue(row, 'isRead')),
    headers: rowValue(row, 'headers') || {},
    calendarEvent: rowValue(row, 'calendarEvent') || null,
  };
}

function storedMailboxProfileInclude() {
  return {
    model: getBidProfileModel(),
    as: 'profile',
    required: false,
    attributes: ['id', 'name', 'email', 'forwardingEmail'],
  };
}

function storedMailboxMessageOrder() {
  return [
    ['receivedAt', 'DESC'],
    ['id', 'DESC'],
  ];
}

async function markImapMessageRefRead(messageRef) {
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

async function fetchRecentMailboxMessages(limit) {
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

async function applicationResultForMailboxMessage(message, profile) {
  const classification = classifyMailboxMessageIntent(message);
  if (classification?.type !== 'application_confirmation') return null;
  return markMatchedJobAppliedFromMessage(message, profile);
}

async function markMatchedJobAppliedFromMessage(message, profile) {
  const match = await matchingJobFromConfirmationMessage(message);
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

async function existingBidForJobIdentity(profile, job) {
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

function applicationResult(status, job, bid) {
  return {
    status,
    jobId: job.id,
    jobTitle: job.title || 'Untitled role',
    company: job.company || 'Unknown company',
    bidId: bid?.id || null,
  };
}

async function runForwardingMailboxApplicationSync(config) {
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

function emptyMailboxApplicationSyncStats({ scanned = 0, profiles = 0 } = {}) {
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

function normalizedMessageLimit(value) {
  return integerOption(value, {
    defaultValue: DEFAULT_MAILBOX_SYNC_MESSAGE_LIMIT,
    min: 1,
    max: MAX_MESSAGE_FETCH,
  });
}

function notificationMessageLimit(value) {
  return integerOption(value, {
    defaultValue: DEFAULT_NOTIFICATION_MESSAGE_LIMIT,
    min: 1,
    max: MAX_MESSAGE_FETCH,
  });
}

function booleanOption(value, defaultValue) {
  if (value === undefined || value === null || value === '') return Boolean(defaultValue);
  const normalized = String(value).trim();
  if (!normalized) return Boolean(defaultValue);
  return !['0', 'false', 'no', 'off'].includes(normalized.toLowerCase());
}

function integerOption(value, { defaultValue, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

async function matchingJobFromConfirmationMessage(message) {
  const messageText = normalizedMatchingText(searchableMessageText(message));
  if (!messageText) return { status: 'job_not_found', reason: 'No readable confirmation text' };

  const rows = await getSequelize().query(
    `
    SELECT id, title, company, scraped_at
    FROM scraped_jobs
    WHERE NULLIF(btrim(title), '') IS NOT NULL
      AND NULLIF(btrim(company), '') IS NOT NULL
      AND position(lower(regexp_replace(btrim(company), '\\s+', ' ', 'g')) in lower(:messageText)) > 0
      AND position(lower(regexp_replace(btrim(title), '\\s+', ' ', 'g')) in lower(:messageText)) > 0
    ORDER BY length(title) DESC, scraped_at DESC NULLS LAST, id DESC
    LIMIT 10
    `,
    {
      replacements: { messageText },
      type: QueryTypes.SELECT,
    },
  );

  if (!rows.length) return { status: 'job_not_found', reason: 'No matching job found' };

  const rowsByKey = new Map();
  for (const row of rows) {
    const key = `${normalizedMatchingText(row.company)}::${normalizedMatchingText(row.title)}`;
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

function searchableMessageText(message) {
  return [
    message.subject,
    message.from?.name,
    message.from?.address,
    message.bodyPreview,
    message.bodyText,
    htmlToText(message.bodyHtml),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function isDeclinedMessageText(text) {
  return [
    /unfortunately[\s\S]{0,240}(not|unable|won't|will not|cannot|can't)/i,
    /(not|no longer|won't|will not)[\s\S]{0,120}(move forward|proceed|be proceeding|continue|advance)/i,
    /(not selected|not be selected|not chosen|pursue other candidates|other candidates|another candidate)/i,
    /(regret to inform|we regret|sorry to inform)/i,
    /(application|candidacy)[\s\S]{0,120}(declined|unsuccessful|rejected)/i,
  ].some((pattern) => pattern.test(text));
}

function isApplicationConfirmationText(text) {
  return [
    /(thank you|thanks)[\s\S]{0,80}(applying|application)/i,
    /(application|resume)[\s\S]{0,80}(received|submitted|successfully submitted)/i,
    /we (have )?received your application/i,
    /your application (has been|was) (received|submitted)/i,
    /you applied (to|for)/i,
  ].some((pattern) => pattern.test(text));
}

function normalizedMatchingText(value) {
  return clean(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
    .slice(0, 30000);
}

function htmlToText(value) {
  return clean(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
}

async function fetchRecentMailboxMessagesFromPath(client, mailboxPath, limit) {
  const lock = await client.getMailboxLock(mailboxPath);
  try {
    const mailbox = client.mailbox || {};
    const exists = Number(mailbox.exists || 0);
    if (!exists) return [];

    const start = Math.max(exists - limit + 1, 1);
    const messages = [];
    for await (const row of client.fetch(`${start}:*`, {
      envelope: true,
      flags: true,
      internalDate: true,
      source: true,
      uid: true,
    })) {
      messages.push(await parseImapMessage(row, mailboxPath));
    }
    return messages;
  } catch (error) {
    console.warn('Skipping mailbox folder after fetch failure:', mailboxPath, error.message);
    return [];
  } finally {
    lock.release();
  }
}

async function readableMailboxPaths(client) {
  try {
    const folders = await client.list();
    const paths = folders
      .filter(isReadableMailbox)
      .map((folder) => folder.path)
      .filter(Boolean);
    return uniqueMailboxPaths(paths.length ? paths : ['INBOX']);
  } catch (error) {
    console.warn('Unable to list mailbox folders; falling back to INBOX:', error.message);
    return ['INBOX'];
  }
}

function isReadableMailbox(folder) {
  if (!folder?.path) return false;
  if (folder.flags?.has?.('\\Noselect')) return false;
  if (folder.specialUse && SKIPPED_MAILBOX_SPECIAL_USE.has(folder.specialUse)) return false;
  return true;
}

function uniqueMailboxPaths(paths) {
  const byKey = new Map();
  for (const path of paths) {
    const value = clean(path);
    if (!value) continue;
    byKey.set(value.toLowerCase(), value);
  }
  return [...byKey.values()];
}

function dedupeMessages(messages) {
  const byKey = new Map();
  for (const message of messages) {
    const key = message.id || `${message.mailboxPath}:${message.receivedAt}:${message.subject}`;
    if (!byKey.has(key)) byKey.set(key, message);
  }
  return [...byKey.values()];
}

async function parseImapMessage(row, mailboxPath = '') {
  const parsed = await simpleParser(row.source);
  const from = parseAddressList(parsed.from)[0] || { name: '', address: '' };
  const calendarEvent = calendarEventFromAttachments(parsed.attachments || []);

  return {
    id: imapMessageId(row, mailboxPath, parsed),
    subject: parsed.subject || row.envelope?.subject || '',
    from,
    sender: parseAddressList(parsed.sender)[0] || from,
    to: parseAddressList(parsed.to),
    cc: parseAddressList(parsed.cc),
    bcc: parseAddressList(parsed.bcc),
    receivedAt: (parsed.date || row.internalDate || null)?.toISOString?.() || null,
    bodyPreview: messagePreview(parsed),
    bodyHtml: messageHtml(parsed),
    bodyText: messageBody(parsed),
    mailboxPath,
    isRead: Array.isArray(row.flags) ? row.flags.includes('\\Seen') : row.flags?.has?.('\\Seen'),
    headers: parsed.headers || new Map(),
    calendarEvent,
  };
}

export function calendarEventFromAttachments(attachments = []) {
  for (const attachment of attachments || []) {
    const text = icsTextFromAttachment(attachment);
    if (!text) continue;
    const event = parseIcsCalendarEvent(text, attachment);
    if (event) return event;
  }
  return null;
}

export function parseIcsCalendarEvent(value, attachment = {}) {
  const properties = firstIcsEventProperties(value);
  if (!properties.length) return null;

  const byName = new Map();
  for (const property of properties) {
    const rows = byName.get(property.name) || [];
    rows.push(property);
    byName.set(property.name, rows);
  }

  const prop = (name) => byName.get(name)?.[0] || null;
  const props = (name) => byName.get(name) || [];
  const start = icsDateValue(prop('DTSTART'));
  const end = icsDateValue(prop('DTEND'));
  const summary = clean(icsTextValue(prop('SUMMARY')?.value));
  const description = clean(icsTextValue(prop('DESCRIPTION')?.value));
  const location = clean(icsTextValue(prop('LOCATION')?.value));
  const conferenceUrl = firstConferenceUrl([location, description, prop('URL')?.value]);

  return {
    uid: clean(prop('UID')?.value) || null,
    method: clean(firstIcsPropertyValue(value, 'METHOD')).toUpperCase() || null,
    status: clean(prop('STATUS')?.value).toUpperCase() || null,
    sequence: numericIcsValue(prop('SEQUENCE')?.value),
    summary: summary || clean(attachment.filename) || 'Calendar invite',
    description: description || null,
    location: location || null,
    start,
    end,
    organizer: icsPersonValue(prop('ORGANIZER')),
    attendees: props('ATTENDEE').map(icsPersonValue).filter(Boolean).slice(0, 20),
    url: clean(prop('URL')?.value) || conferenceUrl || null,
    conferenceUrl,
    source: {
      filename: clean(attachment.filename) || null,
      contentType: clean(attachment.contentType) || null,
    },
  };
}

function icsTextFromAttachment(attachment = {}) {
  const filename = clean(attachment.filename).toLowerCase();
  const contentType = clean(attachment.contentType).toLowerCase();
  const isCalendar = filename.endsWith('.ics') || contentType.includes('text/calendar') || contentType.includes('application/ics');
  if (!isCalendar || !attachment.content) return '';
  if (Buffer.isBuffer(attachment.content)) return attachment.content.toString('utf8');
  return String(attachment.content || '');
}

function firstIcsEventProperties(value) {
  const lines = unfoldIcsLines(value);
  const eventLines = [];
  let inEvent = false;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      inEvent = true;
      eventLines.length = 0;
      continue;
    }
    if (upper === 'END:VEVENT' && inEvent) {
      return eventLines.map(parseIcsProperty).filter(Boolean);
    }
    if (inEvent) eventLines.push(line);
  }

  return [];
}

function unfoldIcsLines(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line.trimEnd());
      }
      return lines;
    }, [])
    .filter(Boolean);
}

function parseIcsProperty(line) {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex < 0) return null;
  const left = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const [name, ...paramParts] = left.split(';');
  const params = {};
  for (const part of paramParts) {
    const [key, ...rest] = part.split('=');
    if (!key) continue;
    params[key.toUpperCase()] = rest.join('=').replace(/^"|"$/g, '');
  }
  return { name: clean(name).toUpperCase(), params, value };
}

function firstIcsPropertyValue(value, name) {
  const prefix = `${name.toUpperCase()}:`;
  return unfoldIcsLines(value).find((line) => line.toUpperCase().startsWith(prefix))?.slice(prefix.length) || '';
}

function icsDateValue(property) {
  const raw = clean(property?.value);
  if (!raw) return null;
  const isDateOnly = property?.params?.VALUE === 'DATE' || /^\d{8}$/.test(raw);
  const timezone = clean(property?.params?.TZID) || null;
  const local = isDateOnly
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : icsLocalDateTime(raw);
  return {
    raw,
    iso: icsDateToIso(raw, isDateOnly),
    local,
    timezone,
    isDateOnly,
  };
}

function icsLocalDateTime(raw) {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/);
  if (!match) return raw;
  const [, year, month, day, hour, minute, second = '00'] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function icsDateToIso(raw, isDateOnly) {
  if (isDateOnly && /^\d{8}$/.test(raw)) {
    return new Date(Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8)))).toISOString();
  }
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00', utc] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${utc ? 'Z' : ''}`;
  const date = utc ? new Date(iso) : new Date(`${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function icsPersonValue(property) {
  if (!property) return null;
  const address = clean(property.value).replace(/^mailto:/i, '').toLowerCase();
  const name = clean(icsTextValue(property.params?.CN));
  if (!address && !name) return null;
  return {
    name,
    email: address || null,
    role: clean(property.params?.ROLE).toUpperCase() || null,
    status: clean(property.params?.PARTSTAT).toUpperCase() || null,
  };
}

function icsTextValue(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function numericIcsValue(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstConferenceUrl(values) {
  const text = values.filter(Boolean).join('\n');
  const match = text.match(/https?:\/\/[^\s<>"']*(zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com|whereby\.com|greenhouse\.io\/interview)[^\s<>"']*/i);
  return match?.[0] || null;
}

function imapMessageId(row, mailboxPath = '', parsed = null) {
  return [mailboxPath, String(row.uid || parsed?.messageId || parsed?.headers?.get('message-id') || '')].filter(Boolean).join(':');
}

function mailboxMessageRefFromId(messageId) {
  const value = clean(messageId);
  const separatorIndex = value.lastIndexOf(':');
  if (separatorIndex <= 0) return null;
  const mailboxPath = value.slice(0, separatorIndex);
  const uid = Number.parseInt(value.slice(separatorIndex + 1), 10);
  if (!mailboxPath || !Number.isFinite(uid) || uid <= 0) return null;
  return { mailboxPath, uid };
}

function assertForwardingMailboxConfigured() {
  if (!forwardingMailboxConfigured()) {
    throw new InputError('Forwarding mailbox is not configured');
  }
}

function profileMessagePage(limit, offset) {
  return {
    limit: Math.min(Math.max(Number.parseInt(limit, 10) || DEFAULT_PROFILE_MESSAGE_LIMIT, 1), MAX_MESSAGE_FETCH),
    offset: Math.max(Number.parseInt(offset, 10) || 0, 0),
  };
}

function mailboxClient() {
  return new ImapFlow({
    host: clean(ENV.MAILBOX_IMAP_HOST),
    port: mailboxPort(),
    secure: mailboxSecure(),
    auth: {
      user: clean(ENV.MAILBOX_EMAIL),
      pass: String(ENV.MAILBOX_PASSWORD || ''),
    },
    logger: false,
  });
}

function mailboxPort() {
  const port = Number(ENV.MAILBOX_IMAP_PORT || 993);
  return Number.isFinite(port) && port > 0 ? port : 993;
}

function mailboxSecure() {
  return !['0', 'false', 'no', 'off'].includes(String(ENV.MAILBOX_IMAP_SECURE ?? 'true').toLowerCase());
}

function addressList(value) {
  return Array.isArray(value) ? value.map((address) => address.address) : [];
}

function addressObjects(value) {
  return Array.isArray(value)
    ? value
        .map((address) => ({
          name: address?.name || '',
          address: normalizeEmail(address?.address),
        }))
        .filter((address) => address.address)
    : [];
}

function messageHeaderText(message) {
  const headers = message.headers;
  if (!headers) return '';
  if (headers instanceof Map) {
    return [...headers.entries()]
      .map(([name, value]) => `${name}: ${headerValueText(value)}`)
      .join('\n')
      .toLowerCase();
  }
  return String(headers).toLowerCase();
}

function messageBodyText(message) {
  return clean(message.bodyText || message.bodyHtml || message.bodyPreview || '').toLowerCase();
}

function headerValueText(value) {
  if (Array.isArray(value)) return value.map(headerValueText).join(' ');
  if (value?.text) return value.text;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value || '');
}

function serializableHeaders(headers) {
  if (!headers) return {};
  if (headers instanceof Map) {
    return Object.fromEntries([...headers.entries()].map(([name, value]) => [name, headerValueText(value)]));
  }
  if (typeof headers === 'object') return headers;
  return {};
}

function messagePreview(parsed) {
  return messageBody(parsed)
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

function messageBody(parsed) {
  return clean(parsed.text || parsed.textAsHtml || '');
}

function messageHtml(parsed) {
  const html = typeof parsed.html === 'string' ? parsed.html : '';
  return clean(html || parsed.textAsHtml || '');
}

function matcherWithSource(matcher, matchedFrom) {
  return {
    value: matcher.value,
    source: `${matcher.source}:${matchedFrom}`,
  };
}

function compareMessagesByReceivedAtDesc(left, right) {
  return (Date.parse(right.receivedAt || 0) || 0) - (Date.parse(left.receivedAt || 0) || 0);
}

function dateOrNull(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
}

function dateToIso(value) {
  const date = dateOrNull(value);
  return date ? date.toISOString() : null;
}

function rowValue(row, key) {
  if (!row) return undefined;
  return row.get?.(key) ?? row[key];
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}
