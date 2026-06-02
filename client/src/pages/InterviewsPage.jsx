import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import { BID_TABS } from '../components/bids/bidConstants.js';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import InterviewKanbanBoard from '../components/interviews/InterviewKanbanBoard.jsx';
import InterviewLoadingState from '../components/interviews/InterviewLoadingState.jsx';
import { canonicalInterviewStage, groupJobsByStage, INTERVIEW_FILTERS } from '../components/interviews/interviewUtils.js';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { useBidJobs, useBidProfiles, useUpdateJobBid } from '../lib/api.js';

export default function InterviewsPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [drafts, setDrafts] = useState({});
  const [draggedJobId, setDraggedJobId] = useState('');
  const [activeDropStage, setActiveDropStage] = useState('');
  const [error, setError] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useBidProfiles(
    currentUser?.role === 'admin' ? { scope: 'manage' } : {},
  );
  const activeProfiles = useMemo(
    () => profiles.filter((profile) => (profile.profileStatus || 'active') === 'active'),
    [profiles],
  );
  const activeProfile = useMemo(
    () => activeProfiles.find((profile) => String(profile.id) === String(activeProfileId)) || activeProfiles[0] || null,
    [activeProfiles, activeProfileId],
  );
  const filters = useMemo(
    () => ({
      ...INTERVIEW_FILTERS,
      search,
      bidTab: BID_TABS.interviews,
    }),
    [search],
  );
  const {
    data: interviewsData,
    isLoading: interviewsLoading,
    error: interviewsError,
  } = useBidJobs(activeProfile?.id, filters);
  const { mutate: updateBid, isPending: updatingBid } = useUpdateJobBid();

  useEffect(() => {
    if (!activeProfiles[0]) return;
    const hasActiveProfile = activeProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!activeProfileId || !hasActiveProfile) setActiveProfileId(activeProfiles[0].id);
  }, [activeProfileId, activeProfiles]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (activeProfileId) nextParams.set('profileId', String(activeProfileId));
    if (search) nextParams.set('search', search);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeProfileId, search, searchParams, setSearchParams]);

  useEffect(() => {
    setHeaderSearch({
      isVisible: true,
      placeholder: 'Search interviews',
      value: search,
      onChange: setSearch,
    });
  }, [search, setHeaderSearch]);

  useEffect(() => {
    return () => setHeaderSearch(EMPTY_HEADER_SEARCH);
  }, [setHeaderSearch]);

  function draftFor(job) {
    return {
      ...(job.bid || {}),
      ...(drafts[job.bid?.id] || {}),
      interviewStage: canonicalInterviewStage(drafts[job.bid?.id]?.interviewStage || job.bid?.interviewStage),
    };
  }

  function updateDraft(job, key, value) {
    if (!job.bid) return;
    setDrafts((current) => ({
      ...current,
      [job.bid.id]: {
        ...(current[job.bid.id] || job.bid),
        [key]: value,
      },
    }));
  }

  function saveInterview(job, overrides = {}) {
    if (!job.bid) return;
    const bidData = {
      ...draftFor(job),
      ...overrides,
      interviewStage: canonicalInterviewStage(overrides.interviewStage || draftFor(job).interviewStage),
      profileId: activeProfile?.id,
    };
    setError('');
    updateBid(
      { bidId: job.bid.id, jobId: job.id, bidData },
      {
        onError: (bidError) => setError(bidError.message),
        onSuccess: () => {
          setDrafts((current) => {
            const next = { ...current };
            delete next[job.bid.id];
            return next;
          });
        },
      },
    );
  }

  function handleDragStart(event, job) {
    setDraggedJobId(String(job.id));
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(job.id));
  }

  function handleDrop(event, stage) {
    event.preventDefault();
    const jobId = event.dataTransfer.getData('text/plain') || draggedJobId;
    const job = jobs.find((row) => String(row.id) === String(jobId));
    setDraggedJobId('');
    setActiveDropStage('');
    if (!job || !job.bid) return;
    if (canonicalInterviewStage(draftFor(job).interviewStage) === stage) return;
    updateDraft(job, 'interviewStage', stage);
    saveInterview(job, { interviewStage: stage, status: 'interviewing' });
  }

  const activeColor = PROFILE_COLORS[activeProfile?.colorScheme || 'green'];
  const jobs = interviewsData?.jobs || [];
  const jobsByStage = groupJobsByStage(jobs, draftFor);
  const loading = profilesLoading || interviewsLoading;
  const pageError = error || profilesError?.message || interviewsError?.message || '';

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {!activeProfiles.length && !profilesLoading ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">No active profiles are available for interviews.</Typography>
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

          <Paper
            variant="outlined"
            sx={{
              overflow: 'hidden',
              boxShadow: 1,
              height: { xs: 'auto', md: '100%' },
              minHeight: { md: 0 },
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                px: 1.5,
                py: 1.25,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Box minWidth={0}>
                <Typography fontWeight={900} noWrap>
                  {activeProfile?.name || 'Interviews'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(interviewsData?.total || 0).toLocaleString()} active interview{interviewsData?.total === 1 ? '' : 's'}
                </Typography>
              </Box>
              {loading ? <CircularProgress size={22} /> : null}
            </Box>

            <Box sx={{ flex: 1, minHeight: { md: 0 }, overflow: 'hidden', bgcolor: 'background.paper' }}>
              {loading && !jobs.length ? <InterviewLoadingState /> : null}
              {!loading || jobs.length ? (
                <InterviewKanbanBoard
                  activeColor={activeColor}
                  activeDropStage={activeDropStage}
                  callerUsers={interviewsData?.callerUsers || []}
                  currentUser={interviewsData?.currentUser || currentUser}
                  canAssignCallers={currentUser?.role === 'admin'}
                  draftFor={draftFor}
                  isSaving={updatingBid}
                  jobsByStage={jobsByStage}
                  onDragEnd={() => {
                    setDraggedJobId('');
                    setActiveDropStage('');
                  }}
                  onDragEnter={setActiveDropStage}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDraftChange={updateDraft}
                  onSave={saveInterview}
                />
              ) : null}
            </Box>
          </Paper>
        </Box>
      ) : null}
    </Box>
  );
}
