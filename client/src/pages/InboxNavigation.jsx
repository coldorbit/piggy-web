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

import { ProfileFolderSkeletons, profileMailboxAddress } from './InboxReadingPane.jsx';

export function MailboxSidebar({
  activeColor,
  activeMailboxGroup,
  activeProfile,
  autoAppliedCount,
  confirmationCount,
  declinedCount,
  interviewCount,
  isAggregateInbox,
  inboxProfiles,
  isLoading,
  mailboxEmail,
  messagesCount,
  profileUnreadCountsById,
  onAllProfilesSelect,
  onGroupChange,
  onProfileChange,
  statusLoading,
  unifiedUnreadCount,
  unreadCount,
}) {
  return (
    <Box
      sx={{
        borderRight: { lg: 1 },
        borderBottom: { xs: 1, lg: 0 },
        borderColor: 'divider',
        bgcolor: 'rgba(246, 248, 251, 0.86)',
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 1.5, py: 1.25, display: 'grid', gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: activeColor.main }}>
            <InboxIcon fontSize="small" />
          </Avatar>
          <Box minWidth={0}>
            <Typography fontWeight={600} lineHeight={1.1}>Mailbox</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{mailboxEmail}</Typography>
          </Box>
          {statusLoading ? <CircularProgress size={16} sx={{ ml: 'auto' }} /> : null}
        </Stack>
      </Box>

      <Box sx={{ px: 0.75, display: 'grid', gap: 0.25 }}>
        <MailboxNavRow
          icon={<InboxIcon fontSize="small" />}
          label="Inbox"
          count={messagesCount}
          badgeContent={unreadCount}
          selected={activeMailboxGroup === MAILBOX_GROUPS.inbox}
          onClick={() => onGroupChange(MAILBOX_GROUPS.inbox)}
        />
        <MailboxNavRow
          icon={<MarkEmailUnreadIcon fontSize="small" />}
          label="Unread"
          count={unreadCount}
          selected={activeMailboxGroup === MAILBOX_GROUPS.unread}
          onClick={() => onGroupChange(MAILBOX_GROUPS.unread)}
        />
        <MailboxNavRow
          icon={<CalendarMonthOutlinedIcon fontSize="small" />}
          label="Interviews"
          count={interviewCount}
          selected={activeMailboxGroup === MAILBOX_GROUPS.interviews}
          onClick={() => onGroupChange(MAILBOX_GROUPS.interviews)}
        />
        <MailboxNavRow
          icon={<MailOutlinedIcon fontSize="small" />}
          label="Confirmations"
          count={confirmationCount}
          selected={activeMailboxGroup === MAILBOX_GROUPS.confirmations}
          onClick={() => onGroupChange(MAILBOX_GROUPS.confirmations)}
        />
        <MailboxNavRow
          icon={<MailOutlinedIcon fontSize="small" />}
          label="Declined"
          count={declinedCount}
          selected={activeMailboxGroup === MAILBOX_GROUPS.declined}
          onClick={() => onGroupChange(MAILBOX_GROUPS.declined)}
        />
        <MailboxNavRow
          icon={<AssignmentTurnedInOutlinedIcon fontSize="small" />}
          label="Auto-applied"
          count={autoAppliedCount}
          selected={activeMailboxGroup === MAILBOX_GROUPS.autoApplied}
          onClick={() => onGroupChange(MAILBOX_GROUPS.autoApplied)}
        />
        <MailboxNavRow icon={<FolderOutlinedIcon fontSize="small" />} label="Profile inboxes" count={inboxProfiles.length} />
      </Box>

      <Divider sx={{ my: 1 }} />

      <Box sx={{ px: 1.25, pb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
          Unified inbox
        </Typography>
      </Box>
      <Box sx={{ px: 0.75, pb: 1, display: 'grid', gap: 0.25 }}>
        {!isLoading ? (
          <AllInboxesFolderRow
            count={inboxProfiles.length}
            isSelected={isAggregateInbox}
            unreadCount={unifiedUnreadCount}
            onClick={onAllProfilesSelect}
          />
        ) : null}
      </Box>

      <Divider sx={{ my: 0.5 }} />

      <Box sx={{ px: 1.25, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
          Profile email inboxes
        </Typography>
      </Box>
      <Box
        sx={{
          px: 0.75,
          pb: 1,
          display: 'grid',
          gap: 0.25,
          overflowY: { lg: 'auto' },
          minHeight: 0,
        }}
      >
        {isLoading ? <ProfileFolderSkeletons /> : null}
        {!isLoading
          ? inboxProfiles.map((profile) => (
              <ProfileFolderRow
                key={profile.id}
                activeColor={activeColor}
                isSelected={String(profile.id) === String(activeProfile?.id)}
                profile={profile}
                unreadCount={profileUnreadCountsById.get(String(profile.id)) || 0}
                onClick={() => onProfileChange(String(profile.id))}
              />
            ))
          : null}
      </Box>
    </Box>
  );
}

export function AllInboxesFolderRow({ count, isSelected, onClick, unreadCount }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        minHeight: 42,
        width: '100%',
        border: 1,
        borderColor: isSelected ? INBOX_MESSAGE_ACCENT.main : 'rgba(0, 103, 192, 0.28)',
        borderRadius: 1,
        px: 0.85,
        py: 0.75,
        bgcolor: isSelected ? 'rgba(0, 103, 192, 0.16)' : 'rgba(0, 103, 192, 0.10)',
        color: INBOX_MESSAGE_ACCENT.dark,
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 0.75,
        textAlign: 'left',
        boxShadow: isSelected ? '0 10px 22px rgba(37, 99, 235, 0.16)' : 'inset 0 0 0 1px rgba(37, 99, 235, 0.04)',
        '&:hover': { bgcolor: isSelected ? 'rgba(0, 103, 192, 0.16)' : '#E0ECFF' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#ffffff',
          border: 1,
          borderColor: 'rgba(0, 103, 192, 0.28)',
          color: INBOX_MESSAGE_ACCENT.dark,
        }}
      >
        {unreadCount > 0 ? (
          <MuiBadge badgeContent={unreadCount} max={99} overlap="circular" sx={unreadIconBadgeSx}>
            <InboxIcon fontSize="small" />
          </MuiBadge>
        ) : (
          <InboxIcon fontSize="small" />
        )}
      </Box>
      <Box minWidth={0}>
        <Typography variant="body2" fontWeight={600} noWrap>All inboxes</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {count.toLocaleString()} profile emails
        </Typography>
      </Box>
      <Chip
        label="Unified"
        size="small"
        sx={{
          height: 22,
          fontSize: 10,
          fontWeight: 600,
          bgcolor: '#ffffff',
          color: INBOX_MESSAGE_ACCENT.dark,
          border: '1px solid rgba(0, 103, 192, 0.28)',
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Box>
  );
}

export function MailboxNavRow({ badgeContent = 0, count, icon, label, onClick, selected = false }) {
  const isInteractive = Boolean(onClick);
  const badgeCount = Math.max(Number(badgeContent || 0), 0);
  return (
    <Box
      component={isInteractive ? 'button' : 'div'}
      type={isInteractive ? 'button' : undefined}
      aria-pressed={isInteractive ? selected : undefined}
      onClick={onClick}
      sx={{
        minHeight: 34,
        width: '100%',
        border: 0,
        px: 1,
        borderRadius: 1,
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 0.75,
        color: selected ? 'primary.dark' : 'text.secondary',
        bgcolor: selected ? '#E0ECFF' : 'transparent',
        cursor: isInteractive ? 'pointer' : 'default',
        font: 'inherit',
        fontWeight: selected ? 900 : 800,
        textAlign: 'left',
        '&:hover': isInteractive
          ? { bgcolor: selected ? '#E0ECFF' : 'rgba(15, 23, 42, 0.05)' }
          : undefined,
        '&:focus-visible': isInteractive
          ? { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 }
          : undefined,
      }}
    >
      {badgeCount > 0 ? (
        <MuiBadge badgeContent={badgeCount} max={99} overlap="circular" sx={unreadIconBadgeSx}>
          {icon}
        </MuiBadge>
      ) : icon}
      <Typography variant="body2" fontWeight="inherit" noWrap>{label}</Typography>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{count}</Typography>
    </Box>
  );
}

export function ProfileFolderRow({ activeColor, isSelected, onClick, profile, unreadCount = 0 }) {
  const color = PROFILE_COLORS[profile.colorScheme] || activeColor;
  const unreadBadgeCount = Math.max(Number(unreadCount || 0), 0);
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        minHeight: 42,
        width: '100%',
        border: 0,
        borderRadius: 1,
        px: 1,
        bgcolor: isSelected ? color.soft : 'transparent',
        color: color.dark,
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr)',
        alignItems: 'center',
        gap: 0.75,
        textAlign: 'left',
        '&:hover': { bgcolor: isSelected ? color.soft : 'rgba(15, 23, 42, 0.05)' },
      }}
    >
      {unreadBadgeCount > 0 ? (
        <MuiBadge badgeContent={unreadBadgeCount} max={99} overlap="circular" sx={unreadIconBadgeSx}>
          <FolderOutlinedIcon fontSize="small" />
        </MuiBadge>
      ) : (
        <FolderOutlinedIcon fontSize="small" />
      )}
      <Box minWidth={0}>
        <Typography variant="body2" fontWeight={600} noWrap>{profileMailboxAddress(profile)}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {profile.name || 'Profile email'}
        </Typography>
      </Box>
    </Box>
  );
}
