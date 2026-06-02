import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import { BID_TABS, DEFAULT_BID_FILTERS, INTERVIEW_STAGES } from '../components/bids/bidConstants.js';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { useBidJobs, useBidProfiles, useUpdateJobBid } from '../lib/api.js';
import { formatDate, formatDateTime } from '../lib/formatters.js';

const INTERVIEW_FILTERS = {
  ...DEFAULT_BID_FILTERS,
  since: 'all',
  sort: 'updated_desc',
  limit: 100,
};

const DEFAULT_STAGE = INTERVIEW_STAGES[0].value;

export default function InterviewsPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [drafts, setDrafts] = useState({});
  const [draggedJobId, setDraggedJobId] = useState('');
  const [activeDropStage, setActiveDropStage] = useState('');
  const [error, setError] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useBidProfiles();
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
              {loading && !jobs.length ? <LoadingState /> : null}
              {!loading && jobs.length === 0 ? (
                <Paper variant="outlined" sx={{ m: 1.5, p: 3 }}>
                  <Typography color="text.secondary">No interviewing jobs match this profile and search.</Typography>
                </Paper>
              ) : null}
              {jobs.length ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridAutoColumns: { xs: '82vw', sm: 340, xl: 360 },
                    gridAutoFlow: 'column',
                    gap: 1,
                    height: '100%',
                    minHeight: 0,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    p: { xs: 1, sm: 1.5 },
                  }}
                >
                  {INTERVIEW_STAGES.map((stage) => (
                    <InterviewColumn
                      key={stage.value}
                      accent={activeColor}
                      currentUser={interviewsData?.currentUser || currentUser}
                      isActiveDrop={activeDropStage === stage.value}
                      isSaving={updatingBid}
                      jobs={jobsByStage[stage.value] || []}
                      stage={stage}
                      onDragEnd={() => {
                        setDraggedJobId('');
                        setActiveDropStage('');
                      }}
                      onDragEnter={() => setActiveDropStage(stage.value)}
                      onDragStart={handleDragStart}
                      onDrop={(event) => handleDrop(event, stage.value)}
                      onDraftChange={updateDraft}
                      onSave={saveInterview}
                      draftFor={draftFor}
                    />
                  ))}
                </Box>
              ) : null}
            </Box>
          </Paper>
        </Box>
      ) : null}
    </Box>
  );
}

function InterviewColumn({
  accent,
  currentUser,
  draftFor,
  isActiveDrop,
  isSaving,
  jobs,
  onDragEnd,
  onDragEnter,
  onDragStart,
  onDraftChange,
  onDrop,
  onSave,
  stage,
}) {
  return (
    <Paper
      variant="outlined"
      onDragEnter={onDragEnter}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={onDrop}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: isActiveDrop ? accent.soft : '#F8FAFC',
        borderColor: isActiveDrop ? accent.main : 'divider',
      }}
    >
      <Box
        sx={{
          px: 1,
          py: 0.85,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" fontWeight={900} noWrap>
          {stage.label}
        </Typography>
        <Chip
          label={jobs.length.toLocaleString()}
          size="small"
          sx={{ bgcolor: accent.soft, color: accent.dark, fontWeight: 900, height: 22 }}
        />
      </Box>
      <Stack spacing={0.85} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 0.85 }}>
        {!jobs.length ? (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(255, 255, 255, 0.72)' }}>
            <Typography variant="body2" color="text.secondary">
              Drop applications here.
            </Typography>
          </Paper>
        ) : null}
        {jobs.map((job) => (
          <InterviewCard
            key={job.id}
            accent={accent}
            currentUser={currentUser}
            draft={draftFor(job)}
            isSaving={isSaving}
            job={job}
            onDragEnd={onDragEnd}
            onDragStart={(event) => onDragStart(event, job)}
            onDraftChange={(key, value) => onDraftChange(job, key, value)}
            onSave={(overrides) => onSave(job, overrides)}
          />
        ))}
      </Stack>
    </Paper>
  );
}

