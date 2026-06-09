import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
export { api, authToken, authUrl, clearAuthToken, setAuthToken, useLogin, useLogout, useMe } from './authApi.js';
import { api, authUrl } from './authApi.js';

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

export function useFaqs() {
  return useQuery({
    queryKey: ['faqs'],
    queryFn: () => api('/api/faqs').then((data) => data.faqs),
  });
}

export function useFaq(faqId) {
  return useQuery({
    queryKey: ['faqs', faqId],
    queryFn: () => api(`/api/faqs/${faqId}`).then((data) => data.faq),
    enabled: Boolean(faqId),
  });
}

export function useCreateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (faqData) =>
      api('/api/faqs', {
        method: 'POST',
        body: JSON.stringify(faqData),
      }).then((data) => data.faq),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
    },
  });
}

export function useUpdateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ faqId, faqData }) =>
      api(`/api/faqs/${faqId}`, {
        method: 'PATCH',
        body: JSON.stringify(faqData),
      }).then((data) => data.faq),
    onSuccess: (faq) => {
      queryClient.invalidateQueries({ queryKey: ['faqs'] });
      queryClient.setQueryData(['faqs', faq.id], faq);
    },
  });
}

export function useBidProfiles(options = {}, queryOptions = {}) {
  const queryParams = new URLSearchParams(options).toString();
  return useQuery({
    queryKey: ['bid', 'profiles', options],
    queryFn: () => api(`/api/bid/profiles${queryParams ? `?${queryParams}` : ''}`).then((data) => data.profiles),
    staleTime: 60_000,
    ...queryOptions,
  });
}

export function useProfileShareRequests() {
  return useQuery({
    queryKey: ['bid', 'profile-shares'],
    queryFn: () => api('/api/bid/profile-shares'),
  });
}

export function useProfileShareRecipients() {
  return useQuery({
    queryKey: ['bid', 'profile-share-recipients'],
    queryFn: () => api('/api/bid/profile-share-recipients').then((data) => data.users),
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

export function useCallers() {
  return useQuery({
    queryKey: ['bid', 'callers'],
    queryFn: () => api('/api/bid/callers').then((data) => data.callers),
  });
}

export function useCreateCaller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callerData) =>
      api('/api/bid/callers', {
        method: 'POST',
        body: JSON.stringify(callerData),
      }).then((data) => data.caller),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useBidders() {
  return useQuery({
    queryKey: ['bid', 'bidders'],
    queryFn: () => api('/api/bid/bidders').then((data) => data.bidders),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
    },
  });
}

export function useMarkLinkedInEasyApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }) =>
      api(`/api/jobs/${jobId}/linkedin/easy-apply`, {
        method: 'PATCH',
      }).then((data) => data.job),
    onMutate: async ({ jobId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['jobs'] }),
        queryClient.cancelQueries({ queryKey: ['bid', 'jobs'] }),
      ]);
      const previousJobsQueries = queryClient.getQueriesData({ queryKey: ['jobs'] });
      const previousBidJobsQueries = queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] });

      updateCachedJobQueries(queryClient, ['jobs'], jobId, { applyMode: 'Easy Apply' });
      updateCachedJobQueries(queryClient, ['bid', 'jobs'], jobId, { applyMode: 'Easy Apply' });

      return { previousJobsQueries, previousBidJobsQueries };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousJobsQueries);
      restoreQueries(queryClient, context?.previousBidJobsQueries);
    },
    onSuccess: (updatedJob) => {
      updateCachedJobQueries(queryClient, ['jobs'], updatedJob.id, updatedJob);
      updateCachedJobQueries(queryClient, ['bid', 'jobs'], updatedJob.id, updatedJob);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
    },
  });
}

export function useUpdateLinkedInExternalUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, url }) =>
      api(`/api/jobs/${jobId}/linkedin/external-url`, {
        method: 'PATCH',
        body: JSON.stringify({ url }),
      }).then((data) => data.job),
    onMutate: async ({ jobId, url }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['jobs'] }),
        queryClient.cancelQueries({ queryKey: ['bid', 'jobs'] }),
      ]);
      const previousJobsQueries = queryClient.getQueriesData({ queryKey: ['jobs'] });
      const previousBidJobsQueries = queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] });
      const optimisticUpdates = { url, duplicateKey: url, applyMode: 'External Link' };

      updateCachedJobQueries(queryClient, ['jobs'], jobId, optimisticUpdates);
      updateCachedJobQueries(queryClient, ['bid', 'jobs'], jobId, optimisticUpdates);

      return { previousJobsQueries, previousBidJobsQueries };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousJobsQueries);
      restoreQueries(queryClient, context?.previousBidJobsQueries);
    },
    onSuccess: (updatedJob) => {
      updateCachedJobQueries(queryClient, ['jobs'], updatedJob.id, updatedJob);
      updateCachedJobQueries(queryClient, ['bid', 'jobs'], updatedJob.id, updatedJob);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
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

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }) =>
      api(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      }),
    onMutate: async ({ jobId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['jobs'] }),
        queryClient.cancelQueries({ queryKey: ['bid', 'jobs'] }),
      ]);
      const previousJobsQueries = queryClient.getQueriesData({ queryKey: ['jobs'] });
      const previousBidJobsQueries = queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] });

      removeCachedJobQueries(queryClient, ['jobs'], jobId);
      removeCachedJobQueries(queryClient, ['bid', 'jobs'], jobId);

      return { previousJobsQueries, previousBidJobsQueries };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousJobsQueries);
      restoreQueries(queryClient, context?.previousBidJobsQueries);
    },
    onSettled: () => {
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

function removeCachedJobQueries(queryClient, queryKeyPrefix, jobId) {
  queryClient.getQueriesData({ queryKey: queryKeyPrefix }).forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, removeCachedJob(data, queryFiltersFromKey(queryKey), jobId));
  });
}

function removeCachedJob(oldData, filters, jobId) {
  if (!oldData?.jobs) return oldData;

  let removed = 0;
  const jobs = oldData.jobs.filter((job) => {
    const keep = String(job.id) !== String(jobId);
    if (!keep) removed += 1;
    return keep;
  });

  return {
    ...oldData,
    jobs,
    total: typeof oldData.total === 'number' ? Math.max(oldData.total - removed, 0) : oldData.total,
    tabCounts: updateTabCount(oldData.tabCounts, filters.bidTab, -removed),
  };
}

function updateCachedJobVisibilityQueries(queryClient, queryKeyPrefix, jobId, updates) {
  queryClient.getQueriesData({ queryKey: queryKeyPrefix }).forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, updateCachedJobVisibility(data, queryFiltersFromKey(queryKey), jobId, updates));
  });
}

function updateCachedJobQueries(queryClient, queryKeyPrefix, jobId, updates) {
  queryClient.getQueriesData({ queryKey: queryKeyPrefix }).forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, updateCachedJob(data, jobId, updates));
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

function restoreQueries(queryClient, queryEntries = []) {
  queryEntries.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
}

function updateCachedBidQueries(queryClient, jobId, updates) {
  const queryEntries = queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] });
  const cachedJob = findCachedJob(queryEntries, jobId);
  const tabDelta = bidTabDelta(cachedJob, cachedJob ? optimisticBidJob(cachedJob, updates) : null);

  queryEntries.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, updateCachedBidJob(data, queryFiltersFromKey(queryKey), jobId, updates, cachedJob, tabDelta));
  });
}

function updateCachedTailoredResumeDownloadQueries(queryClient, resumeIds, downloadedAt = new Date().toISOString()) {
  const resumeIdSet = new Set(resumeIds.map((id) => String(id)).filter(Boolean));
  if (!resumeIdSet.size) return;

  queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] }).forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, updateCachedTailoredResumeDownloads(data, resumeIdSet, downloadedAt));
  });
}

function updateCachedTailoredResumeDownloads(oldData, resumeIdSet, downloadedAt) {
  if (!oldData?.jobs) return oldData;

  return {
    ...oldData,
    jobs: oldData.jobs.map((job) => {
      if (!resumeIdSet.has(String(job.tailoredResume?.id || ''))) return job;
      return {
        ...job,
        tailoredResume: {
          ...job.tailoredResume,
          downloadedAt,
        },
      };
    }),
  };
}

