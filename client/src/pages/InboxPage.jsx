import { useCallback, useEffect, useMemo, useState } from 'react';
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

const INBOX_MESSAGE_ACCENT = { main: '#2563EB', soft: '#E0ECFF', dark: '#1D4ED8' };
const DECLINED_ACCENT = { main: '#E11D48', soft: '#FFF1F2', dark: '#BE123C' };
const CONFIRMATION_ACCENT = { main: '#0F766E', soft: '#ECFDF5', dark: '#047857' };
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

export default function InboxPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [activeMailboxGroup, setActiveMailboxGroup] = useState(() => normalizedMailboxGroup(searchParams.get('group')));
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [selectedMessageId, setSelectedMessageId] = useState(() => searchParams.get('messageId') || '');
  const [shouldPersistSelectedMessage, setShouldPersistSelectedMessage] = useState(() => searchParams.has('messageId'));
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const {
    data: profiles = [],
    isLoading: profilesLoading,
    error: profilesError,
  } = useBidProfiles(isAdminRole(currentUser) ? { scope: 'manage' } : {});
  const inboxProfiles = useMemo(
    () => profiles
      .filter((profile) => ['active', 'closed', 'legacy'].includes(profile.profileStatus || 'active'))
      .filter(profileHasMailboxMatcher),
    [profiles],
  );
  const isAggregateInbox = !activeProfileId;
  const activeProfile = useMemo(
    () => (activeProfileId ? inboxProfiles.find((profile) => String(profile.id) === String(activeProfileId)) || null : null),
    [activeProfileId, inboxProfiles],
  );
  const activeColor = activeProfile
    ? PROFILE_COLORS[activeProfile.colorScheme || 'green'] || PROFILE_COLORS.green
    : INBOX_MESSAGE_ACCENT;
  const {
    data: mailboxStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useForwardingMailboxStatus();
  const mailboxDataReady = !statusLoading && !statusError;
  const configured = !statusError;
  const mailboxEmail = mailboxStatus?.email || 'Stored mailbox';
  const {
    data: mailboxSummary,
  } = useForwardedMailboxSummary({
    enabled: mailboxDataReady,
  });
  const canFetchAggregateMessages = Boolean(isAggregateInbox && mailboxDataReady);
  const canFetchProfileMessages = Boolean(!isAggregateInbox && activeProfile?.id && mailboxDataReady);
  const {
    data: aggregateInboxData,
    fetchNextPage: fetchNextAggregatePage,
    hasNextPage: hasNextAggregatePage,
    isFetching: aggregateMessagesLoading,
    isFetchingNextPage: isFetchingNextAggregatePage,
    error: aggregateMessagesError,
    refetch: refetchAggregateMessages,
  } = useForwardedMailboxMessages({
    enabled: canFetchAggregateMessages,
  });
  const {
    data: profileInboxData,
    fetchNextPage: fetchNextProfilePage,
    hasNextPage: hasNextProfilePage,
    isFetching: profileMessagesLoading,
    isFetchingNextPage: isFetchingNextProfilePage,
    error: profileMessagesError,
    refetch: refetchProfileMessages,
  } = useForwardedProfileMessages(activeProfile?.id, {
    enabled: canFetchProfileMessages,
  });
  const markMessageRead = useMarkProfileMailboxMessageRead();
  const inboxData = isAggregateInbox ? aggregateInboxData : profileInboxData;
  const fetchNextPage = isAggregateInbox ? fetchNextAggregatePage : fetchNextProfilePage;
  const hasNextPage = isAggregateInbox ? hasNextAggregatePage : hasNextProfilePage;
  const messagesLoading = isAggregateInbox ? aggregateMessagesLoading : profileMessagesLoading;
  const isFetchingNextPage = isAggregateInbox ? isFetchingNextAggregatePage : isFetchingNextProfilePage;
  const messagesError = isAggregateInbox ? aggregateMessagesError : profileMessagesError;
  const refetchMessages = isAggregateInbox ? refetchAggregateMessages : refetchProfileMessages;
  const messages = useMemo(
    () => (configured ? dedupeMessagesById(inboxData?.pages?.flatMap((page) => page.messages || []) || []) : []),
    [configured, inboxData],
  );
  const profileMailboxStats = useMemo(
    () => mailboxStatsFromPages(inboxData?.pages || [], messages),
    [inboxData, messages],
  );
  const groupedMessages = useMemo(
    () => filterMessagesByGroup(messages, activeMailboxGroup),
    [activeMailboxGroup, messages],
  );
  const filteredMessages = useMemo(() => filterMessages(groupedMessages, search), [groupedMessages, search]);
  const selectedMessage = useMemo(
    () => {
      const selected = filteredMessages.find((message) => String(message.id) === String(selectedMessageId));
      if (selected) return selected;
      return selectedMessageId ? null : filteredMessages[0] || null;
    },
    [filteredMessages, selectedMessageId],
  );
  const pageError = profilesError?.message || statusError?.message || (configured ? messagesError?.message : '') || '';
  const isLoadingMessages = statusLoading || (messagesLoading && !inboxData);
  const totalMessages = configured ? profileMailboxStats.total : 0;
  const unreadCount = configured ? profileMailboxStats.unreadTotal : 0;
  const stableUnreadCount = configured ? Math.max(Number(mailboxSummary?.unreadTotal || 0), 0) : 0;
  const profileUnreadCountsById = useMemo(
    () => new Map((mailboxSummary?.profiles || []).map((profile) => [String(profile.id), Math.max(Number(profile.unreadTotal || 0), 0)])),
    [mailboxSummary],
  );
  const declinedCount = profileMailboxStats.declinedTotal;
  const confirmationCount = profileMailboxStats.confirmationTotal;
  const interviewCount = profileMailboxStats.interviewTotal;
  const autoAppliedCount = profileMailboxStats.autoAppliedTotal;
  const activeGroupTotal = configured ? mailboxGroupTotal(profileMailboxStats, activeMailboxGroup) : 0;
  const activeGroupLabel = mailboxGroupLabel(activeMailboxGroup);
  const hasMatcher = isAggregateInbox
    ? inboxProfiles.some(profileHasMailboxMatcher)
    : profileHasMailboxMatcher(activeProfile);
  const readingProfile = activeProfile || selectedMessage?.matchedProfile || null;
  const mailboxTitle = isAggregateInbox ? 'All inboxes' : profileMailboxAddress(activeProfile) || 'Inbox';
  const emptyMessagesDetail = isAggregateInbox
    ? 'Stored messages across all profile emails will appear here.'
    : 'Stored messages for this profile email will appear here.';

  useEffect(() => {
    if (!activeProfileId || profilesLoading) return;
    const hasActiveProfile = inboxProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!hasActiveProfile) setActiveProfileId('');
  }, [activeProfileId, inboxProfiles, profilesLoading]);

  useEffect(() => {
    const nextProfileId = searchParams.get('profileId') || '';
    const nextMailboxGroup = normalizedMailboxGroup(searchParams.get('group'));
    const nextMessageId = searchParams.get('messageId') || '';
    const nextSearch = searchParams.get('search') || '';
    setActiveProfileId((currentProfileId) => (String(nextProfileId) !== String(currentProfileId) ? nextProfileId : currentProfileId));
    setActiveMailboxGroup((currentGroup) => (nextMailboxGroup !== currentGroup ? nextMailboxGroup : currentGroup));
    setSelectedMessageId((currentMessageId) => (String(nextMessageId) !== String(currentMessageId) ? nextMessageId : currentMessageId));
    setShouldPersistSelectedMessage(searchParams.has('messageId'));
    setSearch((currentSearch) => (nextSearch !== currentSearch ? nextSearch : currentSearch));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (activeProfileId) nextParams.set('profileId', activeProfileId);
    if (activeMailboxGroup !== MAILBOX_GROUPS.inbox) nextParams.set('group', activeMailboxGroup);
    if (shouldPersistSelectedMessage && selectedMessageId) nextParams.set('messageId', selectedMessageId);
    if (search) nextParams.set('search', search);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeMailboxGroup, activeProfileId, search, searchParams, selectedMessageId, setSearchParams, shouldPersistSelectedMessage]);

  useEffect(() => {
    if (!filteredMessages.length) {
      if (selectedMessageId && (hasNextPage || isFetchingNextPage || messagesLoading)) return;
      setShouldPersistSelectedMessage(false);
      setSelectedMessageId('');
      return;
    }
    const hasSelected = filteredMessages.some((message) => String(message.id) === String(selectedMessageId));
    if (hasSelected) return;
    if (selectedMessageId && (hasNextPage || isFetchingNextPage || messagesLoading)) return;
    setShouldPersistSelectedMessage(false);
    setSelectedMessageId(filteredMessages[0].id);
  }, [filteredMessages, hasNextPage, isFetchingNextPage, messagesLoading, selectedMessageId]);

  useEffect(() => {
    if (!selectedMessageId || selectedMessage || !hasNextPage || isFetchingNextPage || messagesLoading) return;
    fetchNextPage?.();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, messagesLoading, selectedMessage, selectedMessageId]);

  useEffect(() => {
    setHeaderSearch({
      isVisible: true,
      placeholder: 'Search inbox',
      value: search,
      onChange: setSearch,
    });
  }, [search, setHeaderSearch]);

  useEffect(() => {
    return () => setHeaderSearch(EMPTY_HEADER_SEARCH);
  }, [setHeaderSearch]);

  const handleMessageSelect = useCallback((messageId) => {
    setShouldPersistSelectedMessage(true);
    setSelectedMessageId(messageId);
    const message = messages.find((row) => String(row.id) === String(messageId));
    const messageProfileId = activeProfile?.id || message?.matchedProfile?.id;
    if (!messageProfileId || !message?.id || message.isRead) return;
    markMessageRead.mutate({ profileId: messageProfileId, messageId: message.id, wasUnread: !message.isRead });
  }, [activeProfile?.id, markMessageRead, messages]);

  const handleAllProfilesSelect = useCallback(() => {
    setActiveProfileId('');
    setShouldPersistSelectedMessage(false);
    setSelectedMessageId('');
  }, []);

  const handleGroupChange = useCallback((group) => {
    setActiveMailboxGroup(group);
    setShouldPersistSelectedMessage(false);
    setSelectedMessageId('');
  }, []);

  const handleProfileChange = useCallback((profileId) => {
    setActiveProfileId(String(profileId));
    setShouldPersistSelectedMessage(false);
    setSelectedMessageId('');
  }, []);

  return (
    <Box sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {!inboxProfiles.length && !profilesLoading ? (
        <EmptyState
          title="No profile email inboxes"
          detail="Profiles with a profile email or forwarding alias will appear here."
        />
      ) : null}

      {profilesLoading || inboxProfiles.length ? (
        <Paper
          variant="outlined"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '260px minmax(320px, 390px) minmax(0, 1fr)' },
            gridTemplateRows: { xs: 'auto auto minmax(360px, auto)', lg: 'minmax(0, 1fr)' },
            overflow: 'hidden',
            height: { xs: 'auto', lg: 'calc(100vh - 108px)', xl: 'calc(100vh - 124px)' },
            minHeight: { lg: 0 },
            minWidth: 0,
            borderRadius: 1,
            boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)',
            bgcolor: '#ffffff',
          }}
        >
          <MailboxSidebar
            activeColor={activeColor}
            activeMailboxGroup={activeMailboxGroup}
            activeProfile={activeProfile}
            autoAppliedCount={autoAppliedCount}
            isAggregateInbox={isAggregateInbox}
            inboxProfiles={inboxProfiles}
            isLoading={profilesLoading}
            mailboxEmail={mailboxEmail}
            confirmationCount={confirmationCount}
            declinedCount={declinedCount}
            interviewCount={interviewCount}
            messagesCount={totalMessages}
            profileUnreadCountsById={profileUnreadCountsById}
            onAllProfilesSelect={handleAllProfilesSelect}
            onGroupChange={handleGroupChange}
            onProfileChange={handleProfileChange}
            statusLoading={statusLoading}
            unifiedUnreadCount={stableUnreadCount}
            unreadCount={unreadCount}
          />

          <MessageListPane
            configured={configured}
            hasMatcher={hasMatcher}
            isLoading={isLoadingMessages}
            isLoadingMore={isFetchingNextPage}
            isRefreshing={messagesLoading && !isFetchingNextPage && Boolean(inboxData)}
            messages={filteredMessages}
            groupLabel={activeGroupLabel}
            title={mailboxTitle}
            emptyMessagesDetail={emptyMessagesDetail}
            search={search}
            selectedMessage={selectedMessage}
            totalMessages={activeGroupTotal}
            canRefresh={isAggregateInbox || Boolean(activeProfile?.id)}
            canLoadMore={Boolean(hasNextPage)}
            onMessageSelect={handleMessageSelect}
            onLoadMore={() => fetchNextPage()}
            onRefresh={() => refetchMessages()}
          />

          <ReadingPane
            activeColor={activeColor}
            configured={configured}
            isLoading={isLoadingMessages}
            message={selectedMessage}
            profile={readingProfile}
          />
        </Paper>
      ) : null}
    </Box>
  );
}

