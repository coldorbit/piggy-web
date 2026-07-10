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

import { InboxMessageSkeletonList, classificationAccent, formatMessageDateShort, messageSenderName, smallChipSx } from './InboxReadingPane.jsx';

export function MessageListPane({
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
          <Typography fontWeight={600} noWrap>{title}</Typography>
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

export function VirtualizedMessageList({
  canLoadMore,
  isLoadingMore,
  messages,
  selectedMessage,
  onLoadMore,
  onMessageSelect,
}) {
  const listRef = useRef(null);
  const listHeightRef = useRef(COMPACT_MESSAGE_ROW_HEIGHT);
  const rowCount = messages.length + (canLoadMore ? 1 : 0);
  const loadThresholdIndex = Math.max(messages.length - 3, 0);
  const selectedIndex = selectedMessage
    ? messages.findIndex((message) => String(message.id) === String(selectedMessage.id))
    : -1;
  const scrollToIndex = selectedIndex >= 0 ? selectedIndex : undefined;

  const selectMessageAtIndex = useCallback((index) => {
    const boundedIndex = Math.min(Math.max(index, 0), messages.length - 1);
    const message = messages[boundedIndex];
    if (!message) return;
    onMessageSelect(message.id);
    listRef.current?.scrollToRow(boundedIndex);
    if (canLoadMore && !isLoadingMore && boundedIndex >= loadThresholdIndex) onLoadMore?.();
  }, [canLoadMore, isLoadingMore, loadThresholdIndex, messages, onLoadMore, onMessageSelect]);

  const handleKeyDown = useCallback((event) => {
    if (!messages.length || event.altKey || event.ctrlKey || event.metaKey) return;

    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const pageSize = Math.max(1, Math.floor(listHeightRef.current / COMPACT_MESSAGE_ROW_HEIGHT) - 1);
    const keyActions = {
      ArrowDown: () => selectMessageAtIndex(currentIndex + 1),
      ArrowUp: () => selectMessageAtIndex(currentIndex - 1),
      Home: () => selectMessageAtIndex(0),
      End: () => selectMessageAtIndex(messages.length - 1),
      PageDown: () => selectMessageAtIndex(currentIndex + pageSize),
      PageUp: () => selectMessageAtIndex(currentIndex - pageSize),
      Enter: () => selectMessageAtIndex(currentIndex),
      ' ': () => selectMessageAtIndex(currentIndex),
    };
    const action = keyActions[event.key];
    if (!action) return;

    event.preventDefault();
    action();
  }, [messages.length, selectMessageAtIndex, selectedIndex]);

  return (
    <Box
      aria-activedescendant={selectedMessage ? `inbox-message-${selectedMessage.id}` : undefined}
      aria-label="Email messages"
      onKeyDown={handleKeyDown}
      role="listbox"
      tabIndex={0}
      sx={{
        height: '100%',
        minHeight: 0,
        outline: 'none',
        '&:focus-visible': {
          boxShadow: `inset 0 0 0 2px ${INBOX_MESSAGE_ACCENT.main}`,
        },
      }}
    >
      <AutoSizer>
        {({ height, width }) => {
          listHeightRef.current = height || COMPACT_MESSAGE_ROW_HEIGHT;
          return (
            <VirtualizedList
              ref={listRef}
              height={height}
              width={width}
              rowCount={rowCount}
              rowHeight={COMPACT_MESSAGE_ROW_HEIGHT}
              overscanRowCount={6}
              scrollToIndex={scrollToIndex}
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
          );
        }}
      </AutoSizer>
    </Box>
  );
}

export function MessageLoadingRow({ isLoading, style }) {
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
        <Typography variant="caption" fontWeight={600}>
          {isLoading ? 'Loading more messages' : 'Scroll for more messages'}
        </Typography>
      </Stack>
    </Box>
  );
}

export function MessageListItem({ isSelected, message, onClick, style }) {
  const hasListChips = !message.isRead || Boolean(message.classification?.label) || Boolean(message.mailboxPath);
  const selectedBg = INBOX_MESSAGE_ACCENT.soft;
  const defaultBg = message.isRead ? '#ffffff' : 'rgba(246, 248, 251, 0.86)';
  const hoverBg = isSelected ? selectedBg : 'rgba(246, 248, 251, 0.86)';
  return (
    <Box
      component="button"
      type="button"
      aria-selected={isSelected}
      id={`inbox-message-${message.id}`}
      onClick={onClick}
      role="option"
      style={style}
      tabIndex={-1}
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
          {message.classification?.label ? <Chip label={message.classification.label} size="small" sx={smallChipSx(classificationAccent(message).soft, classificationAccent(message).dark)} /> : null}
          {message.mailboxPath ? <Chip label={message.mailboxPath} size="small" variant="outlined" sx={smallOutlinedChipSx} /> : null}
        </Stack>
      ) : null}
    </Box>
  );
}