function updateCachedBidJob(oldData, filters, jobId, updates, cachedJob, tabDelta) {
  if (!oldData?.jobs || !jobId) return oldData;

  let countDelta = 0;
  let found = false;
  const jobs = oldData.jobs
    .map((job) => {
      if (String(job.id) !== String(jobId)) return job;
      found = true;

      const nextJob = optimisticBidJob(job, updates);
      if (!matchesBidJobFilters(nextJob, filters)) countDelta -= 1;
      return nextJob;
    })
    .filter((job) => matchesBidJobFilters(job, filters));

  if (!found && cachedJob) {
    const nextJob = optimisticBidJob(cachedJob, updates);
    if (matchesBidJobFilters(nextJob, filters)) {
      countDelta += 1;
      if (Number(filters.page || 1) === 1) jobs.unshift(nextJob);
    }
  }

  return {
    ...oldData,
    jobs: filters.bidTab === 'done' ? sortBidJobsByUpdatedAtDesc(jobs) : jobs,
    total: typeof oldData.total === 'number' ? Math.max(oldData.total + countDelta, 0) : oldData.total,
    tabCounts: updateBidTabCounts(oldData.tabCounts, tabDelta),
  };
}

function sortBidJobsByUpdatedAtDesc(jobs) {
  return [...jobs].sort((left, right) => {
    const leftTime = Date.parse(left.bid?.updatedAt || left.updatedAt || 0) || 0;
    const rightTime = Date.parse(right.bid?.updatedAt || right.updatedAt || 0) || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return Number(right.bid?.id || right.id || 0) - Number(left.bid?.id || left.id || 0);
  });
}

function bidTabDelta(previousJob, nextJob) {
  const delta = { todo: 0, tailored: 0, done: 0, interviews: 0 };
  if (!previousJob || !nextJob) return delta;

  const previousTabs = bidTabsForJob(previousJob);
  const nextTabs = bidTabsForJob(nextJob);
  previousTabs.forEach((tab) => {
    if (!nextTabs.has(tab)) delta[tab] -= 1;
  });
  nextTabs.forEach((tab) => {
    if (!previousTabs.has(tab)) delta[tab] += 1;
  });
  return delta;
}

function optimisticBidJob(job, updates) {
  return {
    ...job,
    ...(updates || {}),
    bid: updates?.bid ? { ...(job.bid || {}), ...updates.bid } : job.bid,
    tailoredResume: updates?.tailoredResume
      ? { ...(job.tailoredResume || {}), ...updates.tailoredResume }
      : job.tailoredResume,
  };
}

function bidTabForJob(job) {
  return [...bidTabsForJob(job)][0] || 'todo';
}

function bidTabsForJob(job) {
  const tabs = new Set();
  const status = job?.bid?.status || 'planned';
  if (status === 'interviewing') {
    tabs.add('interviews');
    return tabs;
  }
  if (['submitted', 'won', 'lost'].includes(status)) {
    tabs.add('done');
    return tabs;
  }
  tabs.add('todo');
  if (['requested', 'processing', 'ready', 'dead_letter'].includes(job?.tailoredResume?.status)) {
    tabs.add('tailored');
  }
  return tabs;
}

function matchesBidJobFilters(job, filters = {}) {
  if (filters.bidTab === 'interviews') {
    if (!['interviewing', 'won', 'lost'].includes(job?.bid?.status || '')) return false;
  } else if (!bidTabsForJob(job).has(filters.bidTab)) {
    return false;
  }
  if (!matchesVisibility(job, filters.visibility)) return false;
  if (!matchesSpam(job, filters.spam)) return false;
  if (!matchesRoleFamily(job, filters.roleFamily)) return false;
  if (!matchesSource(job, filters.source)) return false;
  if (!matchesOrigin(job, filters.origin)) return false;
  if (!matchesAppliedProfile(job, filters.appliedProfileId)) return false;
  return matchesSearch(job, filters.search);
}

function matchesSpam(job, spam = 'all') {
  if (spam === 'spam') return job.isSpam === true;
  if (spam === 'not_spam') return job.isSpam === false;
  if (spam === 'unreviewed') return job.isSpam === null;
  return true;
}

