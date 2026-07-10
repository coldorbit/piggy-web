import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import {
  Alert,
  Avatar,
  Badge as MuiBadge,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { AutoSizer, List as VirtualizedList } from 'react-virtualized';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { useBidProfiles, useForwardedMailboxMessages, useForwardedMailboxSummary, useForwardedProfileMessages, useForwardingMailboxStatus, useMarkProfileMailboxMessageRead } from '../lib/api.js';
import { isAdminRole } from '../lib/roles.js';

const INBOX_MESSAGE_ACCENT = { main: '#0067C0', soft: '#E0ECFF', dark: '#005A9E' };
const DECLINED_ACCENT = { main: '#E11D48', soft: '#FFF1F2', dark: '#BE123C' };
const CONFIRMATION_ACCENT = { main: '#486860', soft: '#ECFDF5', dark: '#047857' };
const INTERVIEW_ACCENT = { main: '#7C3AED', soft: '#F3E8FF', dark: '#6D28D9' };
const COMPACT_MESSAGE_ROW_HEIGHT = 96;
const MAILBOX_GROUPS = Object.freeze({
  inbox: 'inbox',
  unread: 'unread',
  interviews: 'interviews',
  confirmations: 'confirmations',
  declined: 'declined',
  autoApplied: 'auto-applied',
});
const MAILBOX_GROUP_VALUES = new Set(Object.values(MAILBOX_GROUPS));


export function ReadingPane({ activeColor, configured, isLoading, message, profile }) {
  if (isLoading) return <ReadingPaneSkeleton />;

  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: { xs: 360, lg: 0 },
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#ffffff',
      }}
    >
      {!message ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3 }}>
          <EmptyState
            title={configured ? 'No message selected' : 'Mailbox unavailable'}
            detail={configured ? 'Messages for the selected profile will open here.' : 'Forwarding mailbox settings are required before messages can load.'}
            variant="plain"
            sx={{ bgcolor: 'transparent' }}
          />
        </Box>
      ) : (
        <>
          <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'flex-start' }} justifyContent="space-between" spacing={1.5}>
              <Box minWidth={0}>
                <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.25 }}>
                  {message.subject || '(No subject)'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {formatMessageDate(message.receivedAt)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: { sm: 'flex-end' } }}>
                {isInterviewClassification(message) ? (
                  <Chip label="Interview" size="small" sx={smallChipSx(INTERVIEW_ACCENT.soft, INTERVIEW_ACCENT.dark)} />
                ) : null}
                {message.classification?.type === 'declined' ? <Chip label="Declined" size="small" sx={smallChipSx(DECLINED_ACCENT.soft, DECLINED_ACCENT.dark)} /> : null}
                {message.classification?.type === 'application_confirmation' ? (
                  <Chip label={applicationChipLabel(message.application)} size="small" sx={smallChipSx(CONFIRMATION_ACCENT.soft, CONFIRMATION_ACCENT.dark)} />
                ) : null}
                {message.classification?.type === 'assessment_link' ? <Chip label="Assessment" size="small" sx={smallChipSx('#FEF3C7', '#92400E')} /> : null}
                {message.classification?.type === 'recruiter_reply' ? <Chip label="Recruiter reply" size="small" sx={smallChipSx('#E0ECFF', '#005A9E')} /> : null}
                {message.match?.source ? <Chip label={matchSourceLabel(message.match.source)} size="small" sx={smallChipSx(activeColor.soft, activeColor.dark)} /> : null}
                {message.mailboxPath ? <Chip label={message.mailboxPath} size="small" variant="outlined" sx={smallOutlinedChipSx} /> : null}
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Avatar sx={{ width: 38, height: 38, bgcolor: activeColor.main }}>
                <PersonOutlinedIcon fontSize="small" />
              </Avatar>
              <Box minWidth={0} flex={1}>
                <Typography fontWeight={600} noWrap>{messageSender(message)}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  To {profile?.forwardingEmail || profile?.email || 'profile inbox'}
                </Typography>
              </Box>
              <MailOutlinedIcon sx={{ color: 'text.secondary', mt: 0.5 }} fontSize="small" />
            </Stack>
          </Box>

          {message.classification?.type === 'application_confirmation' ? (
            <ApplicationConfirmationInfo application={message.application} />
          ) : null}
          {message.classification?.suggestedAction ? <SuggestedActionInfo classification={message.classification} /> : null}
          {message.calendarEvent ? <CalendarInviteInfo event={message.calendarEvent} /> : null}

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', bgcolor: '#ffffff' }}>
            {message.bodyHtml ? (
              <EmailHtmlFrame html={message.bodyHtml} title={message.subject || 'Email message'} />
            ) : (
              <Box sx={{ height: '100%', overflowY: 'auto', px: { xs: 1.5, md: 2 }, py: 2 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.primary',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    maxWidth: 760,
                  }}
                >
                  {message.bodyPreview || 'No message preview available.'}
                </Typography>
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

export function ApplicationConfirmationInfo({ application }) {
  const detail = applicationDetailText(application);
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: CONFIRMATION_ACCENT.soft }}>
      <Typography variant="body2" fontWeight={600} color={CONFIRMATION_ACCENT.dark}>
        Application confirmation
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

export function CalendarInviteInfo({ event }) {
  const timeLabel = calendarEventTimeLabel(event);
  const organizerLabel = event.organizer?.name || event.organizer?.email || '';
  const attendeeCount = Array.isArray(event.attendees) ? event.attendees.length : 0;
  const locationLabel = event.location || event.conferenceUrl || '';

  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.25, borderBottom: 1, borderColor: 'divider', bgcolor: '#FAF5FF' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '56px minmax(0, 1fr) auto' },
          gap: 1.25,
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            border: 1,
            borderColor: '#DDD6FE',
            borderRadius: 1,
            bgcolor: '#ffffff',
            overflow: 'hidden',
            display: { xs: 'none', sm: 'grid' },
            gridTemplateRows: '20px 1fr',
            boxShadow: '0 8px 18px rgba(109, 40, 217, 0.12)',
          }}
        >
          <Box sx={{ bgcolor: INTERVIEW_ACCENT.main, color: '#ffffff', display: 'grid', placeItems: 'center' }}>
            <Typography variant="caption" fontWeight={600} sx={{ fontSize: 10 }}>
              {calendarEventMonth(event)}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', placeItems: 'center' }}>
            <Typography fontWeight={600} sx={{ color: INTERVIEW_ACCENT.dark }}>
              {calendarEventDay(event)}
            </Typography>
          </Box>
        </Box>

        <Box minWidth={0}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: INTERVIEW_ACCENT.dark }}>
            <CalendarMonthOutlinedIcon fontSize="small" />
            <Typography variant="caption" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
              Calendar invite
            </Typography>
          </Stack>
          <Typography fontWeight={600} sx={{ mt: 0.25 }} noWrap>
            {event.summary || 'Interview'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {timeLabel}
          </Typography>
          {organizerLabel ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              Organizer: {organizerLabel}
            </Typography>
          ) : null}
        </Box>

        <Stack spacing={0.5} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
          {event.conferenceUrl ? (
            <Box
              component="a"
              href={event.conferenceUrl}
              target="_blank"
              rel="noreferrer"
              sx={{
                minHeight: 32,
                px: 1.25,
                borderRadius: 1,
                bgcolor: INTERVIEW_ACCENT.main,
                color: '#ffffff',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                fontSize: 13,
                fontWeight: 600,
                '&:hover': { bgcolor: INTERVIEW_ACCENT.dark },
              }}
            >
              <VideocamOutlinedIcon fontSize="small" />
              Join
            </Box>
          ) : null}
          {locationLabel ? (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary', maxWidth: { sm: 240 } }}>
              <PlaceOutlinedIcon fontSize="small" />
              <Typography variant="caption" noWrap>{locationLabel}</Typography>
            </Stack>
          ) : null}
          {attendeeCount ? (
            <Typography variant="caption" color="text.secondary">
              {attendeeCount.toLocaleString()} attendee{attendeeCount === 1 ? '' : 's'}
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}

export function EmailHtmlFrame({ html, title }) {
  return (
    <Box
      component="iframe"
      title={title}
      sandbox=""
      srcDoc={emailFrameDocument(html)}
      sx={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: { xs: 420, lg: '100%' },
        border: 0,
        bgcolor: '#ffffff',
      }}
    />
  );
}

