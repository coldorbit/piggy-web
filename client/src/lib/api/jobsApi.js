import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function fetchJobDetail(jobId) {
  return api(`/api/jobs/${jobId}`).then((data) => data.job);
}

export function useJobDetail(jobId, queryOptions = {}) {
  const id = String(jobId || '');
  return useQuery({
    queryKey: ['jobs', 'detail', id],
    queryFn: () => fetchJobDetail(id),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
    ...queryOptions,
  });
}

export function useRecordRankingImpressions() {
  return useMutation({
    mutationFn: (payload) => api('/api/bid/ranking-impressions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  });
}
