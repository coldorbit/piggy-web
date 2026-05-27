import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import axios from 'axios';

const AUTH_TOKEN_KEY = 'scraper_auth_token';
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function api(path, options = {}) {
  try {
    const token = authToken();
    const response = await axios({
      url: apiUrl(path),
      method: options.method || 'GET',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      data: options.body,
    });
    return response.data || {};
  } catch (error) {
    if (error.response?.status === 401) clearAuthToken();
    throw new Error(error.response?.data?.error || error.message);
  }
}

export function authToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setAuthToken(token) {
  if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  else clearAuthToken();
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function authUrl(path) {
  const token = authToken();
  const url = apiUrl(path);
  if (!token) return url;
  const separator = path.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

// Query hooks
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api('/api/me').then((data) => data.user),
    retry: false,
  });
}

export function useJobs(filters) {
  const queryParams = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => api(`/api/jobs?${queryParams}`),
  });
}

export function useJobsMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => api('/api/meta'),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api('/api/admin/users').then((data) => data.users),
  });
}

export function useBidProfiles(options = {}) {
  const queryParams = new URLSearchParams(options).toString();
  return useQuery({
    queryKey: ['bid', 'profiles', options],
    queryFn: () => api(`/api/bid/profiles${queryParams ? `?${queryParams}` : ''}`).then((data) => data.profiles),
    staleTime: 60_000,
  });
}

export function useProfileShareRequests() {
  return useQuery({
    queryKey: ['bid', 'profile-shares'],
    queryFn: () => api('/api/bid/profile-shares'),
  });
}

export function useBidJobs(profileId, filters = {}) {
  const params = new URLSearchParams({ ...filters, profileId: String(profileId || ''), limit: String(filters.limit || 10) });
  return useQuery({
    queryKey: ['bid', 'jobs', profileId, filters],
    queryFn: () => api(`/api/bid/jobs?${params}`),
    enabled: Boolean(profileId),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

// Mutation hooks
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials) =>
      api('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.setQueryData(['me'], data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/logout', { method: 'POST' }),
    onSettled: async () => {
      await queryClient.cancelQueries();
      clearAuthToken();
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
    },
  });
}

export function useMarkJobSpam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, isSpam }) =>
      api(`/api/jobs/${jobId}/spam`, {
        method: 'PATCH',
        body: JSON.stringify({ isSpam }),
      }).then((data) => data.job),
    onMutate: async ({ jobId, isSpam }) => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      const previousJobsQueries = queryClient.getQueriesData({ queryKey: ['jobs'] });

      queryClient.setQueriesData({ queryKey: ['jobs'] }, (oldData) => updateCachedJob(oldData, jobId, { isSpam }));

      return { previousJobsQueries };
    },
    onError: (_error, _variables, context) => {
      context?.previousJobsQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: (updatedJob) => {
      queryClient.setQueriesData({ queryKey: ['jobs'] }, (oldData) => updateCachedJob(oldData, updatedJob.id, updatedJob));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useMarkJobHidden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, isHidden }) =>
      api(`/api/jobs/${jobId}/hidden`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden }),
      }).then((data) => data.job),
    onMutate: async ({ jobId, isHidden }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['jobs'] }),
        queryClient.cancelQueries({ queryKey: ['bid', 'jobs'] }),
      ]);
      const previousJobsQueries = queryClient.getQueriesData({ queryKey: ['jobs'] });
      const previousBidJobsQueries = queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] });
      const cachedJob = findCachedJob([...previousJobsQueries, ...previousBidJobsQueries], jobId);
      const optimisticUpdates = {
        ...(cachedJob || {}),
        isHidden,
        hiddenAt: isHidden ? new Date().toISOString() : null,
      };

      updateCachedJobVisibilityQueries(queryClient, ['jobs'], jobId, optimisticUpdates);
      updateCachedJobVisibilityQueries(queryClient, ['bid', 'jobs'], jobId, optimisticUpdates);

      return { previousJobsQueries, previousBidJobsQueries };
    },
    onError: (_error, _variables, context) => {
      context?.previousJobsQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousBidJobsQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: (updatedJob) => {
      updateCachedJobVisibilityQueries(queryClient, ['jobs'], updatedJob.id, updatedJob);
      updateCachedJobVisibilityQueries(queryClient, ['bid', 'jobs'], updatedJob.id, updatedJob);
    },
  });
}

export function useImportJobsCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ csvText }) =>
      api('/api/jobs/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
    },
  });
}

function updateCachedJob(oldData, jobId, updates) {
  if (!oldData?.jobs) return oldData;
  return {
    ...oldData,
    jobs: oldData.jobs.map((job) => (String(job.id) === String(jobId) ? { ...job, ...updates } : job)),
  };
}