export function ProfileFolderSkeletons() {
  return Array.from({ length: 5 }).map((_, index) => (
    <Box key={`profile-folder-loading-${index}`} sx={{ px: 1, py: 0.75 }}>
      <Skeleton width="70%" />
      <Skeleton width="90%" />
    </Box>
  ));
}

export function InboxMessageSkeletonList() {
  return (
    <Box sx={{ display: 'grid' }}>
      {Array.from({ length: 7 }).map((_, index) => (
        <Box key={`inbox-message-loading-${index}`} sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Stack spacing={0.7}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Skeleton width="45%" />
              <Skeleton width={44} />
            </Stack>
            <Skeleton width="72%" />
            <Skeleton width="88%" />
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

export function ReadingPaneSkeleton() {
  return (
    <Box sx={{ p: 2, display: 'grid', gap: 2 }}>
      <Skeleton width="62%" height={34} />
      <Stack direction="row" spacing={1.25}>
        <Skeleton variant="circular" width={38} height={38} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="34%" />
          <Skeleton width="52%" />
        </Box>
      </Stack>
      <Skeleton variant="rounded" height={160} />
      <Skeleton width="80%" />
      <Skeleton width="64%" />
    </Box>
  );
}

export function filterMessages(messages, search) {
  const query = String(search || '').trim().toLowerCase();
  if (!query) return messages;
  return messages.filter((message) =>
    [
      message.subject,
      message.bodyPreview,
      message.bodyHtml,
      messageSender(message),
      message.receivedAt,
      message.mailboxPath,
      message.match?.value,
      message.classification?.label,
      message.application?.status,
      message.application?.jobTitle,
      message.application?.company,
      message.calendarEvent?.summary,
      message.calendarEvent?.location,
      message.calendarEvent?.organizer?.name,
      message.calendarEvent?.organizer?.email,
    ].some((value) => String(value || '').toLowerCase().includes(query)),
  );
}

export function profileHasMailboxMatcher(profile) {
  return Boolean(profile?.forwardingEmail || profile?.email);
}

export function profileMailboxAddress(profile) {
  return profile?.forwardingEmail || profile?.email || '';
}

export function filterMessagesByGroup(messages, group) {
  switch (normalizedMailboxGroup(group)) {
    case MAILBOX_GROUPS.unread:
      return messages.filter((message) => !message.isRead);
    case MAILBOX_GROUPS.interviews:
      return messages.filter((message) => isInterviewClassification(message) || Boolean(message.calendarEvent));
    case MAILBOX_GROUPS.confirmations:
      return messages.filter((message) => message.classification?.type === 'application_confirmation');
    case MAILBOX_GROUPS.declined:
      return messages.filter((message) => message.classification?.type === 'declined');
    case MAILBOX_GROUPS.autoApplied:
      return messages.filter((message) => ['applied', 'already_applied'].includes(message.application?.status));
    case MAILBOX_GROUPS.inbox:
    default:
      return messages;
  }
}

export function mailboxGroupTotal(stats, group) {
  switch (normalizedMailboxGroup(group)) {
    case MAILBOX_GROUPS.unread:
      return stats.unreadTotal;
    case MAILBOX_GROUPS.interviews:
      return stats.interviewTotal;
    case MAILBOX_GROUPS.confirmations:
      return stats.confirmationTotal;
    case MAILBOX_GROUPS.declined:
      return stats.declinedTotal;
    case MAILBOX_GROUPS.autoApplied:
      return stats.autoAppliedTotal;
    case MAILBOX_GROUPS.inbox:
    default:
      return stats.total;
  }
}

export function mailboxGroupLabel(group) {
  switch (normalizedMailboxGroup(group)) {
    case MAILBOX_GROUPS.unread:
      return 'Unread';
    case MAILBOX_GROUPS.interviews:
      return 'Interviews';
    case MAILBOX_GROUPS.confirmations:
      return 'Confirmations';
    case MAILBOX_GROUPS.declined:
      return 'Declined';
    case MAILBOX_GROUPS.autoApplied:
      return 'Auto-applied';
    case MAILBOX_GROUPS.inbox:
    default:
      return 'Inbox';
  }
}

export function normalizedMailboxGroup(value) {
  return MAILBOX_GROUP_VALUES.has(value) ? value : MAILBOX_GROUPS.inbox;
}

export function dedupeMessagesById(messages) {
  const byId = new Map();
  for (const message of messages) {
    const id = String(message?.id || '');
    if (id && !byId.has(id)) byId.set(id, message);
  }
  return [...byId.values()];
}

export function mailboxStatsFromPages(pages, messages) {
  const loadedTotal = messages.length;
  const loadedUnreadTotal = messages.filter((message) => !message.isRead).length;
  const interviewTotal = messages.filter((message) => isInterviewClassification(message) || Boolean(message.calendarEvent)).length;
  const confirmationTotal = messages.filter((message) => message.classification?.type === 'application_confirmation').length;
  const declinedTotal = messages.filter((message) => message.classification?.type === 'declined').length;
  const autoAppliedTotal = messages.filter((message) => ['applied', 'already_applied'].includes(message.application?.status)).length;
  const firstPagination = pages.find((page) => page?.pagination)?.pagination || {};
  return {
    total: Math.max(Number(firstPagination.total || 0), loadedTotal),
    unreadTotal: Math.max(Number(firstPagination.unreadTotal || 0), loadedUnreadTotal),
    interviewTotal,
    confirmationTotal,
    declinedTotal,
    autoAppliedTotal,
  };
}

export function mailboxStatsFromSummary({ activeProfileId, fallbackStats, isAggregateInbox, mailboxSummary }) {
  if (isAggregateInbox) return normalizeMailboxStats(mailboxSummary?.stats, fallbackStats);
  const profileSummary = (mailboxSummary?.profiles || []).find((profile) => String(profile.id) === String(activeProfileId));
  return normalizeMailboxStats(profileSummary?.stats, fallbackStats);
}

export function normalizeMailboxStats(stats, fallbackStats = {}) {
  return {
    total: Math.max(Number(stats?.total || 0), Number(fallbackStats.total || 0)),
    unreadTotal: Math.max(Number(stats?.unreadTotal || 0), Number(fallbackStats.unreadTotal || 0)),
    interviewTotal: Math.max(Number(stats?.interviewTotal || 0), Number(fallbackStats.interviewTotal || 0)),
    confirmationTotal: Math.max(Number(stats?.confirmationTotal || 0), Number(fallbackStats.confirmationTotal || 0)),
    declinedTotal: Math.max(Number(stats?.declinedTotal || 0), Number(fallbackStats.declinedTotal || 0)),
    autoAppliedTotal: Math.max(Number(stats?.autoAppliedTotal || 0), Number(fallbackStats.autoAppliedTotal || 0)),
  };
}

export function SuggestedActionInfo({ classification }) {
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.25, borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(246, 248, 251, 0.86)' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        Suggested next action
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
        {classification.suggestedAction}
      </Typography>
      {classification.confidence ? (
        <Typography variant="caption" color="text.secondary">
          Confidence {Math.round(Number(classification.confidence || 0) * 100)}%
        </Typography>
      ) : null}
    </Box>
  );
}

export function isInterviewClassification(message) {
  return ['interview_related', 'interview_invite'].includes(message?.classification?.type);
}

export function classificationAccent(message) {
  const type = message?.classification?.type;
  if (type === 'declined') return DECLINED_ACCENT;
  if (type === 'application_confirmation') return CONFIRMATION_ACCENT;
  if (type === 'interview_invite' || type === 'interview_related') return INTERVIEW_ACCENT;
  if (type === 'assessment_link') return { soft: '#FEF3C7', dark: '#92400E' };
  return INBOX_MESSAGE_ACCENT;
}

export function applicationChipLabel(application) {
  if (!application) return 'Confirmation';
  if (application.status === 'applied') return 'Auto-applied';
  if (application.status === 'already_applied') return 'Already applied';
  if (application.status === 'job_not_found') return 'No job match';
  if (application.status === 'ambiguous_job_match') return 'Needs review';
  return 'Confirmation';
}

export function applicationDetailText(application) {
  if (!application) return 'This looks like an application confirmation.';
  const jobLabel = [application.jobTitle, application.company].filter(Boolean).join(' at ');
  if (application.status === 'applied') return `Marked ${jobLabel || 'the matching job'} as applied.`;
  if (application.status === 'already_applied') return `${jobLabel || 'The matching job'} was already marked as applied.`;
  if (application.status === 'job_not_found') return 'No matching job was found from this email text.';
  if (application.status === 'ambiguous_job_match') return 'Multiple company/title matches were found, so no job was changed.';
  if (application.status === 'skipped_existing_status') return `${jobLabel || 'The matching job'} has a status that was left unchanged.`;
  return 'This looks like an application confirmation.';
}

export function emailFrameDocument(html) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base target="_blank">
  <style>
    html, body {
      margin: 0;
      padding: 12px;
      background: #ffffff;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      overflow-wrap: anywhere;
    }
    img, video, canvas, svg {
      max-width: 100% !important;
      height: auto !important;
    }
    table {
      max-width: 100% !important;
    }
    a {
      color: #2563eb;
    }
  </style>
</head>
<body>${html || ''}</body>
</html>`;
}

export function messageSender(message) {
  const from = message.from || {};
  if (from.name && from.address) return `${from.name} <${from.address}>`;
  return from.name || from.address || 'Unknown sender';
}

export function messageSenderName(message) {
  return message.from?.name || message.from?.address || 'Unknown sender';
}

export function formatMessageDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function calendarEventTimeLabel(event) {
  const start = calendarDateLabel(event?.start);
  const end = calendarDateLabel(event?.end, { omitDateWhenSameDayAs: event?.start });
  if (start && end) return `${start} - ${end}`;
  return start || end || 'Time to be announced';
}

export function calendarEventMonth(event) {
  const date = calendarDateObject(event?.start || event?.end);
  if (!date) return '';
  return date.toLocaleString([], { month: 'short' }).toUpperCase();
}

export function calendarEventDay(event) {
  const date = calendarDateObject(event?.start || event?.end);
  if (!date) return '';
  return String(date.getDate());
}

export function calendarDateLabel(value, options = {}) {
  const date = calendarDateObject(value);
  if (!date) return '';
  const sameDay = options.omitDateWhenSameDayAs && calendarDateKey(value) === calendarDateKey(options.omitDateWhenSameDayAs);
  const formatterOptions = value?.isDateOnly
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : sameDay
      ? { hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };
  const timezone = value?.timezone ? ` ${value.timezone}` : '';
  return `${date.toLocaleString([], formatterOptions)}${timezone}`;
}

export function calendarDateObject(value) {
  if (!value) return null;
  const local = String(value.local || '');
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }
  const date = value.iso ? new Date(value.iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function calendarDateKey(value) {
  const date = calendarDateObject(value);
  if (!date) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatMessageDateShort(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
  });
}

export function matchSourceLabel(value) {
  if (String(value).startsWith('forwardingEmail')) return 'Forwarding alias';
  if (String(value).startsWith('profileEmail')) return 'Profile email';
  return 'Matched';
}

export function smallChipSx(bgcolor, color) {
  return {
    height: 22,
    fontSize: 11,
    fontWeight: 600,
    bgcolor,
    color,
    '& .MuiChip-label': { px: 0.75 },
  };
}

export const smallOutlinedChipSx = {
  height: 22,
  fontSize: 11,
  fontWeight: 600,
  bgcolor: '#ffffff',
  '& .MuiChip-label': { px: 0.75 },
};

export const unreadIconBadgeSx = {
  '& .MuiBadge-badge': {
    minWidth: 16,
    height: 16,
    px: 0.45,
    border: '2px solid #ffffff',
    bgcolor: '#C42B1C',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1,
  },
};
