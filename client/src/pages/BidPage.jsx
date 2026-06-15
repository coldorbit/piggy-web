import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import BidJobsPanel from '../components/bids/BidJobsPanel.jsx';
import BidProfileSummary from '../components/bids/BidProfileSummary.jsx';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import { BidWorkspaceProvider } from '../components/bids/BidWorkspaceContext.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { BID_TABS, DEFAULT_BID_FILTERS, DONE_STATUSES, EMPTY_BID, INTERVIEW_STATUSES, REVIEW_STATUSES } from '../components/bids/bidConstants.js';
import { hasTailoredResumeActivity } from '../components/bids/bidJobState.js';
import ProfileDialog from '../components/profiles/ProfileDialog.jsx';
import { EMPTY_PROFILE, PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import {
  useBidJobs,
  useBidProfiles,
  useCreateBidProfile,
  useCreateJobBid,
  useJobsMeta,
  useMarkJobHidden,
  useRequestTailoredResume,
  useStopTailoredResume,
  useTailoredResumeEvents,
  useUpdateLinkedInExternalUrl,
  useUpdateJobBid,
} from '../lib/api.js';
import { mergeKnownFilters, readPersistedFilters, writePersistedFilters } from '../lib/persistedFilters.js';
import { PRIVILEGED_USER_ROLES, isAdminRole } from '../lib/roles.js';
import { businessDayProgressPercent } from '../lib/timezone.js';

const BID_FILTER_KEYS = [
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
const BID_FILTERS_STORAGE_KEY = 'applypilot.bids.filters';
const APPLICATION_TABS = new Set([BID_TABS.todo, BID_TABS.tailored, BID_TABS.done, BID_TABS.badWork]);

export default function BidPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const canIncludeTodayScrapedJobs = isAdminRole(currentUser);
  const canViewBidGoals = PRIVILEGED_USER_ROLES.includes(currentUser?.role);
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [activeBidTab, setActiveBidTab] = useState(() => bidTabFromParam(searchParams.get('tab')));
  const [filters, setFilters] = useState(() => bidFiltersFromParams(searchParams, {
    activeBidTab,
    canIncludeTodayScrapedJobs,
  }));
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [tailoringByProfileJobId, setTailoringByProfileJobId] = useState({});
  const [sameCompanyConfirmation, setSameCompanyConfirmation] = useState(null);
  const { setSearch: setHeaderSearch } = useHeaderSearch();

  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useBidProfiles(
    isAdminRole(currentUser) ? { scope: 'manage' } : {},
  );
  const canUseCrossUserAppliedFilter = PRIVILEGED_USER_ROLES.includes(currentUser?.role);
  const { data: appliedFilterProfiles = [] } = useBidProfiles(
    canUseCrossUserAppliedFilter ? { scope: 'applied-filter' } : {},
    { enabled: canUseCrossUserAppliedFilter },
  );
  const activeProfiles = useMemo(
    () => profiles.filter((profile) => (profile.profileStatus || 'active') === 'active'),
    [profiles],
  );
  const activeProfile = useMemo(
    () => activeProfiles.find((profile) => String(profile.id) === String(activeProfileId)) || activeProfiles[0] || null,
    [activeProfiles, activeProfileId],
  );
  const appliedProfileOptions = useMemo(
    () =>
      (canUseCrossUserAppliedFilter ? appliedFilterProfiles : activeProfiles)
        .filter((profile) => (profile.profileStatus || 'active') === 'active')
        .filter((profile) => String(profile.id) !== String(activeProfile?.id || ''))
        .filter((profile) => !activeProfile || (profile.profileBadge || 'SWE') === (activeProfile.profileBadge || 'SWE')),
    [activeProfile, activeProfiles, appliedFilterProfiles, canUseCrossUserAppliedFilter],
  );
  const { data: metaData, isLoading: metaLoading, error: metaError, refetch: refetchMeta } = useJobsMeta();
  const {
    data: bidJobsData,
    isLoading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs,
  } = useBidJobs(
    activeProfile?.id,
    { ...filters, bidTab: activeBidTab },
  );
  const { mutate: createProfile, isPending: creatingProfile } = useCreateBidProfile();
  const { mutate: createBid, isPending: creatingBid } = useCreateJobBid();
  const { mutate: updateBid, isPending: updatingBid } = useUpdateJobBid();
  const { mutate: markHidden } = useMarkJobHidden();
  const { mutate: updateLinkedInExternalUrl, isPending: updatingLinkedInExternalUrl } = useUpdateLinkedInExternalUrl();
  const { mutate: requestTailoredResume } = useRequestTailoredResume();
  const { mutate: stopTailoredResume, isPending: stoppingTailoredResume } = useStopTailoredResume();
  useTailoredResumeEvents(activeProfile?.id);

  useEffect(() => {
    if (!activeProfiles[0]) return;
    const hasActiveProfile = activeProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!activeProfileId || !hasActiveProfile) setActiveProfileId(activeProfiles[0].id);
  }, [activeProfileId, activeProfiles]);

  useEffect(() => {
    const nextProfileId = searchParams.get('profileId') || '';
    const nextTab = bidTabFromParam(searchParams.get('tab'));
    const nextFilters = bidFiltersFromParams(searchParams, {
      activeBidTab: nextTab,
      canIncludeTodayScrapedJobs,
    });

    if (String(nextProfileId) !== String(activeProfileId)) setActiveProfileId(nextProfileId);
    if (nextTab !== activeBidTab) setActiveBidTab(nextTab);
    if (!areBidFiltersEqual(nextFilters, filters)) setFilters(nextFilters);
  }, [canIncludeTodayScrapedJobs, searchParams]);

  useEffect(() => {
    const nextParams = bidParamsFromState({ activeProfileId, activeBidTab, filters });
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeProfileId, activeBidTab, filters, searchParams, setSearchParams]);

  useEffect(() => {
    writePersistedFilters(BID_FILTERS_STORAGE_KEY, filters, BID_FILTER_KEYS);
  }, [filters]);

  function submitProfile(event) {
    event.preventDefault();
    setError('');
    createProfile(profileForm, {
      onSuccess: (profile) => {
        setProfileForm(EMPTY_PROFILE);
        setActiveProfileId(profile.id);
        setIsProfileDialogOpen(false);
      },
      onError: (profileError) => setError(profileError.message),
    });
  }

  function draftFor(job) {
    return drafts[profileJobKey(activeProfile?.id, job.id)] || { ...EMPTY_BID, ...(job.bid || {}) };
  }

  function updateDraft(jobId, key, value) {
    if (!activeProfile) return;
    const scopedJobId = profileJobKey(activeProfile.id, jobId);
    setDrafts((current) => ({
      ...current,
      [scopedJobId]: {
        ...(current[scopedJobId] || EMPTY_BID),
        [key]: value,
      },
    }));
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  }

  useEffect(() => {
    setHeaderSearch({
      isVisible: true,
      placeholder: 'Search applications',
      value: filters.search || '',
      onChange: (value) => updateFilter('search', value),
    });
  }, [filters.search, setHeaderSearch]);

  useEffect(() => {
    return () => setHeaderSearch(EMPTY_HEADER_SEARCH);
  }, [setHeaderSearch]);

  function updateBidTab(value) {
    setActiveBidTab(value);
    setFilters((current) => normalizeBidDateFilter(
      { ...current, page: 1 },
      { activeBidTab: value, canIncludeTodayScrapedJobs },
    ));
  }

  function saveBid(job, bidDataOverride) {
    if (!activeProfile) return;
    const bidData = { ...draftFor(job), ...(bidDataOverride || {}), profileId: activeProfile.id };
    const mutation = job.bid ? updateBid : createBid;
    const jobId = bidJobActionId(job);
    const payload = job.bid ? { bidId: job.bid.id, jobId, bidData } : { jobId, bidData };

    setError('');
    mutation(payload, {
      onError: (bidError) => setError(bidError.message),
    });
  }

  function tailorResume(job, options = {}) {
    if (!activeProfile) return;
    const jobId = bidJobActionId(job);
    const scopedJobId = profileJobKey(activeProfile.id, bidJobCardKey(job));
    if (tailoringByProfileJobId[scopedJobId]) return;

    setTailoringByProfileJobId((current) => ({ ...current, [scopedJobId]: true }));
    setError('');
    requestTailoredResume(
      { jobId, profileId: activeProfile.id, confirmSameCompany: options.confirmSameCompany === true },
      {
        onError: (tailoredResumeError) => {
          if (tailoredResumeError.data?.code === 'same_company_tailoring_conflict') {
            setSameCompanyConfirmation({
              job,
              warning: tailoredResumeError.data.sameCompanyTailoring,
              message: tailoredResumeError.message,
            });
            return;
          }
          setError(tailoredResumeError.message);
        },
        onSettled: () => {
          setTailoringByProfileJobId((current) => {
            const next = { ...current };
            delete next[scopedJobId];
            return next;
          });
        },
      },
    );
  }

  function closeSameCompanyConfirmation() {
    setSameCompanyConfirmation(null);
  }

  function confirmSameCompanyTailoring() {
    const job = sameCompanyConfirmation?.job;
    setSameCompanyConfirmation(null);
    if (job) tailorResume(job, { confirmSameCompany: true });
  }

  function updateHiddenState(job, isHidden) {
    setError('');
    markHidden(
      { jobId: bidJobActionId(job), isHidden },
      {
        onError: (hiddenError) => setError(hiddenError.message),
      },
    );
  }

  function updateExternalJobLink(job, url, options = {}) {
    setError('');
    updateLinkedInExternalUrl(
      { jobId: bidJobActionId(job), url },
      {
        onSuccess: options.onSuccess,
        onError: (jobError) => {
          setError(jobError.message);
          options.onError?.(jobError);
        },
      },
    );
  }

  function stopTailoring(job) {
    if (!job.tailoredResume?.id) return;
    setError('');
    stopTailoredResume(
      { jobId: bidJobActionId(job), tailoredResumeId: job.tailoredResume.id },
      {
        onError: (tailoredResumeError) => setError(tailoredResumeError.message),
      },
    );
  }

  const activeColor = PROFILE_COLORS[activeProfile?.colorScheme || 'green'];
  const jobs = bidJobsData?.jobs || [];
  const visibleJobs = jobs.filter((job) => isJobVisibleForTab(job, activeBidTab, draftFor(job)));
  const total = bidJobsData?.total || 0;
  const currentBidUser = useMemo(
    () => ({ ...(currentUser || {}), ...(bidJobsData?.currentUser || {}) }),
    [bidJobsData?.currentUser, currentUser],
  );
  const pageError = error || profilesError?.message || jobsError?.message || metaError?.message || '';
  const loading = profilesLoading || jobsLoading || metaLoading;
  const bidWorkspace = useMemo(
    () => ({
      activeColor,
      activeProfileId: activeProfile?.id || '',
      activeTab: activeBidTab,
      currentUser: currentBidUser,
      draftsForJob: draftFor,
      isSaving: creatingBid || updatingBid,
      isStoppingTailoring: stoppingTailoredResume,
      isUpdatingLinkedInJob: updatingLinkedInExternalUrl,
      jobs: visibleJobs,
      loading,
      page: filters.page,
      pageSize: filters.limit,
      pages: Math.max(Math.ceil(total / filters.limit), 1),
      tabCounts: bidJobsData?.tabCounts || { todo: 0, tailored: 0, done: 0, badWork: 0, interviews: 0 },
      tailoringByJobId: tailoringByProfileJobs(tailoringByProfileJobId, activeProfile?.id, visibleJobs),
      total,
      onDraftChange: updateDraft,
      onHiddenChange: updateHiddenState,
      onLinkedInExternalUrlChange: updateExternalJobLink,
      onPageChange: (page) => updateFilter('page', page),
      onPageSizeChange: (limit) => updateFilter('limit', limit),
      onStatusChange: saveBid,
      onStopTailoring: stopTailoring,
      onTabChange: updateBidTab,
      onTailorResume: tailorResume,
    }),
    [
      activeBidTab,
      activeColor,
      activeProfile?.id,
      bidJobsData?.currentUser,
      bidJobsData?.tabCounts,
      creatingBid,
      currentUser,
      currentBidUser,
      drafts,
      filters.limit,
      filters.page,
      loading,
      tailoringByProfileJobId,
      total,
      stoppingTailoredResume,
      updatingBid,
      updatingLinkedInExternalUrl,
      visibleJobs,
    ],
  );

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {!activeProfiles.length && !profilesLoading ? (
        <EmptyState
          title="No active profiles available"
          detail="Activate or create a profile before starting bid work."
        />
      ) : null}

      {profilesLoading || activeProfiles.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)', xl: '240px minmax(0, 1fr)' },
            gap: 1.5,
            alignItems: 'stretch',
            height: { xs: 'auto', md: 'calc(100vh - 108px)', xl: 'calc(100vh - 124px)' },
            minHeight: { md: 0 },
            minWidth: 0,
          }}
        >
          <BidProfileTabs
            activeColor={activeColor}
            activeProfile={activeProfile}
            isLoading={profilesLoading}
            profiles={activeProfiles}
            showDailyGoal={canViewBidGoals}
            onProfileChange={setActiveProfileId}
          />

          {activeProfile ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0,
                minWidth: 0,
              }}
            >
              <BidProfileSummary
                filters={filters}
                isOpen={isFilterPanelOpen}
                meta={{
                  ...(metaData || { sources: [] }),
                  appliedProfiles: appliedProfileOptions,
                  bidDateStrategy: true,
                  canIncludeTodayScrapedJobs: canIncludeTodayDateFilter({
                    activeBidTab,
                    canIncludeTodayScrapedJobs,
                  }),
                  showAppliedProfileFilter: activeBidTab === BID_TABS.todo && canUseCrossUserAppliedFilter,
                }}
                onClose={() => setIsFilterPanelOpen(false)}
                onFilterChange={updateFilter}
                onOpen={() => setIsFilterPanelOpen(true)}
                onRefresh={() => {
                  refetchMeta();
                  refetchJobs();
                }}
              />
              {canViewBidGoals ? <BidDailyGoalBar activeColor={activeColor} profile={activeProfile} /> : null}
              <BidWorkspaceProvider value={bidWorkspace}>
                <BidJobsPanel key={activeProfile.id} />
              </BidWorkspaceProvider>
            </Box>
          ) : null}
        </Box>
      ) : null}

      <ProfileDialog
        canEditDailyBidGoal={isAdminRole(currentUser)}
        form={profileForm}
        isOpen={isProfileDialogOpen}
        isSaving={creatingProfile}
        onChange={setProfileForm}
        onClose={() => setIsProfileDialogOpen(false)}
        onSubmit={submitProfile}
      />
      <Dialog open={Boolean(sameCompanyConfirmation)} onClose={closeSameCompanyConfirmation} fullWidth maxWidth="sm">
        <DialogTitle>Different role at same company</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1, pt: 1 }}>
          <Typography variant="body2">
            {sameCompanyConfirmation?.message || 'A recent tailoring request already exists for this company.'}
          </Typography>
          {sameCompanyConfirmation?.warning ? (
            <Typography color="text.secondary" variant="body2">
              Proceeding will mark the previous tailored request for {sameCompanyConfirmation.warning.priorTitle} as invalid.
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSameCompanyConfirmation}>Cancel</Button>
          <Button onClick={confirmSameCompanyTailoring} variant="contained">Proceed intentionally</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function profileJobKey(profileId, jobKey) {
  return `${profileId || 'no-profile'}:${jobKey}`;
}

function bidJobCardKey(job) {
  return String(job?.groupId || job?.id || '');
}

function bidJobActionId(job) {
  return job?.representativeJobId || job?.id;
}

function tailoringByProfileJobs(tailoringByProfileJobId, profileId, jobs) {
  if (!profileId) return {};
  return jobs.reduce((tailoringByJobId, job) => {
    const cardKey = bidJobCardKey(job);
    const isTailoring = Boolean(tailoringByProfileJobId[profileJobKey(profileId, cardKey)]);
    tailoringByJobId[cardKey] = isTailoring;
    tailoringByJobId[job.id] = isTailoring;
    return tailoringByJobId;
  }, {});
}

function BidDailyGoalBar({ activeColor, profile }) {
  const totalGoal = Number(profile?.progress?.dailyGoal || 0);
  const totalFinished = Number(profile?.progress?.dailyFinished || 0);
  const users = dailyApplicationRows(profile);
  if (!totalGoal && !totalFinished) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1,
        px: 1.25,
        py: 1,
        display: 'grid',
        gap: 0.75,
        bgcolor: '#f8fafc',
        borderColor: totalFinished >= totalGoal ? '#bbf7d0' : activeColor.soft,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography variant="body2" fontWeight={900}>
          {profile?.name ? `${profile.name} daily bid goal` : 'Profile daily bid goal'}
        </Typography>
        <Typography variant="body2" fontWeight={900} color="text.secondary">
          {totalGoal ? `${totalFinished.toLocaleString()} / ${totalGoal.toLocaleString()} applications today` : `${totalFinished.toLocaleString()} applications today`}
        </Typography>
      </Box>
      {totalGoal ? <DailyGoalRow activeColor={activeColor} goal={{ goal: totalGoal, finished: totalFinished, username: 'Profile' }} /> : null}
      {users.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          {users.map((user) => (
            <Typography key={user.userId || user.username} variant="caption" color="text.secondary" fontWeight={800}>
              {[user.username || 'User', roleLabel(user.role)].filter(Boolean).join(' - ')}: {user.finished.toLocaleString()}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Paper>
  );
}

function DailyGoalRow({ activeColor, goal }) {
  const percent = Math.min((goal.finished / goal.goal) * 100, 100);
  const dayPercent = businessDayProgressPercent();
  const isComplete = goal.finished >= goal.goal;
  const isOnTrack = isComplete || percent + 2 >= dayPercent;
  const statusLabel = isComplete ? 'Complete' : isOnTrack ? 'On track' : 'Behind pace';
  const statusColor = isComplete ? '#15803d' : isOnTrack ? activeColor.dark : '#b45309';
  const remaining = Math.max(goal.goal - goal.finished, 0);

  return (
    <Box sx={{ display: 'grid', gap: 0.45 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography variant="caption" fontWeight={900}>
          {[goal.username || 'User', roleLabel(goal.role)].filter(Boolean).join(' - ')}
        </Typography>
        <Typography variant="caption" fontWeight={900} sx={{ color: statusColor }}>
          {goal.finished.toLocaleString()} / {goal.goal.toLocaleString()}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{
          height: 7,
          borderRadius: 1,
          bgcolor: '#e5e7eb',
          '& .MuiLinearProgress-bar': {
            borderRadius: 1,
            bgcolor: statusColor,
          },
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800}>
          {statusLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={800}>
          {remaining ? `${remaining.toLocaleString()} remaining` : 'Goal reached'}
        </Typography>
      </Box>
    </Box>
  );
}

function dailyApplicationRows(profile) {
  const users = Array.isArray(profile?.progress?.dailyUsers) ? profile.progress.dailyUsers : [];
  return users
    .map((user) => ({
      userId: user.userId,
      username: user.username,
      role: user.role,
      finished: Number(user.finished || 0),
    }))
    .filter((user) => user.finished > 0);
}

function roleLabel(role) {
  if (role === 'readonly_bidder' || role === 'editable_bidder' || role === 'bidder') return 'bidder';
  if (role === 'user') return 'user';
  return '';
}

function bidTabFromParam(value) {
  return APPLICATION_TABS.has(value) ? value : BID_TABS.todo;
}

function bidFiltersFromParams(params, { activeBidTab = BID_TABS.todo, canIncludeTodayScrapedJobs = false } = {}) {
  const persistedFilters = readPersistedFilters(BID_FILTERS_STORAGE_KEY, DEFAULT_BID_FILTERS, BID_FILTER_KEYS);
  const paramFilters = {};
  BID_FILTER_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value !== null) paramFilters[key] = value;
  });
  return normalizeBidDateFilter(
    mergeKnownFilters(persistedFilters, paramFilters, BID_FILTER_KEYS),
    { activeBidTab, canIncludeTodayScrapedJobs },
  );
}

function normalizeBidDateFilter(filters, { activeBidTab = BID_TABS.todo, canIncludeTodayScrapedJobs = false } = {}) {
  if (canIncludeTodayDateFilter({ activeBidTab, canIncludeTodayScrapedJobs })) {
    if (!['until_yesterday', 'through_today', 'this_week', 'all'].includes(filters.since)) return filters;
    return { ...filters, since: 'today', dateFrom: '', dateTo: '' };
  }
  if (!['today', 'through_today', 'this_week', 'all'].includes(filters.since)) return filters;
  return { ...filters, since: 'until_yesterday', dateFrom: '', dateTo: '' };
}

function canIncludeTodayDateFilter({ activeBidTab, canIncludeTodayScrapedJobs = false }) {
  return canIncludeTodayScrapedJobs || activeBidTab === BID_TABS.done || activeBidTab === BID_TABS.badWork;
}

function bidParamsFromState({ activeProfileId, activeBidTab, filters }) {
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

function areBidFiltersEqual(left, right) {
  return BID_FILTER_KEYS.every(
    (key) => String(left[key]) === String(right[key]),
  );
}

function isJobVisibleForTab(job, activeTab, draft) {
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