function MailboxSidebar({
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
        bgcolor: '#F8FAFC',
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
            <Typography fontWeight={950} lineHeight={1.1}>Mailbox</Typography>
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
        <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ textTransform: 'uppercase' }}>
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
        <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ textTransform: 'uppercase' }}>
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

function AllInboxesFolderRow({ count, isSelected, onClick, unreadCount }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        minHeight: 42,
        width: '100%',
        border: 1,
        borderColor: isSelected ? INBOX_MESSAGE_ACCENT.main : '#BFDBFE',
        borderRadius: 1,
        px: 0.85,
        py: 0.75,
        bgcolor: isSelected ? '#DBEAFE' : '#EFF6FF',
        color: INBOX_MESSAGE_ACCENT.dark,
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 0.75,
        textAlign: 'left',
        boxShadow: isSelected ? '0 10px 22px rgba(37, 99, 235, 0.16)' : 'inset 0 0 0 1px rgba(37, 99, 235, 0.04)',
        '&:hover': { bgcolor: isSelected ? '#DBEAFE' : '#E0ECFF' },
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
          borderColor: '#BFDBFE',
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
        <Typography variant="body2" fontWeight={900} noWrap>All inboxes</Typography>
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
          fontWeight: 900,
          bgcolor: '#ffffff',
          color: INBOX_MESSAGE_ACCENT.dark,
          border: '1px solid #BFDBFE',
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Box>
  );
}

