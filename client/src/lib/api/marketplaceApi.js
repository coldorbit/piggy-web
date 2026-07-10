import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useMarketplace() {
  return useQuery({ queryKey: ['marketplace'], queryFn: () => api('/api/marketplace') });
}

function marketplaceMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }) });
}

export function useUpsertMarketplaceParticipant() {
  return marketplaceMutation((participantData) => api('/api/marketplace/participant', { method: 'POST', body: JSON.stringify(participantData) }).then((data) => data.participant));
}

export function useReviewMarketplaceParticipant() {
  return marketplaceMutation(({ participantId, reviewData }) => api(`/api/marketplace/participants/${participantId}/review`, { method: 'PATCH', body: JSON.stringify(reviewData) }).then((data) => data.participant));
}

export function useCreateMarketplaceInterview() {
  return marketplaceMutation((interviewData) => api('/api/marketplace/interviews', { method: 'POST', body: JSON.stringify(interviewData) }).then((data) => data.interview));
}

export function useReviewMarketplaceInterview() {
  return marketplaceMutation(({ interviewId, reviewData }) => api(`/api/marketplace/interviews/${interviewId}/review`, { method: 'PATCH', body: JSON.stringify(reviewData) }).then((data) => data.interview));
}

export function useCreateMarketplaceCaller() {
  return marketplaceMutation((callerData) => api('/api/marketplace/callers', { method: 'POST', body: JSON.stringify(callerData) }).then((data) => data.caller));
}

export function useReviewMarketplaceCaller() {
  return marketplaceMutation(({ callerId, reviewData }) => api(`/api/marketplace/callers/${callerId}/review`, { method: 'PATCH', body: JSON.stringify(reviewData) }).then((data) => data.caller));
}

export function useCreateMarketplaceMatch() {
  return marketplaceMutation((matchData) => api('/api/marketplace/matches', { method: 'POST', body: JSON.stringify(matchData) }).then((data) => data.match));
}

export function useUpdateMarketplaceMatch() {
  return marketplaceMutation(({ matchId, matchData }) => api(`/api/marketplace/matches/${matchId}`, { method: 'PATCH', body: JSON.stringify(matchData) }).then((data) => data.match));
}
