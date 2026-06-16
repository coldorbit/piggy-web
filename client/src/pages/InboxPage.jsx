import { useEffect, useMemo, useRef, useState } from 'react';
import InboxIcon from '@mui/icons-material/Inbox';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { useBidProfiles, useForwardedProfileMessages, useForwardingMailboxStatus } from '../lib/api.js';
import { isAdminRole } from '../lib/roles.js';

export default function InboxPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
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
  const activeProfile = useMemo(
    () => inboxProfiles.find((profile) => String(profile.id) === String(activeProfileId)) || inboxProfiles[0] || null,
    [activeProfileId, inboxProfiles],
  );
  const activeColor = PROFILE_COLORS[activeProfile?.colorScheme || 'green'] || PROFILE_COLORS.green;
  const {
    data: mailboxStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useForwardingMailboxStatus();
  const configured = mailboxStatus?.configured !== false;
  const mailboxEmail = mailboxStatus?.email || 'service@co-bounce.com';
  const canFetchMessages = Boolean(activeProfile?.id && mailboxStatus?.configured);
  const {
    data: inboxData,
    isFetching: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useForwardedProfileMessages(activeProfile?.id, {
    enabled: canFetchMessages,
  });
  const messages = configured ? inboxData?.messages || [] : [];
  const filteredMessages = useMemo(() => filterMessages(messages, search), [messages, search]);
  const pageError = profilesError?.message || statusError?.message || (configured ? messagesError?.message : '') || '';

  useEffect(() => {
    if (!inboxProfiles[0]) return;
    const hasActiveProfile = inboxProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!activeProfileId || !hasActiveProfile) setActiveProfileId(inboxProfiles[0].id);
  }, [activeProfileId, inboxProfiles]);

  useEffect(() => {
    const nextProfileId = searchParams.get('profileId') || '';
    const nextSearch = searchParams.get('search') || '';
    if (searchParams.has('profileId') && String(nextProfileId) !== String(activeProfileId)) setActiveProfileId(nextProfileId);
    if (nextSearch !== search) setSearch(nextSearch);
  }, [activeProfileId, search, searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (activeProfileId) nextParams.set('profileId', activeProfileId);
    if (search) nextParams.set('search', search);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeProfileId, search, searchParams, setSearchParams]);

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

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {!inboxProfiles.length && !profilesLoading ? (
        <EmptyState
          title="No profiles available"
          detail="Profiles with mailbox access will appear here."
        />
      ) : null}

      {profilesLoading || inboxProfiles.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)', xl: '240px minmax(0, 1fr)' },
            gap: 1.5,
            alignItems: 'stretch',
            height: { xs: 'auto', md: 'calc(100vh - 108px)', xl: 'calc(100vh - 124px)' },
            minHeight: { md: 0 },
            minWidth: 0,
          }}
        >
          <BidProfileTabs
            activeColor={activeColor}
            activeProfile={activeProfile}
            isLoading={profilesLoading}
            profiles={inboxProfiles}
            showDailyGoal={false}
            onProfileChange={setActiveProfileId}
          />

          {activeProfile ? (
            <InboxMessagesPanel
              activeColor={activeColor}
              configured={configured}
              isLoading={statusLoading || (messagesLoading && !inboxData)}
              isRefreshing={messagesLoading && Boolean(inboxData)}
              mailboxEmail={mailboxEmail}
              messages={filteredMessages}
              profile={activeProfile}
              search={search}
              statusLoading={statusLoading}
              totalMessages={messages.length}
              onRefresh={() => refetchMessages()}
            />
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function InboxMessagesPanel({
  activeColor,
  configured,
  isLoading,
  isRefreshing,
  mailboxEmail,
  messages,
  profile,
  search,
  statusLoading,
  totalMessages,
  onRefresh,
}) {
  const scrollRef = useRef(null);
  const hasMatcher = Boolean(profile.forwardingEmail || profile.email);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [profile.id, search]);

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        boxShadow: 1,
        height: { xs: 'auto', md: '100%' },
        minHeight: { md: 0 },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1,
          px: 1.25,
          py: 0.75,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'grid', gap: 0.35, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
            <InboxIcon sx={{ color: activeColor.main, fontSize: 20 }} />
            <Typography fontWeight={900}>Forwarding inbox</Typography>
            {statusLoading ? <CircularProgress size={16} /> : null}
            {configured ? (
              <Chip label={mailboxEmail} size="small" color="success" variant="outlined" />
            ) : (
              <Chip label="Not configured" size="small" variant="outlined" />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" noWrap>
            {profile.name || 'Selected profile'}
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={isRefreshing || isLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
          disabled={statusLoading || !configured || !profile.id}
          onClick={onRefresh}
          variant="outlined"
          sx={{ my: { sm: 0.5 }, minHeight: 34, whiteSpace: 'nowrap' }}
        >
          Refresh
        </Button>
      </Box>

      <Box
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: { xs: 1, sm: 1.5 },
          minHeight: { xs: 320, md: 0 },
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {!configured ? <Alert severity="warning">Forwarding mailbox is not configured.</Alert> : null}
        {!hasMatcher ? <Alert severity="warning">Add a profile email or forwarding alias before classifying messages.</Alert> : null}
        {isRefreshing ? <LoadingOverlay label="Refreshing inbox..." /> : null}
        <Stack ref={scrollRef} spacing={0.75} aria-busy={isLoading} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
          {isLoading ? <InboxMessageSkeletonList /> : null}
          {!isLoading && !messages.length ? (
            <EmptyState
              title={search && totalMessages ? 'No messages match your search' : 'No recent inbox messages'}
              detail={search && totalMessages ? 'Try a different sender, subject, or keyword.' : 'Forwarded messages for this profile will appear here.'}
              sx={{ flexShrink: 0 }}
            />
          ) : null}
          {!isLoading
            ? messages.map((message) => (
                <InboxMessageCard
                  key={message.id}
                  activeColor={activeColor}
                  message={message}
                />
              ))
            : null}
        </Stack>
      </Box>
    </Paper>
  );
}

function InboxMessageCard({ activeColor, message }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderRadius: 1,
        borderLeft: 4,
        borderLeftColor: message.isRead ? 'divider' : activeColor.main,
        bgcolor: message.isRead ? 'background.paper' : 'rgba(219, 234, 254, 0.35)',
        flexShrink: 0,
      }}
    >
      <Stack spacing={0.75}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'flex-start' }} justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={message.isRead ? 800 : 900} noWrap>
              {message.subject || '(No subject)'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {messageSender(message)} · {formatMessageDate(message.receivedAt)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
            <Chip
              label={message.isRead ? 'Read' : 'Unread'}
              size="small"
              sx={{
                height: 22,
                fontSize: 11,
                fontWeight: 800,
                bgcolor: message.isRead ? '#F8FAFC' : activeColor.soft,
                color: message.isRead ? 'text.secondary' : activeColor.dark,
              }}
            />
            {message.match?.source ? (
              <Chip
                label={matchSourceLabel(message.match.source)}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: 11, fontWeight: 800 }}
              />
            ) : null}
          </Stack>
        </Stack>
        {message.bodyPreview ? (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.bodyPreview}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

function InboxMessageSkeletonList() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <Paper key={`inbox-message-loading-${index}`} variant="outlined" sx={{ p: 1.25, borderRadius: 1, flexShrink: 0 }}>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Skeleton width="58%" />
                <Skeleton width="38%" />
              </Box>
              <Skeleton variant="rounded" width={74} height={22} />
            </Stack>
            <Skeleton variant="rounded" height={54} />
          </Stack>
        </Paper>
      ))}
    </>
  );
}

function LoadingOverlay({ label }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'rgba(255, 255, 255, 0.62)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <Box sx={{ display: 'grid', placeItems: 'center', gap: 1 }}>
        <CircularProgress size={30} />
        <Typography color="text.secondary" variant="body2">
          {label}
        </Typography>
      </Box>
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
      messageSender(message),
      message.receivedAt,
      message.match?.value,
    ].some((value) => String(value || '').toLowerCase().includes(query)),
  );
}

function messageSender(message) {
  const from = message.from || {};
  return [from.name, from.address].filter(Boolean).join(' <') + (from.name && from.address ? '>' : '') || 'Unknown sender';
}

function formatMessageDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function matchSourceLabel(value) {
  if (String(value).startsWith('forwardingEmail')) return 'Forwarding alias';
  if (String(value).startsWith('profileEmail')) return 'Profile email';
  return 'Matched';
}
