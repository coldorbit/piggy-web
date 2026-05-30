import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Paper, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import BidJobsPanel from '../components/bids/BidJobsPanel.jsx';
import BidProfileSummary from '../components/bids/BidProfileSummary.jsx';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import { BID_TABS, DEFAULT_BID_FILTERS, DONE_STATUSES, EMPTY_BID } from '../components/bids/bidConstants.js';
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
  useTailoredResumeEvents,
  useUpdateJobBid,
} from '../lib/api.js';
import { mergeKnownFilters, readPersistedFilters, writePersistedFilters } from '../lib/persistedFilters.js';

const BID_FILTER_KEYS = ['search', 'roleFamily', 'source', 'since', 'spam', 'visibility', 'origin', 'sort', 'page', 'limit'];
const BID_FILTERS_STORAGE_KEY = 'applypilot.bids.filters';

export default function BidPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [activeBidTab, setActiveBidTab] = useState(() => bidTabFromParam(searchParams.get('tab')));
  const [filters, setFilters] = useState(() => bidFiltersFromParams(searchParams));
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [tailoringByJobId, setTailoringByJobId] = useState({});

  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useBidProfiles();
  const activeProfiles = useMemo(
    () => profiles.filter((profile) => (profile.profileStatus || 'active') === 'active'),
    [profiles],
  );
  const activeProfile = useMemo(
    () => activeProfiles.find((profile) => String(profile.id) === String(activeProfileId)) || activeProfiles[0] || null,
    [activeProfiles, activeProfileId],
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
  const { mutate: requestTailoredResume } = useRequestTailoredResume();
  useTailoredResumeEvents(activeProfile?.id);

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
    return drafts[job.id] || { ...EMPTY_BID, ...(job.bid || {}) };
  }

  function updateDraft(jobId, key, value) {
    setDrafts((current) => ({
      ...current,
      [jobId]: {
        ...(current[jobId] || EMPTY_BID),
        [key]: value,
      },
    }));
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  }

  function updateBidTab(value) {
    setActiveBidTab(value);
    setFilters((current) => ({ ...current, page: 1 }));
  }

  function saveBid(job, bidDataOverride) {
    if (!activeProfile) return;
    const bidData = { ...draftFor(job), ...(bidDataOverride || {}), profileId: activeProfile.id };
    const mutation = job.bid ? updateBid : createBid;
    const payload = job.bid ? { bidId: job.bid.id, jobId: job.id, bidData } : { jobId: job.id, bidData };

    setError('');
    mutation(payload, {
      onError: (bidError) => setError(bidError.message),
    });
  }

  function tailorResume(job) {
    if (!activeProfile) return;
    if (tailoringByJobId[job.id]) return;

    setTailoringByJobId((current) => ({ ...current, [job.id]: true }));
    setError('');
    requestTailoredResume(
      { jobId: job.id, profileId: activeProfile.id },
      {
        onError: (tailoredResumeError) => setError(tailoredResumeError.message),
        onSettled: () => {
          setTailoringByJobId((current) => {
            const next = { ...current };
            delete next[job.id];
            return next;
          });
        },
      },
    );
  }

  function updateHiddenState(job, isHidden) {
    setError('');
    markHidden(
      { jobId: job.id, isHidden },
      {
        onError: (hiddenError) => setError(hiddenError.message),
      },
    );
  }

  const activeColor = PROFILE_COLORS[activeProfile?.colorScheme || 'green'];
  const jobs = bidJobsData?.jobs || [];
  const visibleJobs = jobs.filter((job) => isJobVisibleForTab(job, activeBidTab, draftFor(job)));
  const total = bidJobsData?.total || 0;
  const pageError = error || profilesError?.message || jobsError?.message || metaError?.message || '';
  const loading = profilesLoading || jobsLoading || metaLoading;

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {!activeProfiles.length && !profilesLoading ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">No active profiles are available for bidding.</Typography>
        </Paper>
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
                meta={metaData || { sources: [] }}
                onClose={() => setIsFilterPanelOpen(false)}
                onFilterChange={updateFilter}
                onOpen={() => setIsFilterPanelOpen(true)}
                onRefresh={() => {
                  refetchMeta();
                  refetchJobs();
                }}
              />
              <BidJobsPanel
                activeColor={activeColor}
                activeTab={activeBidTab}
                creatingBid={creatingBid}
                draftsForJob={draftFor}
                jobs={visibleJobs}
                loading={loading}
                page={filters.page}
                pageSize={filters.limit}
                pages={Math.max(Math.ceil(total / filters.limit), 1)}
                tabCounts={bidJobsData?.tabCounts || { todo: 0, tailored: 0, done: 0 }}
                total={total}
                updatingBid={updatingBid}
                onDraftChange={updateDraft}
                onPageChange={(page) => updateFilter('page', page)}
                onPageSizeChange={(limit) => updateFilter('limit', limit)}
                onStatusChange={saveBid}
                onTabChange={updateBidTab}
                tailoringByJobId={tailoringByJobId}
                onHiddenChange={updateHiddenState}
                onTailorResume={tailorResume}
              />
            </Box>
          ) : null}
        </Box>
      ) : null}

      <ProfileDialog
        form={profileForm}
        isOpen={isProfileDialogOpen}
        isSaving={creatingProfile}
        onChange={setProfileForm}
        onClose={() => setIsProfileDialogOpen(false)}
        onSubmit={submitProfile}
      />
    </Box>
  );
}

function bidTabFromParam(value) {
  return Object.values(BID_TABS).includes(value) ? value : BID_TABS.todo;
}

function bidFiltersFromParams(params) {
  const persistedFilters = readPersistedFilters(BID_FILTERS_STORAGE_KEY, DEFAULT_BID_FILTERS, BID_FILTER_KEYS);
  const paramFilters = {};
  BID_FILTER_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value !== null) paramFilters[key] = value;
  });
  return mergeKnownFilters(persistedFilters, paramFilters, BID_FILTER_KEYS);
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
  const hasTailoredRequest = ['requested', 'processing', 'ready', 'dead_letter'].includes(job.tailoredResume?.status);

  if (activeTab === BID_TABS.tailored) return hasTailoredRequest && !done;
  if (activeTab === BID_TABS.done) return done;
  return !done && !hasTailoredRequest;
}