function InterviewCard({ accent, currentUser, draft, isSaving, job, onDraftChange, onDragEnd, onDragStart, onSave }) {
  const owner = job.bid?.user?.username || (String(job.bid?.userId) === String(currentUser?.id) ? currentUser?.username : '');

  function handleStatusChange(event) {
    const status = event.target.value;
    onDraftChange('status', status);
    onSave({ status });
  }

  return (
    <Card
      draggable
      variant="outlined"
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      sx={{
        borderLeft: `4px solid ${accent.main}`,
        boxShadow: 1,
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
      }}
    >
      <CardContent sx={{ display: 'grid', gap: 1, p: 1, '&:last-child': { pb: 1 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) max-content', gap: 0.75, alignItems: 'start' }}>
          <Box minWidth={0}>
            <Typography
              component="a"
              href={job.url}
              target="_blank"
              rel="noreferrer"
              variant="body2"
              fontWeight={900}
              sx={{
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main', textDecoration: 'underline' },
              }}
            >
              {job.title || 'Untitled role'}
            </Typography>
            <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 0.25 }}>
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                {job.company || 'Unknown company'}
              </Box>
              {job.location ? ` · ${job.location}` : null}
            </Typography>
          </Box>
          <DragIndicatorIcon fontSize="small" color="action" />
        </Box>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <Chip
            icon={<CalendarMonthIcon />}
            label={draft.interviewNextAt ? formatDateTime(draft.interviewNextAt) : 'No next date'}
            size="small"
            sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 800, '& .MuiChip-icon': { color: '#0F766E' } }}
          />
          {owner ? <Chip label={owner} size="small" sx={{ bgcolor: '#edf0ff', color: '#343f91', fontWeight: 800 }} /> : null}
          <Chip label={formatDate(job.bid?.updatedAt)} size="small" sx={{ bgcolor: '#f7ead1', color: '#70400d', fontWeight: 800 }} />
        </Stack>

        <TextField
          label="Next interview"
          size="small"
          type="datetime-local"
          value={toDatetimeLocalValue(draft.interviewNextAt)}
          onChange={(event) => onDraftChange('interviewNextAt', event.target.value ? new Date(event.target.value).toISOString() : '')}
          disabled={isSaving}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormControl size="small">
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={draft.status || 'interviewing'} onChange={handleStatusChange} disabled={isSaving}>
            <MenuItem value="interviewing">Interviewing</MenuItem>
            <MenuItem value="submitted">Submitted</MenuItem>
            <MenuItem value="won">Won</MenuItem>
            <MenuItem value="lost">Lost</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Notes"
          minRows={2}
          multiline
          value={draft.interviewNotes || ''}
          onChange={(event) => onDraftChange('interviewNotes', event.target.value)}
          disabled={isSaving}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.75 }}>
          <Button
            component="a"
            href={job.url}
            target="_blank"
            rel="noreferrer"
            size="small"
            startIcon={<OpenInNewIcon />}
            variant="outlined"
            sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
          >
            Job
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => onSave()}
            size="small"
            startIcon={isSaving ? <CircularProgress color="inherit" size={16} /> : <SaveIcon />}
            variant="contained"
            sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
          >
            Save
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Paper variant="outlined" sx={{ m: 1.5, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
      <CircularProgress size={22} />
      <Typography color="text.secondary">Loading interviews...</Typography>
    </Paper>
  );
}

function groupJobsByStage(jobs, draftFor) {
  return INTERVIEW_STAGES.reduce((groups, stage) => {
    groups[stage.value] = jobs.filter((job) => canonicalInterviewStage(draftFor(job).interviewStage) === stage.value);
    return groups;
  }, {});
}

function canonicalInterviewStage(value) {
  const aliases = {
    recruiter: 'hiring_manager',
    technical: 'technical_interview',
    take_home: 'technical_interview',
    onsite: 'panel',
    offer: 'final',
    follow_up: 'final',
  };
  const stage = aliases[value] || value || DEFAULT_STAGE;
  return INTERVIEW_STAGES.some((item) => item.value === stage) ? stage : DEFAULT_STAGE;
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}
