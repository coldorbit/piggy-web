import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useCallers() {
  return useQuery({ queryKey: ['bid', 'callers'], queryFn: () => api('/api/bid/callers').then((data) => data.callers) });
}

export function useCreateCaller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callerData) => api('/api/bid/callers', { method: 'POST', body: JSON.stringify(callerData) }).then((data) => data.caller),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useBidders() {
  return useQuery({ queryKey: ['bid', 'bidders'], queryFn: () => api('/api/bid/bidders').then((data) => data.bidders) });
}

export function useSourceRoi() {
  return useQuery({ queryKey: ['bid', 'source-roi'], queryFn: () => api('/api/bid/source-roi').then((data) => data.roi), staleTime: 30_000 });
}

export function useCollaborationEvents(filters = {}, queryOptions = {}) {
  const queryParams = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ['bid', 'collaboration', filters],
    queryFn: () => api(`/api/bid/collaboration${queryParams ? `?${queryParams}` : ''}`).then((data) => data.events),
    enabled: Boolean(filters.entityType && filters.entityId) || Boolean(filters.profileId),
    staleTime: 10_000,
    ...queryOptions,
  });
}

export function useCreateCollaborationEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventData) => api('/api/bid/collaboration', { method: 'POST', body: JSON.stringify(eventData) }).then((data) => data.event),
    onSuccess: (event) => invalidateCollaborationQueries(queryClient, event),
  });
}

export function useUpdateCollaborationEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, updates }) => api(`/api/bid/collaboration/${eventId}`, { method: 'PATCH', body: JSON.stringify(updates) }).then((data) => data.event),
    onSuccess: (event) => invalidateCollaborationQueries(queryClient, event),
  });
}

export function useTailoringRequests(filters = {}, queryOptions = {}) {
  const queryParams = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ['bid', 'tailoring-requests', filters],
    queryFn: () => api(`/api/bid/tailoring-requests${queryParams ? `?${queryParams}` : ''}`),
    staleTime: 15_000,
    ...queryOptions,
  });
}

export function useCreateManualTailoredResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tailoringData) => api('/api/bid/tailored-resumes/manual', { method: 'POST', body: JSON.stringify(tailoringData) }).then((data) => data.tailoredResume),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'tailoring-requests'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
    },
  });
}

function invalidateCollaborationQueries(queryClient, event) {
  queryClient.invalidateQueries({ queryKey: ['bid', 'collaboration'] });
  if (event?.profileId) queryClient.invalidateQueries({ queryKey: ['bid', 'collaboration', { profileId: event.profileId }] });
  if (event?.entityType && event?.entityId) queryClient.invalidateQueries({ queryKey: ['bid', 'collaboration', { entityType: event.entityType, entityId: event.entityId }] });
}
