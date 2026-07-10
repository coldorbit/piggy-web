import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForwardingMailboxStatus, useMailboxNotificationMessages } from './api.js';

const MAILBOX_NOTIFICATION_POLL_MS = 60_000;
const ENABLED_STORAGE_PREFIX = 'applypilot-mailbox-notifications-enabled:';
const SEEN_STORAGE_PREFIX = 'applypilot-mailbox-notifications-seen:';
const MAX_SEEN_MESSAGE_IDS = 250;

export function useMailboxNotifications({ enabled = true, onOpenMessage, user } = {}) {
  const queryClient = useQueryClient();
  const storageUserKey = useMemo(() => String(user?.id || user?.username || 'current'), [user?.id, user?.username]);
  const enabledStorageKey = useMemo(() => `${ENABLED_STORAGE_PREFIX}${storageUserKey}`, [storageUserKey]);
  const seenStorageKey = useMemo(() => `${SEEN_STORAGE_PREFIX}${storageUserKey}`, [storageUserKey]);
  const [permission, setPermission] = useState(() => browserNotificationPermission());
  const [isOptedIn, setIsOptedIn] = useState(() => readNotificationEnabledPreference(enabledStorageKey));
  const seenMessageIdsRef = useRef(new Set(readSeenMessageIds(seenStorageKey)));
  const initializedRef = useRef(seenMessageIdsRef.current.size > 0);
  const isSupported = notificationSupported();
  const mailboxStatusQuery = useForwardingMailboxStatus({
    enabled,
  });
  const canFetchMailboxMessages = Boolean(enabled && mailboxStatusQuery.data?.configured);
  const canNotify = Boolean(canFetchMailboxMessages && isSupported && isOptedIn && permission === 'granted');
  const notificationQuery = useMailboxNotificationMessages({
    enabled: canFetchMailboxMessages,
    refetchInterval: canFetchMailboxMessages ? MAILBOX_NOTIFICATION_POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const messages = useMemo(() => notificationQuery.data?.messages || [], [notificationQuery.data]);
  const unreadCount = Math.max(Number(notificationQuery.data?.unreadTotal || 0), 0);

  useEffect(() => {
    const seenMessageIds = new Set(readSeenMessageIds(seenStorageKey));
    seenMessageIdsRef.current = seenMessageIds;
    initializedRef.current = seenMessageIds.size > 0;
    setIsOptedIn(readNotificationEnabledPreference(enabledStorageKey));
  }, [enabledStorageKey, seenStorageKey]);

  useEffect(() => {
    if (!isSupported) return undefined;

    const syncPermission = () => {
      setPermission(browserNotificationPermission());
    };

    syncPermission();
    document.addEventListener('visibilitychange', syncPermission);
    return () => document.removeEventListener('visibilitychange', syncPermission);
  }, [isSupported]);

  useEffect(() => {
    if (!canNotify || !notificationQuery.dataUpdatedAt) return;

    const seenMessageIds = seenMessageIdsRef.current;
    const notificationMessages = messages.filter((message) => message?.id && !seenMessageIds.has(String(message.id)));

    if (!initializedRef.current) {
      for (const message of messages) {
        if (message?.id) seenMessageIds.add(String(message.id));
      }
      initializedRef.current = true;
      writeSeenMessageIds(seenStorageKey, seenMessageIds);
      return;
    }

    if (!notificationMessages.length) return;

    for (const message of notificationMessages) {
      seenMessageIds.add(String(message.id));
    }
    writeSeenMessageIds(seenStorageKey, seenMessageIds);

    for (const message of [...notificationMessages].reverse()) {
      showMailboxNotification(message, onOpenMessage);
    }

    queryClient.invalidateQueries({ queryKey: ['bid', 'mailbox', 'messages'] });
    queryClient.invalidateQueries({ queryKey: ['bid', 'mailbox', 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
    for (const profileId of new Set(notificationMessages.map((message) => message?.matchedProfile?.id).filter(Boolean))) {
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles', profileId, 'mailbox', 'messages'] });
    }
  }, [
    canNotify,
    messages,
    notificationQuery.dataUpdatedAt,
    onOpenMessage,
    queryClient,
    seenStorageKey,
  ]);

  const requestNotifications = useCallback(async () => {
    if (!isSupported) return 'unsupported';

    let nextPermission = browserNotificationPermission();
    if (nextPermission === 'default') {
      nextPermission = await requestBrowserNotificationPermission();
    }

    setPermission(nextPermission);
    const shouldEnable = nextPermission === 'granted';
    setIsOptedIn(shouldEnable);
    writeNotificationEnabledPreference(enabledStorageKey, shouldEnable);
    return nextPermission;
  }, [enabledStorageKey, isSupported]);

  const disableNotifications = useCallback(() => {
    setIsOptedIn(false);
    writeNotificationEnabledPreference(enabledStorageKey, false);
  }, [enabledStorageKey]);

  const toggleNotifications = useCallback(async () => {
    if (canNotify) {
      disableNotifications();
      return 'disabled';
    }
    return requestNotifications();
  }, [canNotify, disableNotifications, requestNotifications]);

  return {
    canNotify,
    disableNotifications,
    isEnabled: canNotify,
    isOptedIn,
    isSupported,
    permission,
    requestNotifications,
    toggleNotifications,
    unreadCount,
  };
}

function showMailboxNotification(message, onOpenMessage) {
  if (!notificationSupported() || browserNotificationPermission() !== 'granted') return;

  try {
    const notification = new window.Notification(notificationTitle(message), {
      body: notificationBody(message),
      icon: '/assets/applypilot-logo.png',
      tag: `applypilot-mailbox:${message.id}`,
    });

    notification.onclick = () => {
      window.focus();
      onOpenMessage?.(message);
      notification.close();
    };
  } catch (error) {
    console.warn('Unable to show mailbox notification:', error);
  }
}

function notificationTitle(message) {
  return cleanNotificationText(message?.subject) || 'New email';
}

function notificationBody(message) {
  return [
    messageSenderName(message),
    message?.matchedProfile?.name ? `For ${message.matchedProfile.name}` : '',
    cleanNotificationText(message?.bodyPreview),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 240);
}

function messageSenderName(message) {
  return message?.from?.name || message?.from?.address || 'Unknown sender';
}

function cleanNotificationText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function browserNotificationPermission() {
  if (!notificationSupported()) return 'unsupported';
  return window.Notification.permission || 'default';
}

async function requestBrowserNotificationPermission() {
  if (!notificationSupported()) return 'unsupported';
  const result = window.Notification.requestPermission();
  if (result?.then) return result;
  return browserNotificationPermission();
}

function readNotificationEnabledPreference(key) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === 'true';
}

function writeNotificationEnabledPreference(key, value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, String(Boolean(value)));
}

function readSeenMessageIds(key) {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeSeenMessageIds(key, seenMessageIds) {
  if (typeof window === 'undefined') return;
  const ids = [...seenMessageIds].slice(-MAX_SEEN_MESSAGE_IDS);
  seenMessageIds.clear();
  for (const id of ids) seenMessageIds.add(id);
  window.localStorage.setItem(key, JSON.stringify(ids));
}
