import { BID_TABS, DEFAULT_BID_FILTERS, DONE_STATUSES, INTERVIEW_STATUSES, REVIEW_STATUSES } from '../../components/bids/bidConstants.js';
import { hasTailoredResumeActivity } from '../../components/bids/bidJobState.js';
import { mergeKnownFilters, readPersistedFilters } from '../../lib/persistedFilters.js';

export const BID_FILTER_KEYS = [
  'search',
  'roleFamily',
  'source',
  'locationRegion',
  'appliedProfileId',
  'since',
  'dateFrom',
  'dateTo',
  'spam',
  'visibility',
  'origin',
  'sort',
  'page',
  'limit',
];
export const BID_FILTERS_STORAGE_KEY = 'applypilot.bids.filters.v2';
export const APPLICATION_TABS = new Set([BID_TABS.todo, BID_TABS.tailored, BID_TABS.done, BID_TABS.badWork]);
export const BID_DATE_PRESETS = new Set(['today', 'tomorrow', 'yesterday', 'this_week', 'last_week', 'until_yesterday', 'through_today', 'all', 'custom']);

export function profileJobKey(profileId, jobKey) {
  return `${profileId || 'no-profile'}:${jobKey}`;
}

export function bidJobCardKey(job) {
  return String(job?.groupId || job?.id || '');
}

export function bidJobActionId(job) {
  return job?.representativeJobId || job?.id;
}

export function tailoringByProfileJobs(tailoringByProfileJobId, profileId, jobs) {
  if (!profileId) return {};
  return jobs.reduce((tailoringByJobId, job) => {
    const cardKey = bidJobCardKey(job);
    const isTailoring = Boolean(tailoringByProfileJobId[profileJobKey(profileId, cardKey)]);
    tailoringByJobId[cardKey] = isTailoring;
    tailoringByJobId[job.id] = isTailoring;
    return tailoringByJobId;
  }, {});
}

export function appliedProfileOptionsForActiveProfile({ activeProfile, activeProfiles = [], appliedFilterProfiles = [], canUseCrossUserAppliedFilter = false }) {
  const sourceProfiles = canUseCrossUserAppliedFilter ? appliedFilterProfiles : activeProfiles;
  const activeProfileId = String(activeProfile?.id || '');
  const activeProfileBadge = activeProfile ? profileBadge(activeProfile) : '';

  return sourceProfiles
    .filter((profile) => (profile.profileStatus || 'active') === 'active')
    .filter((profile) => String(profile.id) !== activeProfileId)
    .filter((profile) => !activeProfileBadge || profileBadge(profile) === activeProfileBadge);
}

export function isAppliedProfileFilterValid(appliedProfileId, appliedProfiles = []) {
  if (!appliedProfileId || appliedProfileId === 'all') return true;
  return appliedProfiles.some((profile) => String(profile.id) === String(appliedProfileId));
}

export function bidTabFromParam(value) {
  return APPLICATION_TABS.has(value) ? value : BID_TABS.todo;
}

export function bidFiltersFromParams(params) {
  const persistedFilters = readPersistedFilters(BID_FILTERS_STORAGE_KEY, DEFAULT_BID_FILTERS, BID_FILTER_KEYS);
  const paramFilters = {};
  BID_FILTER_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value !== null) paramFilters[key] = value;
  });
  return normalizeBidDateFilter(
    mergeKnownFilters(persistedFilters, paramFilters, BID_FILTER_KEYS),
  );
}

export function goalDateLabelForFilters(filters) {
  if (filters.since === 'tomorrow') return 'tomorrow';
  if (filters.since === 'until_yesterday' || filters.since === 'yesterday') return 'yesterday';
  if (filters.since === 'this_week') return 'this week';
  if (filters.since === 'last_week') return 'last week';
  if (filters.since === 'custom') {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom !== filters.dateTo) return 'selected range';
    if (filters.dateFrom || filters.dateTo) return 'selected day';
  }
  return 'today';
}

export function withoutTomorrowDateFilter(filters) {
  if (filters.since !== 'tomorrow') return filters;
  return { ...filters, since: 'all', dateFrom: '', dateTo: '' };
}

export function bidGoalFilterParams(filters) {
  if (filters.since === 'all') {
    return {
      since: 'today',
      dateFrom: '',
      dateTo: '',
    };
  }

  return {
    since: filters.since || DEFAULT_BID_FILTERS.since,
    dateFrom: filters.dateFrom || '',
    dateTo: filters.dateTo || '',
  };
}

export function isCurrentDailyGoalFilter(filters) {
  return filters.since === 'all' || filters.since === 'today' || filters.since === 'through_today';
}

export function normalizeBidDateFilter(filters) {
  if (BID_DATE_PRESETS.has(filters.since)) return filters;
  return { ...filters, since: DEFAULT_BID_FILTERS.since, dateFrom: '', dateTo: '' };
}

export function bidParamsFromState({ activeProfileId, activeBidTab, filters }) {
  const params = new URLSearchParams();
  if (activeProfileId) params.set('profileId', String(activeProfileId));
  params.set('tab', activeBidTab);

  for (const key of BID_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value) !== '') {
      params.set(key, String(value));
    }
  }

  return params;
}

export function areBidFiltersEqual(left, right) {
  return BID_FILTER_KEYS.every(
    (key) => String(left[key]) === String(right[key]),
  );
}

export function isJobVisibleForTab(job, activeTab, draft) {
  const done = DONE_STATUSES.has(draft.status);
  const interviewing = INTERVIEW_STATUSES.has(draft.status);
  const reviewBlocked = REVIEW_STATUSES.has(draft.status);
  const hasTailoredRequest = hasTailoredResumeActivity(job);

  if (activeTab === BID_TABS.interviews) return interviewing;
  if (activeTab === BID_TABS.tailored) return hasTailoredRequest && !done && !reviewBlocked;
  if (activeTab === BID_TABS.done) return done;
  if (activeTab === BID_TABS.badWork) return reviewBlocked;
  return !done && !interviewing && !reviewBlocked;
}

function profileBadge(profile) {
  return profile.profileBadge || 'SWE';
}
