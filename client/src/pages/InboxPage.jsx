import { useCallback, useEffect, useMemo, useState } from 'react';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
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
import { useBidProfiles, useForwardedMailboxMessages, useForwardedProfileMessages, useForwardingMailboxStatus, useMarkProfileMailboxMessageRead } from '../lib/api.js';
import { isAdminRole } from '../lib/roles.js';

const INBOX_MESSAGE_ACCENT = { main: '#2563EB', soft: '#E0ECFF', dark: '#1D4ED8' };
const DECLINED_ACCENT = { main: '#E11D48', soft: '#FFF1F2', dark: '#BE123C' };
const CONFIRMATION_ACCENT = { main: '#0F766E', soft: '#ECFDF5', dark: '#047857' };
const COMPACT_MESSAGE_ROW_HEIGHT = 96;
const MAILBOX_GROUPS = Object.freeze({
  inbox: 'inbox',
  unread: 'unread',
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
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const {
    data: profiles = [],
    isLoading: profilesLoading,
    error: profilesError,
  } = useBidProfiles(isAdminRole(currentUser) ? { scope: 'manage' } : {});
  const inboxProfiles = useMemo(
    () => profiles.filter((profile) => ['active', 'closed', 'legacy'].includes(profile.profileStatus || 'active')),
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
  const configured = mailboxStatus?.configured !== false;
  const mailboxEmail = mailboxStatus?.email || 'service@co-bounce.com';
  const canFetchAggregateMessages = Boolean(isAggregateInbox && mailboxStatus?.configured);
  const canFetchProfileMessages = Boolean(!isAggregateInbox && activeProfile?.id && mailboxStatus?.configured);
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
    () => filteredMessages.find((message) => String(message.id) === String(selectedMessageId)) || filteredMessages[0] || null,
    [filteredMessages, selectedMessageId],
  );
  const pageError = profilesError?.message || statusError?.message || (configured ? messagesError?.message : '') || '';
  const isLoadingMessages = statusLoading || (messagesLoading && !inboxData);
  const totalMessages = configured ? profileMailboxStats.total : 0;
  const unreadCount = configured ? profileMailboxStats.unreadTotal : 0;
  const declinedCount = profileMailboxStats.declinedTotal;
  const confirmationCount = profileMailboxStats.confirmationTotal;
  const autoAppliedCount = profileMailboxStats.autoAppliedTotal;
  const activeGroupTotal = configured ? mailboxGroupTotal(profileMailboxStats, activeMailboxGroup) : 0;
  const activeGroupLabel = mailboxGroupLabel(activeMailboxGroup);
  const hasMatcher = isAggregateInbox
    ? inboxProfiles.some(profileHasMailboxMatcher)
    : profileHasMailboxMatcher(activeProfile);
  const readingProfile = activeProfile || selectedMessage?.matchedProfile || null;
  const mailboxTitle = isAggregateInbox ? 'All inboxes' : activeProfile?.name || 'Inbox';
  const emptyMessagesDetail = isAggregateInbox
    ? 'Forwarded messages across all profile emails will appear here.'
    : 'Forwarded messages for this profile will appear here.';

  useEffect(() => {
    if (!activeProfileId || profilesLoading) return;
    const hasActiveProfile = inboxProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!hasActiveProfile) setActiveProfileId('');
  }, [activeProfileId, inboxProfiles, profilesLoading]);

  useEffect(() => {
    const nextProfileId = searchParams.get('profileId') || '';
    const nextMailboxGroup = normalizedMailboxGroup(searchParams.get('group'));
    const nextSearch = searchParams.get('search') || '';
    setActiveProfileId((currentProfileId) => (String(nextProfileId) !== String(currentProfileId) ? nextProfileId : currentProfileId));
    setActiveMailboxGroup((currentGroup) => (nextMailboxGroup !== currentGroup ? nextMailboxGroup : currentGroup));
    setSearch((currentSearch) => (nextSearch !== currentSearch ? nextSearch : currentSearch));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (activeProfileId) nextParams.set('profileId', activeProfileId);
    if (activeMailboxGroup !== MAILBOX_GROUPS.inbox) nextParams.set('group', activeMailboxGroup);
    if (search) nextParams.set('search', search);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeMailboxGroup, activeProfileId, search, searchParams, setSearchParams]);

  useEffect(() => {
    if (!filteredMessages.length) {
      setSelectedMessageId('');
      return;
    }
    const hasSelected = filteredMessages.some((message) => String(message.id) === String(selectedMessageId));
    if (!hasSelected) setSelectedMessageId(filteredMessages[0].id);
  }, [filteredMessages, selectedMessageId]);

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
    setSelectedMessageId(messageId);
    const message = messages.find((row) => String(row.id) === String(messageId));
    const messageProfileId = activeProfile?.id || message?.matchedProfile?.id;
    if (!messageProfileId || !message?.id || message.isRead) return;
    markMessageRead.mutate({ profileId: messageProfileId, messageId: message.id, wasUnread: !message.isRead });
  }, [activeProfile?.id, markMessageRead, messages]);

  return (
    <Box sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {!inboxProfiles.length && !profilesLoading ? (
        <EmptyState
          title="No profiles available"
          detail="Profiles with mailbox access will appear here."
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
            messagesCount={totalMessages}
            onAllProfilesSelect={() => setActiveProfileId('')}
            onGroupChange={setActiveMailboxGroup}
            onProfileChange={setActiveProfileId}
            statusLoading={statusLoading}
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
            autoAppliedCount={autoAppliedCount}
            confirmationCount={confirmationCount}
            declinedCount={declinedCount}
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
  isAggregateInbox,
  inboxProfiles,
  isLoading,
  mailboxEmail,
  messagesCount,
  onAllProfilesSelect,
  onGroupChange,
  onProfileChange,
  statusLoading,
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
        <MailboxNavRow icon={<FolderOutlinedIcon fontSize="small" />} label="Profile folders" count={inboxProfiles.length} />
      </Box>

      <Divider sx={{ my: 1 }} />

      <Box sx={{ px: 1.25, pb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ textTransform: 'uppercase' }}>
          Profiles
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
        {!isLoading ? (
          <AllInboxesFolderRow
            count={inboxProfiles.length}
            isSelected={isAggregateInbox}
            unreadCount={unreadCount}
            onClick={onAllProfilesSelect}
          />
        ) : null}
        {isLoading ? <ProfileFolderSkeletons /> : null}
        {!isLoading
          ? inboxProfiles.map((profile) => (
              <ProfileFolderRow
                key={profile.id}
                activeColor={activeColor}
                isSelected={String(profile.id) === String(activeProfile?.id)}
                profile={profile}
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
        border: 0,
        borderRadius: 1,
        px: 1,
        bgcolor: isSelected ? INBOX_MESSAGE_ACCENT.soft : 'transparent',
        color: INBOX_MESSAGE_ACCENT.dark,
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr)',
        alignItems: 'center',
        gap: 0.75,
        textAlign: 'left',
        '&:hover': { bgcolor: isSelected ? INBOX_MESSAGE_ACCENT.soft : 'rgba(15, 23, 42, 0.05)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
      }}
    >
      {unreadCount > 0 ? (
        <MuiBadge badgeContent={unreadCount} max={99} overlap="circular" sx={unreadIconBadgeSx}>
          <InboxIcon fontSize="small" />
        </MuiBadge>
      ) : (
        <InboxIcon fontSize="small" />
      )}
      <Box minWidth={0}>
        <Typography variant="body2" fontWeight={900} noWrap>All inboxes</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {count.toLocaleString()} profile emails
        </Typography>
      </Box>
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

function ProfileFolderRow({ activeColor, isSelected, onClick, profile }) {
  const color = PROFILE_COLORS[profile.colorScheme] || activeColor;
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
      <FolderOutlinedIcon fontSize="small" />
      <Box minWidth={0}>
        <Typography variant="body2" fontWeight={900} noWrap>{profile.name}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {profile.forwardingEmail || profile.email || 'No alias'}
        </Typography>
      </Box>
    </Box>
  );
}

function MessageListPane({
  autoAppliedCount,
  canLoadMore,
  canRefresh,
  confirmationCount,
  configured,
  declinedCount,
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
          minHeight: 74,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box minWidth={0}>
          <Typography fontWeight={950} noWrap>{title}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {groupLabel} · {messages.length.toLocaleString()} of {totalMessages.toLocaleString()} messages
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {confirmationCount.toLocaleString()} confirmations · {declinedCount.toLocaleString()} declined · {autoAppliedCount.toLocaleString()} auto-applied
          </Typography>
        </Box>
        <Tooltip title="Refresh inbox">
          <span>
            <IconButton size="small" disabled={!configured || !canRefresh} onClick={onRefresh}>
              {isRefreshing || isLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </span>
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
  const isDeclined = message.classification?.type === 'declined';
  const isConfirmation = message.classification?.type === 'application_confirmation';
  const selectedBg = INBOX_MESSAGE_ACCENT.soft;
  const defaultBg = isDeclined ? DECLINED_ACCENT.soft : message.isRead ? '#ffffff' : '#F8FAFC';
  const hoverBg = isSelected ? selectedBg : isDeclined ? '#FFE4E6' : '#F8FAFC';
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
        boxShadow: isSelected
          ? `inset 3px 0 0 ${INBOX_MESSAGE_ACCENT.main}`
          : isDeclined
            ? `inset 3px 0 0 ${DECLINED_ACCENT.main}`
            : 'none',
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
      <Typography variant="caption" color={isDeclined ? DECLINED_ACCENT.dark : 'text.secondary'} noWrap>
        {message.bodyPreview || 'No preview available'}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap sx={{ flexWrap: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
        {!message.isRead ? <Chip label="Unread" size="small" sx={smallChipSx(INBOX_MESSAGE_ACCENT.soft, INBOX_MESSAGE_ACCENT.dark)} /> : null}
        {isDeclined ? <Chip label="Declined" size="small" sx={smallChipSx(DECLINED_ACCENT.soft, DECLINED_ACCENT.dark)} /> : null}
        {isConfirmation ? <Chip label={applicationChipLabel(message.application)} size="small" sx={smallChipSx(CONFIRMATION_ACCENT.soft, CONFIRMATION_ACCENT.dark)} /> : null}
        {message.mailboxPath ? <Chip label={message.mailboxPath} size="small" variant="outlined" sx={smallOutlinedChipSx} /> : null}
      </Stack>
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
    ].some((value) => String(value || '').toLowerCase().includes(query)),
  );
}

function profileHasMailboxMatcher(profile) {
  return Boolean(profile?.forwardingEmail || profile?.email);
}

function filterMessagesByGroup(messages, group) {
  switch (normalizedMailboxGroup(group)) {
    case MAILBOX_GROUPS.unread:
      return messages.filter((message) => !message.isRead);
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
  const confirmationTotal = messages.filter((message) => message.classification?.type === 'application_confirmation').length;
  const declinedTotal = messages.filter((message) => message.classification?.type === 'declined').length;
  const autoAppliedTotal = messages.filter((message) => ['applied', 'already_applied'].includes(message.application?.status)).length;
  const firstPagination = pages.find((page) => page?.pagination)?.pagination || {};
  return {
    total: Math.max(Number(firstPagination.total || 0), loadedTotal),
    unreadTotal: Math.max(Number(firstPagination.unreadTotal || 0), loadedUnreadTotal),
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
