import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useForwardingMailboxStatus(queryOptions = {}) {
  return useQuery({ queryKey: ['bid', 'mailbox', 'status'], queryFn: () => api('/api/bid/mailbox/status'), staleTime: 30_000, ...queryOptions });
}

export function useMailboxNotificationMessages(queryOptions = {}) {
  return useQuery({ queryKey: ['bid', 'mailbox', 'notifications'], queryFn: () => api('/api/bid/mailbox/notifications?limit=25'), staleTime: 0, retry: false, ...queryOptions });
}

export function useForwardedMailboxSummary(queryOptions = {}) {
  return useQuery({ queryKey: ['bid', 'mailbox', 'summary'], queryFn: () => api('/api/bid/mailbox/summary'), staleTime: 15_000, placeholderData: keepPreviousData, retry: false, ...queryOptions });
}

export function useForwardedMailboxMessages(queryOptions = {}) {
  return useInfiniteQuery({
    queryKey: ['bid', 'mailbox', 'messages'],
    queryFn: ({ pageParam = 0 }) => api(pageParam === 0
      ? '/api/bid/mailbox/bootstrap?limit=10&offset=0'
      : `/api/bid/mailbox/messages?limit=10&offset=${pageParam}&includeStats=false`),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage?.pagination?.hasMore ? lastPage.pagination.nextOffset : undefined,
    staleTime: 15_000,
    ...queryOptions,
  });
}

export function useForwardedProfileMessages(profileId, queryOptions = {}) {
  return useInfiniteQuery({
    queryKey: ['bid', 'profiles', profileId, 'mailbox', 'messages'],
    queryFn: ({ pageParam = 0 }) => api(`/api/bid/profiles/${profileId}/mailbox/messages?limit=10&offset=${pageParam}&includeStats=false`),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage?.pagination?.hasMore ? lastPage.pagination.nextOffset : undefined,
    enabled: Boolean(profileId),
    staleTime: 15_000,
    ...queryOptions,
  });
}

export function useMarkProfileMailboxMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, messageId }) => api(`/api/bid/profiles/${profileId}/mailbox/messages/read`, { method: 'PATCH', body: JSON.stringify({ messageId }) }).then((data) => data.message),
    onMutate: async ({ profileId, messageId, wasUnread = true }) => {
      const queryKey = ['bid', 'profiles', profileId, 'mailbox', 'messages'];
      const aggregateQueryKey = ['bid', 'mailbox', 'messages'];
      const summaryQueryKey = ['bid', 'mailbox', 'summary'];
      const notificationsQueryKey = ['bid', 'mailbox', 'notifications'];
      await Promise.all([
        queryClient.cancelQueries({ queryKey }),
        queryClient.cancelQueries({ queryKey: aggregateQueryKey }),
        queryClient.cancelQueries({ queryKey: summaryQueryKey }),
        queryClient.cancelQueries({ queryKey: notificationsQueryKey }),
      ]);
      const previousData = queryClient.getQueryData(queryKey);
      const previousAggregateData = queryClient.getQueryData(aggregateQueryKey);
      const previousSummaryData = queryClient.getQueryData(summaryQueryKey);
      const previousNotificationsData = queryClient.getQueryData(notificationsQueryKey);
      queryClient.setQueryData(queryKey, (data) => updateMailboxMessageReadState(data, messageId, { isRead: true }));
      queryClient.setQueryData(aggregateQueryKey, (data) => updateMailboxBootstrapSummary(
        updateMailboxMessageReadState(data, messageId, { isRead: true }),
        profileId,
        { wasUnread },
      ));
      queryClient.setQueryData(summaryQueryKey, (data) => updateMailboxSummaryReadState(data, profileId, { wasUnread }));
      queryClient.setQueryData(notificationsQueryKey, (data) => updateMailboxNotificationReadState(data, messageId, { decrementMissing: true, wasUnread }));
      return { aggregateQueryKey, notificationsQueryKey, previousAggregateData, previousData, previousNotificationsData, previousSummaryData, queryKey, summaryQueryKey };
    },
    onError: (_error, _variables, context) => {
      if (context?.aggregateQueryKey) queryClient.setQueryData(context.aggregateQueryKey, context.previousAggregateData);
      if (context?.queryKey) queryClient.setQueryData(context.queryKey, context.previousData);
      if (context?.notificationsQueryKey) queryClient.setQueryData(context.notificationsQueryKey, context.previousNotificationsData);
      if (context?.summaryQueryKey) queryClient.setQueryData(context.summaryQueryKey, context.previousSummaryData);
    },
    onSuccess: (message, { profileId, messageId }) => {
      queryClient.setQueryData(['bid', 'profiles', profileId, 'mailbox', 'messages'], (data) => updateMailboxMessageReadState(data, messageId, message));
      queryClient.setQueryData(['bid', 'mailbox', 'notifications'], (data) => updateMailboxNotificationReadState(data, messageId));
      queryClient.setQueryData(['bid', 'mailbox', 'messages'], (data) => updateMailboxMessageReadState(data, messageId, message));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'mailbox', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'mailbox', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'mailbox', 'summary'] });
    },
  });
}

