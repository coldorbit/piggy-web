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

import { storedMailboxMessageOrder } from './forwardingMailboxPersistence.js';
import { isApplicationConfirmationText, isAssessmentLinkText, isDeclinedMessageText, isInterviewInviteText, isRecruiterReplyText, searchableMessageText } from './forwardingMailboxClassification.js';
import { addressList, addressObjects, dateOrNull, dateToIso, mailboxMessageRefFromId, matcherWithSource, messageBodyText, messageHeaderText, normalizeEmail, rowValue, serializableHeaders } from './forwardingMailboxImap.js';

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
  const storedClassification = rowValue(row, 'classification') || null;
  const match = rowValue(row, 'matchValue')
    ? {
        value: rowValue(row, 'matchValue'),
        source: rowValue(row, 'matchSource') || '',
      }
    : null;

  return formatMailboxMessage(message, profile, match, {
    classification: normalizedStoredMailboxClassification(message, storedClassification),
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
    return mailboxClassification('interview_invite', 'Interview invite', 'Add or confirm the interview time, meeting link, and caller assignment.', 0.95);
  }

  const text = searchableMessageText(message);
  if (!text) return null;

  if (isDeclinedMessageText(text)) {
    return mailboxClassification('declined', 'Declined email', 'Mark the application lost or stale and stop follow-ups.', 0.9);
  }
  if (isApplicationConfirmationText(text)) {
    return mailboxClassification('application_confirmation', 'Application confirmation', 'Confirm the matching application is submitted.', 0.88);
  }
  if (isAssessmentLinkText(text)) {
    return mailboxClassification('assessment_link', 'Assessment link', 'Create an assessment item and complete it before expiration.', 0.86);
  }
  if (isInterviewInviteText(text)) {
    return mailboxClassification('interview_invite', 'Interview invite', 'Add the interview to the calendar, capture the meeting link, and assign a caller.', 0.82);
  }
  if (isRecruiterReplyText(text)) {
    return mailboxClassification('recruiter_reply', 'Recruiter reply', 'Review the reply and choose the next follow-up or scheduling step.', 0.72);
  }
  return null;
}

export function mailboxClassification(type, label, suggestedAction, confidence) {
  return { type, label, suggestedAction, confidence };
}

