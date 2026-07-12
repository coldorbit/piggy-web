import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../authApi.js';

export function useCreateUser() { return userMutation('POST'); }
export function useUpdateUser() { return userMutation('PATCH'); }

function userMutation(method) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: method === 'POST'
      ? (userData) => api('/api/admin/users', { method, body: JSON.stringify(userData) }).then((data) => data.user)
      : ({ userId, userData }) => api(`/api/admin/users/${userId}`, { method, body: JSON.stringify(userData) }).then((data) => data.user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => api(`/api/admin/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
    },
  });
}

export function useCreateBidProfile() { return profileMutation('POST'); }
export function useUpdateBidProfile() { return profileMutation('PATCH'); }

function profileMutation(method) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: method === 'POST'
      ? (profileData) => api('/api/bid/profiles', { method, body: JSON.stringify(profilePayload(profileData)) }).then((data) => data.profile)
      : ({ profileId, profileData }) => api(`/api/bid/profiles/${profileId}`, { method, body: JSON.stringify(profilePayload(profileData)) }).then((data) => data.profile),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] }),
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assessmentData) => api('/api/assessments', { method: 'POST', body: JSON.stringify(assessmentData) }).then((data) => data.assessment),
    onSuccess: (assessment) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessments', assessment?.profileId] });
    },
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ assessmentId }) => api(`/api/assessments/${assessmentId}`, { method: 'DELETE' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assessments'] }) });
}

export function useMarkAssessmentDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId }) => api(`/api/assessments/${assessmentId}/done`, { method: 'PATCH' }).then((data) => data.assessment),
    onSuccess: (assessment) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessments', assessment?.profileId] });
    },
  });
}

export function useChangeBidProfileOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, ownerUserId, workspaceId }) => api(`/api/bid/profiles/${profileId}/owner`, {
      method: 'PATCH',
      body: JSON.stringify({ ownerUserId, ...(workspaceId !== undefined ? { workspaceId } : {}) }),
    }).then((data) => data.profile),
    onSuccess: () => invalidateBidAdmin(queryClient),
  });
}

export function useUpdateBidProfileStatus() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ profileId, status, reason }) => api(`/api/bid/profiles/${profileId}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }).then((data) => data.profile), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bid'] }) });
}

export function useDeleteBidProfile() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (profileId) => api(`/api/bid/profiles/${profileId}`, { method: 'DELETE' }), onSuccess: () => invalidateBidAdmin(queryClient) });
}

export function useShareBidProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, username, usernames }) => api(`/api/bid/profiles/${profileId}/share`, { method: 'POST', body: JSON.stringify(Array.isArray(usernames) ? { usernames } : { username }) }).then((data) => data.shares || data.share),
    onSuccess: () => invalidateShares(queryClient),
  });
}

export function useRespondToProfileShare() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ shareId, status }) => api(`/api/bid/profile-shares/${shareId}`, { method: 'PATCH', body: JSON.stringify({ status }) }).then((data) => data.share), onSuccess: () => invalidateShares(queryClient) });
}

function profilePayload(profileData) {
  const { headline, hourlyRate, summary, skills, ...payload } = profileData || {};
  return payload;
}

function invalidateBidAdmin(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['bid'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
}

function invalidateShares(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
  queryClient.invalidateQueries({ queryKey: ['bid', 'profile-shares'] });
}