function updateMailboxMessageReadState(currentData, messageId, updates = {}) {
  if (!currentData?.pages) return currentData;
  let changedUnread = false;
  let changedMessage = false;
  const pages = currentData.pages.map((page) => {
    let pageChanged = false;
    const messages = (page.messages || []).map((message) => {
      if (String(message.id) !== String(messageId)) return message;
      if (!message.isRead && updates.isRead !== false && !changedUnread) changedUnread = true;
      pageChanged = true;
      changedMessage = true;
      return { ...message, ...updates, isRead: updates.isRead !== undefined ? Boolean(updates.isRead) : true };
    });
    return pageChanged ? { ...page, messages } : page;
  });
  if (!changedMessage) return currentData;
  if (!changedUnread) return { ...currentData, pages };
  return {
    ...currentData,
    pages: pages.map((page) => ({ ...page, pagination: page.pagination ? { ...page.pagination, unreadTotal: Math.max(Number(page.pagination.unreadTotal || 0) - 1, 0) } : page.pagination })),
  };
}

function updateMailboxNotificationReadState(currentData, messageId, { decrementMissing = false, wasUnread = true } = {}) {
  if (!currentData?.messages) return currentData;
  let removedUnreadMessage = false;
  const messages = currentData.messages.filter((message) => {
    if (String(message.id) !== String(messageId)) return true;
    if (!message.isRead) removedUnreadMessage = true;
    return false;
  });
  const unreadDelta = removedUnreadMessage || (decrementMissing && wasUnread && messages.length === currentData.messages.length) ? 1 : 0;
  if (!unreadDelta && messages.length === currentData.messages.length) return currentData;
  return { ...currentData, messages, unreadTotal: Math.max(Number(currentData.unreadTotal || 0) - unreadDelta, 0) };
}

function updateMailboxSummaryReadState(currentData, profileId, { wasUnread = true } = {}) {
  if (!currentData || !wasUnread) return currentData;
  return {
    ...currentData,
    unreadTotal: Math.max(Number(currentData.unreadTotal || 0) - 1, 0),
    stats: decrementMailboxStatsUnread(currentData.stats),
    profiles: (currentData.profiles || []).map((profile) => String(profile.id) === String(profileId)
      ? { ...profile, unreadTotal: Math.max(Number(profile.unreadTotal || 0) - 1, 0), stats: decrementMailboxStatsUnread(profile.stats) }
      : profile),
  };
}

function updateMailboxBootstrapSummary(currentData, profileId, { wasUnread = true } = {}) {
  if (!currentData?.pages?.length || !wasUnread) return currentData;
  let changed = false;
  const pages = currentData.pages.map((page) => {
    if (!page?.summary) return page;
    changed = true;
    return { ...page, summary: updateMailboxSummaryReadState(page.summary, profileId, { wasUnread }) };
  });
  return changed ? { ...currentData, pages } : currentData;
}

function decrementMailboxStatsUnread(stats) {
  return stats ? { ...stats, unreadTotal: Math.max(Number(stats.unreadTotal || 0) - 1, 0) } : stats;
}
