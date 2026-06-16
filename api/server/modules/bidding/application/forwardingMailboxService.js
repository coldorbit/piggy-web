import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { ENV } from '../../../../env.js';
import { getBidProfileModel } from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';
import { BIDDER_ROLES, isAdminRole } from '../../../utils/roles.js';
import { currentDbUser } from './profilesService.js';

const DEFAULT_PROFILE_MESSAGE_LIMIT = 10;
const MAX_MESSAGE_FETCH = 50;
const SKIPPED_MAILBOX_SPECIAL_USE = new Set(['\\All', '\\Drafts', '\\Junk', '\\Sent', '\\Trash']);

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

export async function mailboxProfileForRequest(req, profileId) {
  const user = await currentDbUser(req);
  return { user, profile: await mailboxProfileForUser(user, profileId) };
}

export async function currentMailboxAdmin(req) {
  const user = await currentDbUser(req);
  ensureMailboxAdmin(user);
  return user;
}

export async function listForwardedProfileMessages(profile, { limit = DEFAULT_PROFILE_MESSAGE_LIMIT } = {}) {
  assertForwardingMailboxConfigured();
  const messageLimit = profileMessageLimit(limit);
  const parsedMessages = await fetchRecentMailboxMessages(Math.min(Math.max(messageLimit * 5, 25), MAX_MESSAGE_FETCH));
  const messages = parsedMessages
    .map((message) => classifyForwardedMessage(message, [profile]))
    .filter((row) => row.profile)
    .slice(0, messageLimit)
    .map((row) => formatMailboxMessage(row.message, row.profile, row.match));

  return {
    mailbox: forwardingMailboxStatus(),
    messages,
  };
}

export async function listForwardedInboxMessages({ limit = 25 } = {}) {
  assertForwardingMailboxConfigured();
  const profiles = await getBidProfileModel().findAll({
    attributes: ['id', 'name', 'email', 'forwardingEmail'],
    where: { profileStatus: ['active', 'closed', 'legacy'] },
    order: [['name', 'ASC']],
  });
  const parsedMessages = await fetchRecentMailboxMessages(Math.min(Math.max(Number.parseInt(limit, 10) || 25, 1), MAX_MESSAGE_FETCH));

  return {
    mailbox: forwardingMailboxStatus(),
    messages: parsedMessages
      .map((message) => classifyForwardedMessage(message, profiles))
      .map((row) => formatMailboxMessage(row.message, row.profile, row.match)),
  };
}

export function formatMailboxMessage(message, profile = null, match = null) {
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
  };
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

async function ensureUserCanReadMailboxProfile(user, profile) {
  if (isAdminRole(user)) return;
  if (String(profile.userId) === String(user?.id)) return;
  throw new NotFoundError('Profile not found');
}

function ensureMailboxAdmin(user) {
  if (isAdminRole(user)) return;
  throw new InputError('Only admins can read the forwarding inbox');
}

async function fetchRecentMailboxMessages(limit) {
  const client = new ImapFlow({
    host: clean(ENV.MAILBOX_IMAP_HOST),
    port: mailboxPort(),
    secure: mailboxSecure(),
    auth: {
      user: clean(ENV.MAILBOX_EMAIL),
      pass: String(ENV.MAILBOX_PASSWORD || ''),
    },
    logger: false,
  });

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

  return {
    id: [mailboxPath, String(row.uid || parsed.messageId || parsed.headers?.get('message-id') || '')].filter(Boolean).join(':'),
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
  };
}

function assertForwardingMailboxConfigured() {
  if (!forwardingMailboxConfigured()) {
    throw new InputError('Forwarding mailbox is not configured');
  }
}

function profileMessageLimit(value) {
  return Math.min(Math.max(Number.parseInt(value, 10) || DEFAULT_PROFILE_MESSAGE_LIMIT, 1), DEFAULT_PROFILE_MESSAGE_LIMIT);
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

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}
