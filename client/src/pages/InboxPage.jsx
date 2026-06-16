import { useEffect, useMemo, useState } from 'react';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Avatar,
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
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { useBidProfiles, useForwardedProfileMessages, useForwardingMailboxStatus } from '../lib/api.js';
import { isAdminRole } from '../lib/roles.js';

export default function InboxPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
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
  const selectedMessage = useMemo(
    () => filteredMessages.find((message) => String(message.id) === String(selectedMessageId)) || filteredMessages[0] || null,
    [filteredMessages, selectedMessageId],
  );
  const pageError = profilesError?.message || statusError?.message || (configured ? messagesError?.message : '') || '';
  const isLoadingMessages = statusLoading || (messagesLoading && !inboxData);
  const unreadCount = messages.filter((message) => !message.isRead).length;
  const hasMatcher = Boolean(activeProfile?.forwardingEmail || activeProfile?.email);

  useEffect(() => {
    if (!inboxProfiles[0]) return;
    const hasActiveProfile = inboxProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!activeProfileId || !hasActiveProfile) setActiveProfileId(inboxProfiles[0].id);
  }, [activeProfileId, inboxProfiles]);

  useEffect(() => {
    const nextProfileId = searchParams.get('profileId') || '';
    const nextSearch = searchParams.get('search') || '';
    setActiveProfileId((currentProfileId) => (
      searchParams.has('profileId') && String(nextProfileId) !== String(currentProfileId)
        ? nextProfileId
        : currentProfileId
    ));
    setSearch((currentSearch) => (nextSearch !== currentSearch ? nextSearch : currentSearch));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (activeProfileId) nextParams.set('profileId', activeProfileId);
    if (search) nextParams.set('search', search);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeProfileId, search, searchParams, setSearchParams]);

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
            activeProfile={activeProfile}
            inboxProfiles={inboxProfiles}
            isLoading={profilesLoading}
            mailboxEmail={mailboxEmail}
            messagesCount={messages.length}
            onProfileChange={setActiveProfileId}
            statusLoading={statusLoading}
            unreadCount={unreadCount}
          />

          <MessageListPane
            activeColor={activeColor}
            configured={configured}
            hasMatcher={hasMatcher}
            isLoading={isLoadingMessages}
            isRefreshing={messagesLoading && Boolean(inboxData)}
            messages={filteredMessages}
            profile={activeProfile}
            search={search}
            selectedMessage={selectedMessage}
            totalMessages={messages.length}
            onMessageSelect={setSelectedMessageId}
            onRefresh={() => refetchMessages()}
          />

          <ReadingPane
            activeColor={activeColor}
            configured={configured}
            isLoading={isLoadingMessages}
            message={selectedMessage}
            profile={activeProfile}
          />
        </Paper>
      ) : null}
    </Box>
  );
}

function MailboxSidebar({
  activeColor,
  activeProfile,
  inboxProfiles,
  isLoading,
  mailboxEmail,
  messagesCount,
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
        <MailboxNavRow icon={<InboxIcon fontSize="small" />} label="Inbox" count={messagesCount} selected />
        <MailboxNavRow icon={<MarkEmailUnreadIcon fontSize="small" />} label="Unread" count={unreadCount} />
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

function MailboxNavRow({ count, icon, label, selected = false }) {
  return (
    <Box
      sx={{
        minHeight: 34,
        px: 1,
        borderRadius: 1,
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 0.75,
        color: selected ? 'primary.dark' : 'text.secondary',
        bgcolor: selected ? '#E0ECFF' : 'transparent',
        fontWeight: selected ? 900 : 800,
      }}
    >
      {icon}
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
  activeColor,
  configured,
  hasMatcher,
  isLoading,
  isRefreshing,
  messages,
  profile,
  search,
  selectedMessage,
  totalMessages,
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box minWidth={0}>
          <Typography fontWeight={950} noWrap>{profile?.name || 'Inbox'}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {messages.length.toLocaleString()} of {totalMessages.toLocaleString()} messages
          </Typography>
        </Box>
        <Tooltip title="Refresh inbox">
          <span>
            <IconButton size="small" disabled={!configured || !profile?.id} onClick={onRefresh}>
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
            title={search && totalMessages ? 'No messages match your search' : 'No recent inbox messages'}
            detail={search && totalMessages ? 'Try a different sender, subject, or keyword.' : 'Forwarded messages for this profile will appear here.'}
            variant="plain"
            sx={{ py: 5, bgcolor: 'transparent' }}
          />
        ) : null}
        {!isLoading
          ? messages.map((message) => (
              <MessageListItem
                key={message.id}
                activeColor={activeColor}
                isSelected={String(message.id) === String(selectedMessage?.id)}
                message={message}
                onClick={() => onMessageSelect(message.id)}
              />
            ))
          : null}
      </Box>
    </Box>
  );
}

function MessageListItem({ activeColor, isSelected, message, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        border: 0,
        borderBottom: 1,
        borderColor: 'divider',
        borderRadius: 0,
        bgcolor: isSelected ? activeColor.soft : message.isRead ? '#ffffff' : '#F8FAFC',
        cursor: 'pointer',
        px: 1,
        py: 1,
        display: 'grid',
        gap: 0.5,
        textAlign: 'left',
        boxShadow: isSelected ? `inset 3px 0 0 ${activeColor.main}` : 'none',
        '&:hover': { bgcolor: isSelected ? activeColor.soft : '#F8FAFC' },
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
      <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
        {!message.isRead ? <Chip label="Unread" size="small" sx={smallChipSx(activeColor.soft, activeColor.dark)} /> : null}
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

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 1.5, md: 2 }, py: 2 }}>
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
        </>
      )}
    </Box>
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
      messageSender(message),
      message.receivedAt,
      message.mailboxPath,
      message.match?.value,
    ].some((value) => String(value || '').toLowerCase().includes(query)),
  );
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
