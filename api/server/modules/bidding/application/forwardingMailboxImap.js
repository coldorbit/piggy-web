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

import { forwardingMailboxConfigured } from './forwardingMailboxConfig.js';

export function imapMessageId(row, mailboxPath = '', parsed = null) {
  return [mailboxPath, String(row.uid || parsed?.messageId || parsed?.headers?.get('message-id') || '')].filter(Boolean).join(':');
}

export function mailboxMessageRefFromId(messageId) {
  const value = clean(messageId);
  const separatorIndex = value.lastIndexOf(':');
  if (separatorIndex <= 0) return null;
  const mailboxPath = value.slice(0, separatorIndex);
  const uid = Number.parseInt(value.slice(separatorIndex + 1), 10);
  if (!mailboxPath || !Number.isFinite(uid) || uid <= 0) return null;
  return { mailboxPath, uid };
}

export function assertForwardingMailboxConfigured() {
  if (!forwardingMailboxConfigured()) {
    throw new InputError('Forwarding mailbox is not configured');
  }
}

export function profileMessagePage(limit, offset) {
  return {
    limit: Math.min(Math.max(Number.parseInt(limit, 10) || DEFAULT_PROFILE_MESSAGE_LIMIT, 1), MAX_MESSAGE_FETCH),
    offset: Math.max(Number.parseInt(offset, 10) || 0, 0),
  };
}

export function mailboxClient() {
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

export function mailboxPort() {
  const port = Number(ENV.MAILBOX_IMAP_PORT || 993);
  return Number.isFinite(port) && port > 0 ? port : 993;
}

export function mailboxSecure() {
  return !['0', 'false', 'no', 'off'].includes(String(ENV.MAILBOX_IMAP_SECURE ?? 'true').toLowerCase());
}

export function addressList(value) {
  return Array.isArray(value) ? value.map((address) => address.address) : [];
}

export function addressObjects(value) {
  return Array.isArray(value)
    ? value
        .map((address) => ({
          name: address?.name || '',
          address: normalizeEmail(address?.address),
        }))
        .filter((address) => address.address)
    : [];
}

export function messageHeaderText(message) {
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

export function messageBodyText(message) {
  return clean(message.bodyText || message.bodyHtml || message.bodyPreview || '').toLowerCase();
}

export function headerValueText(value) {
  if (Array.isArray(value)) return value.map(headerValueText).join(' ');
  if (value?.text) return value.text;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value || '');
}

export function serializableHeaders(headers) {
  if (!headers) return {};
  if (headers instanceof Map) {
    return Object.fromEntries([...headers.entries()].map(([name, value]) => [name, headerValueText(value)]));
  }
  if (typeof headers === 'object') return headers;
  return {};
}

export function messagePreview(parsed) {
  return messageBody(parsed)
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

export function messageBody(parsed) {
  return clean(parsed.text || parsed.textAsHtml || '');
}

export function messageHtml(parsed) {
  const html = typeof parsed.html === 'string' ? parsed.html : '';
  return clean(html || parsed.textAsHtml || '');
}

export function matcherWithSource(matcher, matchedFrom) {
  return {
    value: matcher.value,
    source: `${matcher.source}:${matchedFrom}`,
  };
}

export function compareMessagesByReceivedAtDesc(left, right) {
  return (Date.parse(right.receivedAt || 0) || 0) - (Date.parse(left.receivedAt || 0) || 0);
}

export function dateOrNull(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
}

export function dateToIso(value) {
  const date = dateOrNull(value);
  return date ? date.toISOString() : null;
}

export function rowValue(row, key) {
  if (!row) return undefined;
  return row.get?.(key) ?? row[key];
}

export function normalizeEmail(value) {
  return clean(value).toLowerCase();
}
