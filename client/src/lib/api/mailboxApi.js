import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useForwardingMailboxStatus(queryOptions = {}) {
  return useQuery({ queryKey: ['bid', 'mailbox', 'status'], queryFn: () => api('/api/bid/mailbox/status'), staleTime: 30_000, ...queryOptions });
}

export function useMailboxNotificationMessages({ workspaceId, ...queryOptions } = {}) {
  return useQuery({
    queryKey: ['bid', 'mailbox', 'notifications', mailboxWorkspaceKey(workspaceId)],
    queryFn: () => api(mailboxUrl('/api/bid/mailbox/notifications', { limit: 25, workspaceId })),
    staleTime: 0,
    retry: false,
    ...queryOptions,
  });
}

export function useForwardedMailboxSummary({ workspaceId, ...queryOptions } = {}) {
  return useQuery({
    queryKey: ['bid', 'mailbox', 'summary', mailboxWorkspaceKey(workspaceId)],
    queryFn: () => api(mailboxUrl('/api/bid/mailbox/summary', { workspaceId })),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    retry: false,
    ...queryOptions,
  });
}

export function useForwardedMailboxMessages({ workspaceId, ...queryOptions } = {}) {
  return useInfiniteQuery({
    queryKey: ['bid', 'mailbox', 'messages', mailboxWorkspaceKey(workspaceId)],
    queryFn: ({ pageParam = 0 }) => api(pageParam === 0
      ? mailboxUrl('/api/bid/mailbox/bootstrap', { limit: 10, offset: 0, workspaceId })
      : mailboxUrl('/api/bid/mailbox/messages', {
          includeStats: false,
          limit: 10,
          offset: pageParam,
          workspaceId,
        })),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage?.pagination?.hasMore ? lastPage.pagination.nextOffset : undefined,
    staleTime: 15_000,
    ...queryOptions,
  });
}

export function useForwardedProfileMessages(profileId, { workspaceId, ...queryOptions } = {}) {
  return useInfiniteQuery({
    queryKey: ['bid', 'profiles', profileId, 'mailbox', 'messages', mailboxWorkspaceKey(workspaceId)],
    queryFn: ({ pageParam = 0 }) => api(mailboxUrl(`/api/bid/profiles/${profileId}/mailbox/messages`, {
      includeStats: false,
      limit: 10,
      offset: pageParam,
      workspaceId,
    })),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage?.pagination?.hasMore ? lastPage.pagination.nextOffset : undefined,
    enabled: Boolean(profileId),
    staleTime: 15_000,
    ...queryOptions,
  });
}

function mailboxWorkspaceKey(workspaceId) {
  return String(workspaceId || 'all');
}

function mailboxUrl(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || (key === 'workspaceId' && value === 'all')) continue;
    query.set(key, String(value));
  }
  const queryString = query.toString();
  return `${path}${queryString ? `?${queryString}` : ''}`;
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
      const previousData = queryClient.getQueriesData({ queryKey });
      const previousAggregateData = queryClient.getQueriesData({ queryKey: aggregateQueryKey });
      const previousSummaryData = queryClient.getQueriesData({ queryKey: summaryQueryKey });
      const previousNotificationsData = queryClient.getQueriesData({ queryKey: notificationsQueryKey });
      queryClient.setQueriesData({ queryKey }, (data) => updateMailboxMessageReadState(data, messageId, { isRead: true }));
      queryClient.setQueriesData({ queryKey: aggregateQueryKey }, (data) => updateMailboxBootstrapSummary(
        updateMailboxMessageReadState(data, messageId, { isRead: true }),
        profileId,
        { wasUnread },
      ));
      queryClient.setQueriesData({ queryKey: summaryQueryKey }, (data) => updateMailboxSummaryReadState(data, profileId, { wasUnread }));
      queryClient.setQueriesData({ queryKey: notificationsQueryKey }, (data) => updateMailboxNotificationReadState(data, messageId, { decrementMissing: true, wasUnread }));
      return { aggregateQueryKey, notificationsQueryKey, previousAggregateData, previousData, previousNotificationsData, previousSummaryData, queryKey, summaryQueryKey };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousAggregateData);
      restoreQueries(queryClient, context?.previousData);
      restoreQueries(queryClient, context?.previousNotificationsData);
      restoreQueries(queryClient, context?.previousSummaryData);
    },
    onSuccess: (message, { profileId, messageId }) => {
      queryClient.setQueriesData({ queryKey: ['bid', 'profiles', profileId, 'mailbox', 'messages'] }, (data) => updateMailboxMessageReadState(data, messageId, message));
      queryClient.setQueriesData({ queryKey: ['bid', 'mailbox', 'notifications'] }, (data) => updateMailboxNotificationReadState(data, messageId));
      queryClient.setQueriesData({ queryKey: ['bid', 'mailbox', 'messages'] }, (data) => updateMailboxMessageReadState(data, messageId, message));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'mailbox', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'mailbox', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'mailbox', 'summary'] });
    },
  });
}

function restoreQueries(queryClient, queries = []) {
  for (const [queryKey, data] of queries || []) queryClient.setQueryData(queryKey, data);
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
