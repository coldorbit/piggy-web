import { useQuery } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useRelatedCalendarCalls(interviewId, queryOptions = {}) {
  const normalizedInterviewId = String(interviewId || '').trim();
  return useQuery({
    queryKey: ['calendar', 'related-calls', normalizedInterviewId],
    queryFn: () => api(`/api/bid/calendar/interviews/${encodeURIComponent(normalizedInterviewId)}/related-calls`),
    enabled: Boolean(normalizedInterviewId),
    staleTime: 60_000,
    ...queryOptions,
  });
}