function matchesRoleFamily(job, roleFamily = 'all') {
  return !roleFamily || roleFamily === 'all' || job.category === roleFamily;
}

function matchesSource(job, source = 'all') {
  return !source || source === 'all' || job.source === source;
}

function matchesOrigin(job, origin = 'all') {
  if (origin === 'manual') return job.isManual === true;
  if (origin === 'scraped') return job.isManual !== true;
  return true;
}

function matchesAppliedProfile(job, appliedProfileId = 'all') {
  if (!appliedProfileId || appliedProfileId === 'all') return true;
  // Cross-profile application matches are resolved by the API; jobs only carry the active profile's bid.
  return true;
}

function matchesSearch(job, search = '') {
  const pattern = String(search || '').trim().toLowerCase();
  if (!pattern) return true;
  return [job.title, job.company, job.location, job.listingText]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(pattern));
}

function updateBidTabCounts(tabCounts, tabDelta) {
  if (!tabCounts) return tabCounts;
  return Object.fromEntries(
    Object.entries(tabCounts).map(([tab, count]) => [tab, Math.max(Number(count || 0) + Number(tabDelta[tab] || 0), 0)]),
  );
}

function optimisticBid({ id, jobId, bidData }) {
  const now = new Date().toISOString();
  return {
    id: id || `optimistic-${jobId}`,
    isInterview: Boolean(bidData?.isInterview),
    profileId: bidData?.profileId,
    jobId,
    status: bidData?.status || 'planned',
    bidAmount: bidData?.bidAmount || null,
    callerUserId: bidData?.callerUserId || null,
    coverLetter: bidData?.coverLetter || null,
    notes: bidData?.notes || null,
    interviewStage: bidData?.interviewStage || null,
    interviewNextAt: bidData?.interviewNextAt || null,
    interviewDurationMinutes: bidData?.interviewDurationMinutes || 60,
    firstInterviewScheduledAt: bidData?.firstInterviewScheduledAt || null,
    interviewNotes: bidData?.interviewNotes || null,
    stageNotes: bidData?.stageNotes || {},
    stageMeetingLinks: bidData?.stageMeetingLinks || {},
    meetingLink: bidData?.meetingLink || '',
    logs: bidData?.logs || [],
    bidAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function optimisticTailoredResume({ jobId, profileId }) {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${jobId}`,
    profileId,
    status: 'requested',
    filePath: null,
    readyAt: null,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    deadLetterAt: null,
    downloadedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function useMarkTailoredResumesDownloaded() {
  const queryClient = useQueryClient();

  return (resumeIds) => {
    updateCachedTailoredResumeDownloadQueries(queryClient, Array.isArray(resumeIds) ? resumeIds : [resumeIds]);
  };
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
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
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
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
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
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
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
    mutationFn: ({ profileId, username, usernames }) =>
      api(`/api/bid/profiles/${profileId}/share`, {
        method: 'POST',
        body: JSON.stringify(Array.isArray(usernames) ? { usernames } : { username }),
      }).then((data) => data.shares || data.share),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
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
    onMutate: async ({ jobId, bidData }) => {
      await queryClient.cancelQueries({ queryKey: ['bid', 'jobs'] });
      const previousBidJobsQueries = queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] });
      updateCachedBidQueries(queryClient, jobId, {
        bid: optimisticBid({ jobId, bidData }),
      });
      return { previousBidJobsQueries };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousBidJobsQueries);
    },
    onSuccess: (bid, { jobId }) => {
      updateCachedBidQueries(queryClient, jobId, { bid });
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'bidders'] });
    },
  });
}

export function useUpdateJobBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bidId, bidData }) =>
      api(`/api/bid/${bidData?.isInterview ? 'interviews' : 'applications'}/${bidId}`, {
        method: 'PATCH',
        body: JSON.stringify(bidData),
      }).then((data) => data.bid),
    onMutate: async ({ jobId, bidId, bidData }) => {
      await queryClient.cancelQueries({ queryKey: ['bid', 'jobs'] });
      const previousBidJobsQueries = queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] });
      updateCachedBidQueries(queryClient, jobId, {
        bid: optimisticBid({ id: bidId, jobId, bidData }),
      });
      return { previousBidJobsQueries };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousBidJobsQueries);
    },
    onSuccess: (bid, { jobId }) => {
      updateCachedBidQueries(queryClient, jobId, { bid });
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'bidders'] });
    },
  });
}

export function useCreateManualInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interviewData) =>
      api('/api/bid/interviews/manual', {
        method: 'POST',
        body: JSON.stringify(interviewData),
      }).then((data) => data.job),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid'] });
    },
  });
}

export function useDeleteInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interviewId) =>
      api(`/api/bid/interviews/${interviewId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'callers'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'bidders'] });
    },
  });
}

