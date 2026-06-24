import { useEffect, useMemo, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import BidDailyGoalBar from '../components/bids/BidDailyGoalBar.jsx';
import BidJobsPanel from '../components/bids/BidJobsPanel.jsx';
import BidProfileSummary from '../components/bids/BidProfileSummary.jsx';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import { BidWorkspaceProvider } from '../components/bids/BidWorkspaceContext.jsx';
import SameCompanyTailoringDialog from '../components/bids/SameCompanyTailoringDialog.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { BID_TABS, EMPTY_BID } from '../components/bids/bidConstants.js';
import ProfileDialog from '../components/profiles/ProfileDialog.jsx';
import { EMPTY_PROFILE, PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import {
  useBidJobs,
  useBidProfiles,
  useBulkRequestTailoredResumes,
  useBulkUpdateJobBids,
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
import { writePersistedFilters } from '../lib/persistedFilters.js';
import { PRIVILEGED_USER_ROLES, isAdminRole } from '../lib/roles.js';
import {
  BID_FILTER_KEYS,
  BID_FILTERS_STORAGE_KEY,
  areBidFiltersEqual,
  appliedProfileOptionsForActiveProfile,
  bidFiltersFromParams,
  bidGoalFilterParams,
  bidJobActionId,
  bidJobCardKey,
  bidParamsFromState,
  bidTabFromParam,
  goalDateLabelForFilters,
  isAppliedProfileFilterValid,
  isCurrentDailyGoalFilter,
  isJobVisibleForTab,
  normalizeBidDateFilter,
  profileJobKey,
  tailoringByProfileJobs,
  withoutTomorrowDateFilter,
} from './bidPage/bidPageUtils.js';

export default function BidPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewBidGoals = PRIVILEGED_USER_ROLES.includes(currentUser?.role);
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [activeBidTab, setActiveBidTab] = useState(() => bidTabFromParam(searchParams.get('tab')));
  const [filters, setFilters] = useState(() => bidFiltersFromParams(searchParams));
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [tailoringByProfileJobId, setTailoringByProfileJobId] = useState({});
  const [sameCompanyConfirmation, setSameCompanyConfirmation] = useState(null);
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const canUseTomorrowDateFilter = isAdminRole(currentUser);
  const dateFiltersForRole = useMemo(
    () => (canUseTomorrowDateFilter ? filters : withoutTomorrowDateFilter(filters)),
    [canUseTomorrowDateFilter, filters],
  );
  const profileGoalFilters = useMemo(() => bidGoalFilterParams(dateFiltersForRole), [dateFiltersForRole]);

  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useBidProfiles(
    { ...(canUseTomorrowDateFilter ? { scope: 'manage' } : {}), ...profileGoalFilters },
  );
  const canUseCrossUserAppliedFilter = PRIVILEGED_USER_ROLES.includes(currentUser?.role);
  const { data: appliedFilterProfiles = [], isLoading: appliedFilterProfilesLoading } = useBidProfiles(
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
    () => appliedProfileOptionsForActiveProfile({
      activeProfile,
      activeProfiles,
      appliedFilterProfiles,
      canUseCrossUserAppliedFilter,
    }),
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
  const { mutate: bulkUpdateBids, isPending: bulkUpdatingBids } = useBulkUpdateJobBids();
  const { mutate: markHidden } = useMarkJobHidden();
  const { mutate: updateLinkedInExternalUrl, isPending: updatingLinkedInExternalUrl } = useUpdateLinkedInExternalUrl();
  const { mutate: requestTailoredResume } = useRequestTailoredResume();
  const { mutate: bulkRequestTailoredResumes, isPending: bulkRequestingTailoredResumes } = useBulkRequestTailoredResumes();
  const { mutate: stopTailoredResume, isPending: stoppingTailoredResume } = useStopTailoredResume();
  useTailoredResumeEvents(activeProfile?.id);
  const dateFilteredProfile = bidJobsData?.profile;
  const profilesForDisplay = useMemo(
    () =>
      activeProfiles.map((profile) =>
        String(profile.id) === String(dateFilteredProfile?.id)
          ? { ...profile, ...dateFilteredProfile, progress: dateFilteredProfile.progress || profile.progress }
          : profile,
      ),
    [activeProfiles, dateFilteredProfile],
  );
  const activeProfileForDisplay = useMemo(
    () => profilesForDisplay.find((profile) => String(profile.id) === String(activeProfile?.id || '')) || activeProfile,
    [activeProfile, profilesForDisplay],
  );
  const dailyGoalLabel = goalDateLabelForFilters(dateFiltersForRole);
  const isDailyGoalCurrent = isCurrentDailyGoalFilter(dateFiltersForRole);

  useEffect(() => {
    if (!activeProfiles[0]) return;
    const hasActiveProfile = activeProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!activeProfileId || !hasActiveProfile) setActiveProfileId(activeProfiles[0].id);
  }, [activeProfileId, activeProfiles]);

  useEffect(() => {
    const nextProfileId = searchParams.get('profileId') || '';
    const nextTab = bidTabFromParam(searchParams.get('tab'));
    const nextFilters = bidFiltersFromParams(searchParams);

    if (String(nextProfileId) !== String(activeProfileId)) setActiveProfileId(nextProfileId);
    if (nextTab !== activeBidTab) setActiveBidTab(nextTab);
    if (!areBidFiltersEqual(nextFilters, filters)) setFilters(nextFilters);
  }, [searchParams]);

  useEffect(() => {
    const nextParams = bidParamsFromState({ activeProfileId, activeBidTab, filters });
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeProfileId, activeBidTab, filters, searchParams, setSearchParams]);

  useEffect(() => {
    writePersistedFilters(BID_FILTERS_STORAGE_KEY, filters, BID_FILTER_KEYS);
  }, [filters]);

  useEffect(() => {
    if (!canUseCrossUserAppliedFilter || activeBidTab !== BID_TABS.todo) return;
    if (filters.appliedProfileId === 'all') return;
    if (appliedFilterProfilesLoading) return;
    if (isAppliedProfileFilterValid(filters.appliedProfileId, appliedProfileOptions)) return;
    setFilters((current) => ({ ...current, appliedProfileId: 'all', page: 1 }));
  }, [
    activeBidTab,
    appliedFilterProfilesLoading,
    appliedProfileOptions,
    canUseCrossUserAppliedFilter,
    filters.appliedProfileId,
  ]);

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
      { jobId, jobKey: bidJobCardKey(job), profileId: activeProfile.id, confirmSameCompany: options.confirmSameCompany === true },
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

  function batchUpdateStatus(items, status) {
    if (!activeProfile || !items?.length) return;
    setError('');
    bulkUpdateBids(
      {
        items,
        profileId: activeProfile.id,
        updates: { status },
      },
      {
        onError: (batchError) => setError(batchError.message),
        onSuccess: (result) => setBatchResultError(result, 'application'),
      },
    );
  }

  function batchAssignCaller(items, callerUserId) {
    if (!activeProfile || !items?.length) return;
    setError('');
    bulkUpdateBids(
      {
        items,
        profileId: activeProfile.id,
        updates: { callerUserId },
      },
      {
        onError: (batchError) => setError(batchError.message),
        onSuccess: (result) => setBatchResultError(result, 'caller assignment'),
      },
    );
  }

  function batchTailorResumes(selectedJobs) {
    if (!activeProfile || !selectedJobs?.length) return;
    const jobIds = selectedJobs.map((job) => bidJobActionId(job)).filter(Boolean);
    setError('');
    bulkRequestTailoredResumes(
      { jobIds, profileId: activeProfile.id },
      {
        onError: (batchError) => setError(batchError.message),
        onSuccess: (result) => setBatchResultError(result, 'tailoring request'),
      },
    );
  }

  function setBatchResultError(result, label) {
    const failed = (result?.results || []).filter((item) => !item.ok);
    if (!failed.length) return;
    const firstError = failed[0]?.error || 'Some rows failed';
    setError(`${failed.length} ${label}${failed.length === 1 ? '' : 's'} failed. ${firstError}`);
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
  const loading = profilesLoading || metaLoading || (jobsLoading && !bidJobsData);
  const bidWorkspace = useMemo(
    () => ({
      activeColor,
      activeProfileId: activeProfile?.id || '',
      activeTab: activeBidTab,
      callerUsers: bidJobsData?.callerUsers || [],
      currentUser: currentBidUser,
      draftsForJob: draftFor,
      isBulkUpdating: bulkUpdatingBids || bulkRequestingTailoredResumes,
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
      onBulkCallerChange: batchAssignCaller,
      onBulkStatusChange: batchUpdateStatus,
      onBulkTailorResumes: batchTailorResumes,
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
      bidJobsData?.callerUsers,
      bidJobsData?.tabCounts,
      bulkRequestingTailoredResumes,
      bulkUpdatingBids,
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
            activeProfile={activeProfileForDisplay}
            dailyGoalLabel={dailyGoalLabel}
            isDailyGoalCurrent={isDailyGoalCurrent}
            isLoading={profilesLoading}
            profiles={profilesForDisplay}
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
                  showTomorrowDateFilter: canUseTomorrowDateFilter,
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
              {canViewBidGoals ? (
                <BidDailyGoalBar
                  activeColor={activeColor}
                  dateLabel={dailyGoalLabel}
                  isCurrentDate={isDailyGoalCurrent}
                  profile={activeProfileForDisplay}
                />
              ) : null}
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <BidWorkspaceProvider value={bidWorkspace}>
                  <BidJobsPanel key={activeProfile.id} />
                </BidWorkspaceProvider>
              </Box>
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
      <SameCompanyTailoringDialog
        confirmation={sameCompanyConfirmation}
        onClose={closeSameCompanyConfirmation}
        onConfirm={confirmSameCompanyTailoring}
      />
    </Box>
  );
}