function updateCachedJobVisibilityQueries(queryClient, queryKeyPrefix, jobId, updates) {
  queryClient.getQueriesData({ queryKey: queryKeyPrefix }).forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, updateCachedJobVisibility(data, queryFiltersFromKey(queryKey), jobId, updates));
  });
}

function updateCachedJobVisibility(oldData, filters, jobId, updates) {
  if (!oldData?.jobs) return oldData;

  let removed = 0;
  let added = 0;
  let found = false;
  const jobs = oldData.jobs
    .map((job) => {
      if (String(job.id) !== String(jobId)) return job;
      found = true;
      return { ...job, ...updates };
    })
    .filter((job) => {
      if (String(job.id) !== String(jobId)) return true;
      const keep = matchesVisibility(job, filters.visibility);
      if (!keep) removed += 1;
      return keep;
    });

  if (!found && updates?.id && matchesVisibility(updates, filters.visibility)) {
    jobs.unshift(updates);
    added = 1;
  }

  return {
    ...oldData,
    jobs,
    total: typeof oldData.total === 'number' ? Math.max(oldData.total - removed + added, 0) : oldData.total,
    tabCounts: updateTabCount(oldData.tabCounts, filters.bidTab, added - removed),
  };
}

function findCachedJob(queryEntries, jobId) {
  for (const [, data] of queryEntries) {
    const job = data?.jobs?.find((row) => String(row.id) === String(jobId));
    if (job) return job;
  }
  return null;
}

function updateTabCount(tabCounts, activeTab, delta) {
  if (!tabCounts || !activeTab || !delta) return tabCounts;
  return {
    ...tabCounts,
    [activeTab]: Math.max(Number(tabCounts[activeTab] || 0) + delta, 0),
  };
}

function queryFiltersFromKey(queryKey) {
  if (queryKey[0] === 'jobs') return queryKey[1] || {};
  if (queryKey[0] === 'bid' && queryKey[1] === 'jobs') return queryKey[3] || {};
  return {};
}

function matchesVisibility(job, visibility = 'visible') {
  if (visibility === 'hidden') return job.isHidden === true;
  if (visibility === 'all') return true;
  return job.isHidden !== true;
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userData) =>
      api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      }).then((data) => data.user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, userData }) =>
      api(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(userData),
      }).then((data) => data.user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) =>
      api(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useCreateBidProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileData) =>
      api('/api/bid/profiles', {
        method: 'POST',
        body: JSON.stringify(profilePayload(profileData)),
      }).then((data) => data.profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
    },
  });
}

export function useUpdateBidProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, profileData }) =>
      api(`/api/bid/profiles/${profileId}`, {
        method: 'PATCH',
        body: JSON.stringify(profilePayload(profileData)),
      }).then((data) => data.profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
    },
  });
}

export function useUpdateBidProfileStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, status, reason }) =>
      api(`/api/bid/profiles/${profileId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }).then((data) => data.profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid'] });
    },
  });
}

function profilePayload(profileData) {
  const { headline, hourlyRate, summary, skills, ...payload } = profileData || {};
  return payload;
}

export function useDeleteBidProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId) => api(`/api/bid/profiles/${profileId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid'] });
    },
  });
}

export function useShareBidProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, username }) =>
      api(`/api/bid/profiles/${profileId}/share`, {
        method: 'POST',
        body: JSON.stringify({ username }),
      }).then((data) => data.share),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'profile-shares'] });
    },
  });
}

export function useRespondToProfileShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId, status }) =>
      api(`/api/bid/profile-shares/${shareId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }).then((data) => data.share),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'profile-shares'] });
    },
  });
}

export function useCreateJobBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, bidData }) =>
      api(`/api/bid/jobs/${jobId}`, {
        method: 'POST',
        body: JSON.stringify(bidData),
      }).then((data) => data.bid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
    },
  });
}

export function useUpdateJobBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bidId, bidData }) =>
      api(`/api/bid/applications/${bidId}`, {
        method: 'PATCH',
        body: JSON.stringify(bidData),
      }).then((data) => data.bid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
    },
  });
}

export function useRequestTailoredResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, profileId }) =>
      api(`/api/bid/jobs/${jobId}/tailored-resume`, {
        method: 'POST',
        body: JSON.stringify({ profileId }),
      }).then((data) => data.tailoredResume),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
    },
  });
}

export function useTailoredResumeEvents(profileId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId) return undefined;

    const params = new URLSearchParams({ profileId: String(profileId) });
    const source = new EventSource(authUrl(`/api/bid/tailored-resume-events?${params}`));
    const refetchBidJobs = () => queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });

    source.addEventListener('tailored-resume', refetchBidJobs);

    return () => {
      source.removeEventListener('tailored-resume', refetchBidJobs);
      source.close();
    };
  }, [profileId, queryClient]);
}