export function useMarketplace() {
  return useQuery({
    queryKey: ['marketplace'],
    queryFn: () => api('/api/marketplace'),
  });
}

export function useUpsertMarketplaceParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (participantData) =>
      api('/api/marketplace/participant', {
        method: 'POST',
        body: JSON.stringify(participantData),
      }).then((data) => data.participant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useReviewMarketplaceParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId, reviewData }) =>
      api(`/api/marketplace/participants/${participantId}/review`, {
        method: 'PATCH',
        body: JSON.stringify(reviewData),
      }).then((data) => data.participant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useCreateMarketplaceInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interviewData) =>
      api('/api/marketplace/interviews', {
        method: 'POST',
        body: JSON.stringify(interviewData),
      }).then((data) => data.interview),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useReviewMarketplaceInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ interviewId, reviewData }) =>
      api(`/api/marketplace/interviews/${interviewId}/review`, {
        method: 'PATCH',
        body: JSON.stringify(reviewData),
      }).then((data) => data.interview),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useCreateMarketplaceCaller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callerData) =>
      api('/api/marketplace/callers', {
        method: 'POST',
        body: JSON.stringify(callerData),
      }).then((data) => data.caller),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useReviewMarketplaceCaller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callerId, reviewData }) =>
      api(`/api/marketplace/callers/${callerId}/review`, {
        method: 'PATCH',
        body: JSON.stringify(reviewData),
      }).then((data) => data.caller),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useCreateMarketplaceMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (matchData) =>
      api('/api/marketplace/matches', {
        method: 'POST',
        body: JSON.stringify(matchData),
      }).then((data) => data.match),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useUpdateMarketplaceMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, matchData }) =>
      api(`/api/marketplace/matches/${matchId}`, {
        method: 'PATCH',
        body: JSON.stringify(matchData),
      }).then((data) => data.match),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useRequestTailoredResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, profileId, confirmSameCompany = false }) =>
      api(`/api/bid/jobs/${jobId}/tailored-resume`, {
        method: 'POST',
        body: JSON.stringify({ profileId, confirmSameCompany }),
      }).then((data) => data.tailoredResume),
    onMutate: async ({ jobId, profileId }) => {
      await queryClient.cancelQueries({ queryKey: ['bid', 'jobs'] });
      const previousBidJobsQueries = queryClient.getQueriesData({ queryKey: ['bid', 'jobs'] });
      updateCachedBidQueries(queryClient, jobId, {
        tailoredResume: optimisticTailoredResume({ jobId, profileId }),
      });
      return { previousBidJobsQueries };
    },
    onError: (_error, _variables, context) => {
      restoreQueries(queryClient, context?.previousBidJobsQueries);
    },
    onSuccess: (tailoredResume, { jobId }) => {
      updateCachedBidQueries(queryClient, jobId, { tailoredResume });
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
    },
  });
}

export function useTailoredResumeEvents(profileId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId) return undefined;

    const params = new URLSearchParams({ profileId: String(profileId) });
    const source = new EventSource(authUrl(`/api/bid/tailored-resume-events?${params}`));
    const refetchBidJobs = () => {
      queryClient.invalidateQueries({ queryKey: ['bid', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bid', 'profiles'] });
    };

    source.addEventListener('tailored-resume', refetchBidJobs);

    return () => {
      source.removeEventListener('tailored-resume', refetchBidJobs);
      source.close();
    };
  }, [profileId, queryClient]);
}