export function normalizedStoredMailboxClassification(message, classification) {
  if (!['assessment_link', 'declined'].includes(classification?.type)) return classification || null;
  return classifyMailboxMessageIntent(message);
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

export async function mailboxProfileForUser(user, profileId) {
  if (BIDDER_ROLES.includes(user?.role)) throw new InputError('Bidders cannot read profile inboxes');

  const id = clean(profileId);
  if (!id) throw new InputError('Profile is required');

  const profile = await getBidProfileModel().findByPk(id);
  if (!profile) throw new NotFoundError('Profile not found');
  await ensureUserCanReadMailboxProfile(user, profile);
  return profile;
}

export async function mailboxNotificationProfilesForUser(user) {
  if (CALLER_BLOCKED_ROLES.includes(user?.role)) throw new InputError('This role cannot read profile inboxes');
  const profiles = isAdminRole(user)
    ? await profilesManagedByUser(user)
    : await profilesVisibleToUser(user);

  return profiles
    .filter((profile) => ['active', 'closed', 'legacy'].includes(profile?.profileStatus || 'active'))
    .filter((profile) => profileMailboxMatchers(profile).length);
}

export async function ensureUserCanReadMailboxProfile(user, profile) {
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

export async function storedForwardedProfileMessagePage(profile, { limit, offset }) {
  const where = profileMailboxMessageWhere(profile);
  return storedForwardedMailboxMessagePage(where, { limit, offset, profiles: [profile] });
}

export async function storedForwardedMailboxMessagePageForProfiles(profiles, { limit, offset }) {
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

export async function unreadMailboxCountsByProfile(profiles) {
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

export async function mailboxStatsByProfile(profiles) {
  const statsByProfileId = new Map(profiles.map((profile) => [String(profile.id), emptyMailboxStats()]));
  if (!profiles.length) return statsByProfileId;

  const profileIds = profiles.map((profile) => profile.id).filter(Boolean);
  const aliasProfileIds = new Map();
  for (const profile of profiles) {
    for (const matcher of profileMailboxMatchers(profile)) {
      const ids = aliasProfileIds.get(matcher.value) || [];
      ids.push(String(profile.id));
      aliasProfileIds.set(matcher.value, ids);
    }
  }
  const aliases = [...aliasProfileIds.keys()];
  const Message = getForwardedMailboxMessageModel();
  const [aliasRows, legacyRows] = await Promise.all([
    aliases.length
      ? Message.findAll({
          attributes: ['matchValue', ...mailboxStatsAttributes()],
          where: { matchValue: { [Op.in]: aliases } },
          group: ['matchValue'],
          raw: true,
        })
      : [],
    profileIds.length
      ? Message.findAll({
          attributes: ['profileId', ...mailboxStatsAttributes()],
          where: {
            profileId: { [Op.in]: profileIds },
            [Op.or]: [{ matchValue: { [Op.is]: null } }, { matchValue: '' }],
          },
          group: ['profileId'],
          raw: true,
        })
      : [],
  ]);

  for (const row of aliasRows) {
    for (const profileId of aliasProfileIds.get(normalizeEmail(row.matchValue)) || []) {
      statsByProfileId.set(profileId, addMailboxStats(statsByProfileId.get(profileId), mailboxStatsFromRow(row)));
    }
  }
  for (const row of legacyRows) {
    const profileId = String(row.profileId);
    statsByProfileId.set(profileId, addMailboxStats(statsByProfileId.get(profileId), mailboxStatsFromRow(row)));
  }
  return statsByProfileId;
}

export async function mailboxStatsForWhere(where) {
  if (!where) return emptyMailboxStats();

  const row = await getForwardedMailboxMessageModel().findOne({
    attributes: mailboxStatsAttributes(),
    where,
    raw: true,
  });
  return mailboxStatsFromRow(row);
}

function mailboxStatsAttributes() {
  return [
    [literal('COUNT(*)'), 'total'],
    [literal('COUNT(*) FILTER (WHERE is_read = false)'), 'unreadTotal'],
    [literal("COUNT(*) FILTER (WHERE classification->>'type' IN ('interview_invite', 'interview_related') OR calendar_event IS NOT NULL)"), 'interviewTotal'],
    [literal("COUNT(*) FILTER (WHERE classification->>'type' = 'application_confirmation')"), 'confirmationTotal'],
    [literal("COUNT(*) FILTER (WHERE classification->>'type' = 'declined')"), 'declinedTotal'],
    [literal("COUNT(*) FILTER (WHERE application->>'status' IN ('applied', 'already_applied'))"), 'autoAppliedTotal'],
  ];
}

function mailboxStatsFromRow(row = {}) {
  return {
    total: Number(row?.total || 0),
    unreadTotal: Number(row?.unreadTotal || 0),
    interviewTotal: Number(row?.interviewTotal || 0),
    confirmationTotal: Number(row?.confirmationTotal || 0),
    declinedTotal: Number(row?.declinedTotal || 0),
    autoAppliedTotal: Number(row?.autoAppliedTotal || 0),
  };
}

function addMailboxStats(left = emptyMailboxStats(), right = emptyMailboxStats()) {
  return Object.fromEntries(Object.keys(emptyMailboxStats()).map((key) => [key, Number(left[key] || 0) + Number(right[key] || 0)]));
}

export function emptyMailboxStats() {
  return {
    total: 0,
    unreadTotal: 0,
    interviewTotal: 0,
    confirmationTotal: 0,
    declinedTotal: 0,
    autoAppliedTotal: 0,
  };
}

export function interviewMailboxStatsCondition() {
  return {
    [Op.or]: [
      jsonTextInCondition('classification', 'type', ['interview_invite', 'interview_related']),
      literal('calendar_event IS NOT NULL'),
    ],
  };
}

export function jsonTextEqualsCondition(column, key, value) {
  return literal(`${jsonTextExpression(column, key)} = ${getSequelize().escape(value)}`);
}

export function jsonTextInCondition(column, key, values) {
  const escapedValues = values.map((value) => getSequelize().escape(value)).join(', ');
  return literal(`${jsonTextExpression(column, key)} IN (${escapedValues})`);
}

export function jsonTextExpression(column, key) {
  return `${column}->>${getSequelize().escape(key)}`;
}

export function profileMailboxMessageWhere(profile, additionalWhere = {}) {
  const conditions = profileMailboxMessageConditions(profile);
  if (!conditions.length) return null;
  return {
    ...additionalWhere,
    [Op.or]: conditions,
  };
}

export function mailboxProfilesMessageWhere(profiles, additionalWhere = {}) {
  const conditions = profiles.flatMap(profileMailboxMessageConditions);
  if (!conditions.length) return null;
  return {
    ...additionalWhere,
    [Op.or]: conditions,
  };
}

export function profileMailboxMessageConditions(profile) {
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

export function mailboxProfileForStoredRow(row, profiles) {
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

export async function storedForwardedMailboxMessagePage(where, { limit, offset, profiles = [] }) {
  const [messages, stats] = await Promise.all([
    getForwardedMailboxMessageModel().findAll({
      where,
      include: [storedMailboxProfileInclude()],
      limit,
      offset,
      order: storedMailboxMessageOrder(),
    }),
    mailboxStatsForWhere(where),
  ]);

  return {
    messages: messages.map((row) => formatStoredMailboxMessage(row, mailboxProfileForStoredRow(row, profiles))),
    total: stats.total,
    unreadTotal: stats.unreadTotal,
  };
}

export async function upsertForwardedMailboxMessage(message, profile = null, match = null, options = {}) {
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

export function mailboxMessageFromStoredRow(row) {
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

export function storedMailboxProfileInclude() {
  return {
    model: getBidProfileModel(),
    as: 'profile',
    required: false,
    attributes: ['id', 'name', 'email', 'forwardingEmail'],
  };
}
