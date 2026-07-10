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

import { parseAddressList } from './forwardingMailboxFormatting.js';
import { calendarEventFromAttachments } from './forwardingMailboxCalendar.js';
import { imapMessageId, messageBody, messageHtml, messagePreview } from './forwardingMailboxImap.js';

export function searchableMessageText(message) {
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

export function isDeclinedMessageText(text) {
  const strongDeclinePatterns = [
    /unfortunately[\s\S]{0,240}(not|unable|won't|will not|cannot|can't)/i,
    /(not selected|not be selected|not chosen|pursue other candidates|other candidates|another candidate)/i,
    /(regret to inform|we regret|sorry to inform)/i,
    /(application|candidacy)[\s\S]{0,120}(declined|unsuccessful|rejected)/i,
  ];
  if (strongDeclinePatterns.some((pattern) => pattern.test(text))) return true;

  const conditionalApplicationInstructionPatterns = [
    /if you did not[\s\S]{0,80}(proceed|complete|finish)[\s\S]{0,120}(final step|application process|form)/i,
    /if you did not apply[\s\S]{0,120}(email in error|remove yourself)/i,
  ];
  if (conditionalApplicationInstructionPatterns.some((pattern) => pattern.test(text))) return false;

  return /(not|no longer|won't|will not)[\s\S]{0,120}(move forward|proceed|be proceeding|continue|advance)/i.test(text);
}

export function isApplicationConfirmationText(text) {
  return [
    /(thank you|thanks)[\s\S]{0,80}(applying|application)/i,
    /(application|resume)[\s\S]{0,80}(received|submitted|successfully submitted)/i,
    /we (have )?received your (job )?application/i,
    /your application (has been|was) (received|submitted)/i,
    /you applied (to|for)/i,
  ].some((pattern) => pattern.test(text));
}

export function isAssessmentLinkText(text) {
  return [
    /\b(assessment|coding challenge|take[-\s]?home|hackerrank|codility|codesignal|criteriacorp|testgorilla)\b/i,
    /\b(online|technical|coding|skills?|aptitude|pre-employment)\s+(assessment|test|challenge)\b/i,
    /\b(assessment|test|challenge)\b[\s\S]{0,120}\b(link|url|complete|submit|finish|expires|deadline|due)\b/i,
    /\b(complete|submit|finish|expires|deadline|due)\b[\s\S]{0,120}\b(assessment|test|challenge)\b/i,
  ].some((pattern) => pattern.test(text));
}

export function isInterviewInviteText(text) {
  return [
    /(interview|phone screen|recruiter screen|technical screen|onsite|final round)/i,
    /(schedule|scheduled|invite|calendar|availability|available times|meet with|speak with|zoom|google meet|teams)/i,
  ].every((pattern) => pattern.test(text));
}

export function isRecruiterReplyText(text) {
  return [
    /(recruiter|talent acquisition|hiring team|hiring manager|people team)/i,
    /(following up|next steps|availability|would like to|interested|learn more|connect|chat|call)/i,
  ].every((pattern) => pattern.test(text));
}

export function normalizedMatchingText(value) {
  return clean(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
    .slice(0, 30000);
}

export function htmlToText(value) {
  return clean(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
}

export async function fetchRecentMailboxMessagesFromPath(client, mailboxPath, limit) {
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

export async function readableMailboxPaths(client) {
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

export function isReadableMailbox(folder) {
  if (!folder?.path) return false;
  if (folder.flags?.has?.('\\Noselect')) return false;
  if (folder.specialUse && SKIPPED_MAILBOX_SPECIAL_USE.has(folder.specialUse)) return false;
  return true;
}

export function uniqueMailboxPaths(paths) {
  const byKey = new Map();
  for (const path of paths) {
    const value = clean(path);
    if (!value) continue;
    byKey.set(value.toLowerCase(), value);
  }
  return [...byKey.values()];
}

export function dedupeMessages(messages) {
  const byKey = new Map();
  for (const message of messages) {
    const key = message.id || `${message.mailboxPath}:${message.receivedAt}:${message.subject}`;
    if (!byKey.has(key)) byKey.set(key, message);
  }
  return [...byKey.values()];
}

export async function parseImapMessage(row, mailboxPath = '') {
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
