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
import { useForwardedMailboxMessages, useForwardedProfileMessages, useMarkProfileMailboxMessageRead } from '../lib/api.js';

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

import { MailboxSidebar } from './InboxNavigation.jsx';
import { MessageListPane } from './InboxMessages.jsx';
import { ReadingPane, dedupeMessagesById, filterMessages, filterMessagesByGroup, mailboxGroupLabel, mailboxGroupTotal, mailboxStatsFromPages, mailboxStatsFromSummary, normalizedMailboxGroup, profileHasMailboxMatcher, profileMailboxAddress } from './InboxReadingPane.jsx';

export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [activeMailboxGroup, setActiveMailboxGroup] = useState(() => normalizedMailboxGroup(searchParams.get('group')));
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [selectedMessageId, setSelectedMessageId] = useState(() => searchParams.get('messageId') || '');
  const [shouldPersistSelectedMessage, setShouldPersistSelectedMessage] = useState(() => searchParams.has('messageId'));
  const searchParamsString = searchParams.toString();
  const isSyncingFromSearchParams = useRef(false);
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const isAggregateInbox = !activeProfileId;
  const {
    data: aggregateInboxData,
    fetchNextPage: fetchNextAggregatePage,
    hasNextPage: hasNextAggregatePage,
    isFetching: aggregateMessagesLoading,
    isFetchingNextPage: isFetchingNextAggregatePage,
    error: aggregateMessagesError,
    refetch: refetchAggregateMessages,
  } = useForwardedMailboxMessages();
  const mailboxBootstrap = aggregateInboxData?.pages?.[0] || null;
  const profiles = mailboxBootstrap?.profiles || [];
  const profilesLoading = aggregateMessagesLoading && !aggregateInboxData;
  const profilesError = aggregateMessagesError;
  const inboxProfiles = useMemo(
    () => profiles
      .filter((profile) => ['active', 'closed', 'legacy'].includes(profile.profileStatus || 'active'))
      .filter(profileHasMailboxMatcher),
    [profiles],
  );
  const activeProfile = useMemo(
    () => (activeProfileId ? inboxProfiles.find((profile) => String(profile.id) === String(activeProfileId)) || null : null),
    [activeProfileId, inboxProfiles],
  );
  const activeColor = activeProfile
    ? PROFILE_COLORS[activeProfile.colorScheme || 'green'] || PROFILE_COLORS.green
    : INBOX_MESSAGE_ACCENT;
  const mailboxStatus = mailboxBootstrap?.mailbox;
  const mailboxSummary = mailboxBootstrap?.summary;
  const statusLoading = profilesLoading;
  const statusError = aggregateMessagesError;
  const configured = !statusError;
  const mailboxEmail = mailboxStatus?.email || 'Stored mailbox';
  const canFetchProfileMessages = Boolean(!isAggregateInbox && activeProfileId);
  const {
    data: profileInboxData,
    fetchNextPage: fetchNextProfilePage,
    hasNextPage: hasNextProfilePage,
    isFetching: profileMessagesLoading,
    isFetchingNextPage: isFetchingNextProfilePage,
    error: profileMessagesError,
    refetch: refetchProfileMessages,
  } = useForwardedProfileMessages(activeProfileId, {
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
  const stableMailboxStats = useMemo(
    () => mailboxStatsFromSummary({
      activeProfileId,
      fallbackStats: profileMailboxStats,
      isAggregateInbox,
      mailboxSummary,
    }),
    [activeProfileId, isAggregateInbox, mailboxSummary, profileMailboxStats],
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
  const isLoadingMessages = profilesLoading || (messagesLoading && !inboxData);
  const totalMessages = configured ? stableMailboxStats.total : 0;
  const unreadCount = configured ? stableMailboxStats.unreadTotal : 0;
  const stableUnreadCount = configured ? Math.max(Number(mailboxSummary?.stats?.unreadTotal ?? mailboxSummary?.unreadTotal ?? 0), 0) : 0;
  const profileUnreadCountsById = useMemo(
    () => new Map((mailboxSummary?.profiles || []).map((profile) => [String(profile.id), Math.max(Number(profile.stats?.unreadTotal ?? profile.unreadTotal ?? 0), 0)])),
    [mailboxSummary],
  );
  const declinedCount = stableMailboxStats.declinedTotal;
  const confirmationCount = stableMailboxStats.confirmationTotal;
  const interviewCount = stableMailboxStats.interviewTotal;
  const autoAppliedCount = stableMailboxStats.autoAppliedTotal;
  const activeGroupTotal = configured ? mailboxGroupTotal(stableMailboxStats, activeMailboxGroup) : 0;
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
    const nextParams = new URLSearchParams(searchParamsString);
    const nextProfileId = nextParams.get('profileId') || '';
    const nextMailboxGroup = normalizedMailboxGroup(nextParams.get('group'));
    const nextMessageId = nextParams.get('messageId') || '';
    const nextSearch = nextParams.get('search') || '';
    isSyncingFromSearchParams.current = true;
    setActiveProfileId((currentProfileId) => (String(nextProfileId) !== String(currentProfileId) ? nextProfileId : currentProfileId));
    setActiveMailboxGroup((currentGroup) => (nextMailboxGroup !== currentGroup ? nextMailboxGroup : currentGroup));
    setSelectedMessageId((currentMessageId) => (String(nextMessageId) !== String(currentMessageId) ? nextMessageId : currentMessageId));
    setShouldPersistSelectedMessage(nextParams.has('messageId'));
    setSearch((currentSearch) => (nextSearch !== currentSearch ? nextSearch : currentSearch));
  }, [searchParamsString]);

  useEffect(() => {
    if (isSyncingFromSearchParams.current) {
      isSyncingFromSearchParams.current = false;
      return;
    }
    const nextParams = new URLSearchParams();
    if (activeProfileId) nextParams.set('profileId', activeProfileId);
    if (activeMailboxGroup !== MAILBOX_GROUPS.inbox) nextParams.set('group', activeMailboxGroup);
    if (shouldPersistSelectedMessage && selectedMessageId) nextParams.set('messageId', selectedMessageId);
    if (search) nextParams.set('search', search);
    if (nextParams.toString() !== searchParamsString) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeMailboxGroup, activeProfileId, search, searchParamsString, selectedMessageId, setSearchParams, shouldPersistSelectedMessage]);

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