function MailboxNavRow({ badgeContent = 0, count, icon, label, onClick, selected = false }) {
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
      <Typography variant="caption" color="text.secondary" fontWeight={900}>{count}</Typography>
    </Box>
  );
}

function ProfileFolderRow({ activeColor, isSelected, onClick, profile, unreadCount = 0 }) {
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
        <Typography variant="body2" fontWeight={900} noWrap>{profileMailboxAddress(profile)}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {profile.name || 'Profile email'}
        </Typography>
      </Box>
    </Box>
  );
}

function MessageListPane({
  canLoadMore,
  canRefresh,
  configured,
  emptyMessagesDetail,
  groupLabel,
  hasMatcher,
  isLoading,
  isLoadingMore,
  isRefreshing,
  messages,
  search,
  selectedMessage,
  title,
  totalMessages,
  onLoadMore,
  onMessageSelect,
  onRefresh,
}) {
  return (
    <Box
      sx={{
        borderRight: { lg: 1 },
        borderBottom: { xs: 1, lg: 0 },
        borderColor: 'divider',
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#ffffff',
      }}
    >
      <Box
        sx={{
          px: 1.25,
          py: 1,
          minHeight: 62,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
        }}
      >
        <Box minWidth={0}>
          <Typography fontWeight={950} noWrap>{title}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {groupLabel} · {messages.length.toLocaleString()} of {totalMessages.toLocaleString()} messages
          </Typography>
        </Box>
        <Tooltip title="Refresh inbox">
          <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
            <IconButton
              size="small"
              disabled={!configured || !canRefresh}
              onClick={onRefresh}
              sx={{ flexShrink: 0 }}
            >
              {isRefreshing || isLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Tooltip>
      </Box>

      <Box sx={{ p: 1, display: 'grid', gap: 0.75 }}>
        {!configured ? <Alert severity="warning">Forwarding mailbox is not configured.</Alert> : null}
        {!hasMatcher ? <Alert severity="warning">Add a profile email or forwarding alias before classifying messages.</Alert> : null}
      </Box>

      <Box
        aria-busy={isLoading}
        sx={{
          flex: 1,
          minHeight: { xs: 320, lg: 0 },
          overflowY: 'auto',
          px: 0.75,
          pb: 0.75,
        }}
      >
        {isLoading ? <InboxMessageSkeletonList /> : null}
        {!isLoading && !messages.length ? (
          <EmptyState
            title={search && totalMessages ? 'No messages match your search' : `No ${groupLabel.toLowerCase()} messages`}
            detail={search && totalMessages ? 'Try a different sender, subject, or keyword.' : emptyMessagesDetail}
            variant="plain"
            sx={{ py: 5, bgcolor: 'transparent' }}
          />
        ) : null}
        {!isLoading
          ? (
              <VirtualizedMessageList
                canLoadMore={canLoadMore}
                isLoadingMore={isLoadingMore}
                messages={messages}
                selectedMessage={selectedMessage}
                onLoadMore={onLoadMore}
                onMessageSelect={onMessageSelect}
              />
            )
          : null}
      </Box>
    </Box>
  );
}

function VirtualizedMessageList({
  canLoadMore,
  isLoadingMore,
  messages,
  selectedMessage,
  onLoadMore,
  onMessageSelect,
}) {
  const rowCount = messages.length + (canLoadMore ? 1 : 0);
  const loadThresholdIndex = Math.max(messages.length - 3, 0);

  return (
    <Box sx={{ height: '100%', minHeight: 0 }}>
      <AutoSizer>
        {({ height, width }) => (
          <VirtualizedList
            height={height}
            width={width}
            rowCount={rowCount}
            rowHeight={COMPACT_MESSAGE_ROW_HEIGHT}
            overscanRowCount={6}
            onRowsRendered={({ stopIndex }) => {
              if (canLoadMore && !isLoadingMore && stopIndex >= loadThresholdIndex) onLoadMore?.();
            }}
            rowRenderer={({ index, key, style }) => {
              const message = messages[index];
              if (!message) {
                return (
                  <MessageLoadingRow
                    key={key}
                    isLoading={isLoadingMore}
                    style={style}
                  />
                );
              }
              return (
                <MessageListItem
                  key={key}
                  isSelected={String(message.id) === String(selectedMessage?.id)}
                  message={message}
                  style={style}
                  onClick={() => onMessageSelect(message.id)}
                />
              );
            }}
          />
        )}
      </AutoSizer>
    </Box>
  );
}

function MessageLoadingRow({ isLoading, style }) {
  return (
    <Box
      style={style}
      sx={{
        height: COMPACT_MESSAGE_ROW_HEIGHT,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'grid',
        placeItems: 'center',
        color: 'text.secondary',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {isLoading ? <CircularProgress size={18} /> : null}
        <Typography variant="caption" fontWeight={800}>
          {isLoading ? 'Loading more messages' : 'Scroll for more messages'}
        </Typography>
      </Stack>
    </Box>
  );
}

function MessageListItem({ isSelected, message, onClick, style }) {
  const hasListChips = !message.isRead || Boolean(message.mailboxPath);
  const selectedBg = INBOX_MESSAGE_ACCENT.soft;
  const defaultBg = message.isRead ? '#ffffff' : '#F8FAFC';
  const hoverBg = isSelected ? selectedBg : '#F8FAFC';
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      style={style}
      sx={{
        width: '100%',
        height: COMPACT_MESSAGE_ROW_HEIGHT,
        border: 0,
        borderBottom: 1,
        borderColor: 'divider',
        borderRadius: 0,
        bgcolor: isSelected ? selectedBg : defaultBg,
        cursor: 'pointer',
        px: 1,
        py: 0.75,
        display: 'grid',
        gap: 0.25,
        textAlign: 'left',
        boxShadow: isSelected ? `inset 3px 0 0 ${INBOX_MESSAGE_ACCENT.main}` : 'none',
        '&:hover': { bgcolor: hoverBg },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} minWidth={0}>
        <Typography variant="body2" fontWeight={message.isRead ? 800 : 950} noWrap sx={{ minWidth: 0 }}>
          {messageSenderName(message)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {formatMessageDateShort(message.receivedAt)}
        </Typography>
      </Stack>
      <Typography variant="body2" fontWeight={message.isRead ? 800 : 950} color="text.primary" noWrap>
        {message.subject || '(No subject)'}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {message.bodyPreview || 'No preview available'}
      </Typography>
      {hasListChips ? (
        <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap sx={{ flexWrap: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
          {!message.isRead ? <Chip label="Unread" size="small" sx={smallChipSx(INBOX_MESSAGE_ACCENT.soft, INBOX_MESSAGE_ACCENT.dark)} /> : null}
          {message.mailboxPath ? <Chip label={message.mailboxPath} size="small" variant="outlined" sx={smallOutlinedChipSx} /> : null}
        </Stack>
      ) : null}
    </Box>
  );
}

function ReadingPane({ activeColor, configured, isLoading, message, profile }) {
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
                <Typography variant="h6" fontWeight={950} sx={{ lineHeight: 1.25 }}>
                  {message.subject || '(No subject)'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {formatMessageDate(message.receivedAt)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: { sm: 'flex-end' } }}>
                {message.classification?.type === 'interview_related' ? (
                  <Chip label="Interview" size="small" sx={smallChipSx(INTERVIEW_ACCENT.soft, INTERVIEW_ACCENT.dark)} />
                ) : null}
                {message.classification?.type === 'declined' ? <Chip label="Declined" size="small" sx={smallChipSx(DECLINED_ACCENT.soft, DECLINED_ACCENT.dark)} /> : null}
                {message.classification?.type === 'application_confirmation' ? (
                  <Chip label={applicationChipLabel(message.application)} size="small" sx={smallChipSx(CONFIRMATION_ACCENT.soft, CONFIRMATION_ACCENT.dark)} />
                ) : null}
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
                <Typography fontWeight={900} noWrap>{messageSender(message)}</Typography>
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

function ApplicationConfirmationInfo({ application }) {
  const detail = applicationDetailText(application);
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: CONFIRMATION_ACCENT.soft }}>
      <Typography variant="body2" fontWeight={900} color={CONFIRMATION_ACCENT.dark}>
        Application confirmation
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

function CalendarInviteInfo({ event }) {
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
            <Typography variant="caption" fontWeight={950} sx={{ fontSize: 10 }}>
              {calendarEventMonth(event)}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', placeItems: 'center' }}>
            <Typography fontWeight={950} sx={{ color: INTERVIEW_ACCENT.dark }}>
              {calendarEventDay(event)}
            </Typography>
          </Box>
        </Box>

        <Box minWidth={0}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: INTERVIEW_ACCENT.dark }}>
            <CalendarMonthOutlinedIcon fontSize="small" />
            <Typography variant="caption" fontWeight={950} sx={{ textTransform: 'uppercase' }}>
              Calendar invite
            </Typography>
          </Stack>
          <Typography fontWeight={950} sx={{ mt: 0.25 }} noWrap>
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
                fontWeight: 900,
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

function EmailHtmlFrame({ html, title }) {
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

function ProfileFolderSkeletons() {
  return Array.from({ length: 5 }).map((_, index) => (
    <Box key={`profile-folder-loading-${index}`} sx={{ px: 1, py: 0.75 }}>
      <Skeleton width="70%" />
      <Skeleton width="90%" />
    </Box>
  ));
}

function InboxMessageSkeletonList() {
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

function ReadingPaneSkeleton() {
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

function filterMessages(messages, search) {
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

function profileHasMailboxMatcher(profile) {
  return Boolean(profile?.forwardingEmail || profile?.email);
}

function profileMailboxAddress(profile) {
  return profile?.forwardingEmail || profile?.email || '';
}

function filterMessagesByGroup(messages, group) {
  switch (normalizedMailboxGroup(group)) {
    case MAILBOX_GROUPS.unread:
      return messages.filter((message) => !message.isRead);
    case MAILBOX_GROUPS.interviews:
      return messages.filter((message) => message.classification?.type === 'interview_related' || Boolean(message.calendarEvent));
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

function mailboxGroupTotal(stats, group) {
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

function mailboxGroupLabel(group) {
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

function normalizedMailboxGroup(value) {
  return MAILBOX_GROUP_VALUES.has(value) ? value : MAILBOX_GROUPS.inbox;
}

function dedupeMessagesById(messages) {
  const byId = new Map();
  for (const message of messages) {
    const id = String(message?.id || '');
    if (id && !byId.has(id)) byId.set(id, message);
  }
  return [...byId.values()];
}

function mailboxStatsFromPages(pages, messages) {
  const loadedTotal = messages.length;
  const loadedUnreadTotal = messages.filter((message) => !message.isRead).length;
  const interviewTotal = messages.filter((message) => message.classification?.type === 'interview_related' || Boolean(message.calendarEvent)).length;
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

function applicationChipLabel(application) {
  if (!application) return 'Confirmation';
  if (application.status === 'applied') return 'Auto-applied';
  if (application.status === 'already_applied') return 'Already applied';
  if (application.status === 'job_not_found') return 'No job match';
  if (application.status === 'ambiguous_job_match') return 'Needs review';
  return 'Confirmation';
}

function applicationDetailText(application) {
  if (!application) return 'This looks like an application confirmation.';
  const jobLabel = [application.jobTitle, application.company].filter(Boolean).join(' at ');
  if (application.status === 'applied') return `Marked ${jobLabel || 'the matching job'} as applied.`;
  if (application.status === 'already_applied') return `${jobLabel || 'The matching job'} was already marked as applied.`;
  if (application.status === 'job_not_found') return 'No matching job was found from this email text.';
  if (application.status === 'ambiguous_job_match') return 'Multiple company/title matches were found, so no job was changed.';
  if (application.status === 'skipped_existing_status') return `${jobLabel || 'The matching job'} has a status that was left unchanged.`;
  return 'This looks like an application confirmation.';
}

function emailFrameDocument(html) {
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

function messageSender(message) {
  const from = message.from || {};
  if (from.name && from.address) return `${from.name} <${from.address}>`;
  return from.name || from.address || 'Unknown sender';
}

function messageSenderName(message) {
  return message.from?.name || message.from?.address || 'Unknown sender';
}

function formatMessageDate(value) {
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

function calendarEventTimeLabel(event) {
  const start = calendarDateLabel(event?.start);
  const end = calendarDateLabel(event?.end, { omitDateWhenSameDayAs: event?.start });
  if (start && end) return `${start} - ${end}`;
  return start || end || 'Time to be announced';
}

function calendarEventMonth(event) {
  const date = calendarDateObject(event?.start || event?.end);
  if (!date) return '';
  return date.toLocaleString([], { month: 'short' }).toUpperCase();
}

function calendarEventDay(event) {
  const date = calendarDateObject(event?.start || event?.end);
  if (!date) return '';
  return String(date.getDate());
}

function calendarDateLabel(value, options = {}) {
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

function calendarDateObject(value) {
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

function calendarDateKey(value) {
  const date = calendarDateObject(value);
  if (!date) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDateShort(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
  });
}

function matchSourceLabel(value) {
  if (String(value).startsWith('forwardingEmail')) return 'Forwarding alias';
  if (String(value).startsWith('profileEmail')) return 'Profile email';
  return 'Matched';
}

function smallChipSx(bgcolor, color) {
  return {
    height: 22,
    fontSize: 11,
    fontWeight: 900,
    bgcolor,
    color,
    '& .MuiChip-label': { px: 0.75 },
  };
}

const smallOutlinedChipSx = {
  height: 22,
  fontSize: 11,
  fontWeight: 800,
  bgcolor: '#ffffff',
  '& .MuiChip-label': { px: 0.75 },
};

const unreadIconBadgeSx = {
  '& .MuiBadge-badge': {
    minWidth: 16,
    height: 16,
    px: 0.45,
    border: '2px solid #ffffff',
    bgcolor: '#DC2626',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
  },
};
