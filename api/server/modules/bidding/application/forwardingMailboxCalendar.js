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

export function icsTextFromAttachment(attachment = {}) {
  const filename = clean(attachment.filename).toLowerCase();
  const contentType = clean(attachment.contentType).toLowerCase();
  const isCalendar = filename.endsWith('.ics') || contentType.includes('text/calendar') || contentType.includes('application/ics');
  if (!isCalendar || !attachment.content) return '';
  if (Buffer.isBuffer(attachment.content)) return attachment.content.toString('utf8');
  return String(attachment.content || '');
}

export function firstIcsEventProperties(value) {
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

export function unfoldIcsLines(value) {
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

export function parseIcsProperty(line) {
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

export function firstIcsPropertyValue(value, name) {
  const prefix = `${name.toUpperCase()}:`;
  return unfoldIcsLines(value).find((line) => line.toUpperCase().startsWith(prefix))?.slice(prefix.length) || '';
}

export function icsDateValue(property) {
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

export function icsLocalDateTime(raw) {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/);
  if (!match) return raw;
  const [, year, month, day, hour, minute, second = '00'] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function icsDateToIso(raw, isDateOnly) {
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

export function icsPersonValue(property) {
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

export function icsTextValue(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

export function numericIcsValue(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function firstConferenceUrl(values) {
  const text = values.filter(Boolean).join('\n');
  const match = text.match(/https?:\/\/[^\s<>"']*(zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com|whereby\.com|greenhouse\.io\/interview)[^\s<>"']*/i);
  return match?.[0] || null;
}
