import { useQuery } from '@tanstack/react-query';
import { api } from '../authApi.js';
import { millisecondsUntilNextLocalDayStart } from '../timezone.js';

const LOCAL_DAY_ROLLOVER_REFETCH_DELAY_MS = 1_000;
const localDayRolloverRefetchInterval = () => millisecondsUntilNextLocalDayStart() + LOCAL_DAY_ROLLOVER_REFETCH_DELAY_MS;

export function useAssessmentProfiles(queryOptions = {}) {
  return useQuery({
    queryKey: ['assessments', 'profiles'],
    queryFn: () => api('/api/assessments/profiles').then((data) => data.profiles),
    staleTime: 60_000,
    refetchInterval: localDayRolloverRefetchInterval,
    ...queryOptions,
  });
}

export function useAssessments(profileId, queryOptions = {}) {
  const normalizedProfileId = String(profileId || '').trim();
  const params = new URLSearchParams();
  if (normalizedProfileId && normalizedProfileId !== 'all') params.set('profileId', normalizedProfileId);
  return useQuery({ queryKey: ['assessments', normalizedProfileId || 'all'], queryFn: () => api(`/api/assessments${params.size ? `?${params}` : ''}`), staleTime: 15_000, ...queryOptions });
}

export function usePersonalDashboard(filters = {}, queryOptions = {}) {
  const params = new URLSearchParams();
  if (filters.grain) params.set('grain', filters.grain);
  if (filters.anchorDate) params.set('anchorDate', filters.anchorDate);
  const query = params.toString();
  return useQuery({ queryKey: ['bid', 'dashboard', filters], queryFn: () => api(`/api/bid/dashboard${query ? `?${query}` : ''}`).then((data) => data.dashboard), staleTime: 30_000, refetchInterval: localDayRolloverRefetchInterval, ...queryOptions });
}

export function useActionQueue(queryOptions = {}) {
  return useQuery({ queryKey: ['bid', 'action-queue'], queryFn: () => api('/api/bid/action-queue').then((data) => data.queue), staleTime: 15_000, ...queryOptions });
}
