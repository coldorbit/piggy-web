import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import { BID_TABS, INTERVIEW_KANBAN_COLUMNS, INTERVIEW_STAGES } from '../components/bids/bidConstants.js';
import EmptyState from '../components/common/EmptyState.jsx';
import SavedViewsToolbar from '../components/common/SavedViewsToolbar.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import InterviewKanbanBoard from '../components/interviews/InterviewKanbanBoard.jsx';
import InterviewLoadingState from '../components/interviews/InterviewLoadingState.jsx';
import {
  canonicalInterviewStage,
  DEFAULT_INTERVIEW_DURATION_MINUTES,
  groupJobsByStage,
  INTERVIEW_FILTERS,
  INTERVIEW_DURATION_OPTIONS,
  interviewColumnValue,
  interviewStageForColumn,
  interviewStatusForColumn,
  toDatetimeLocalValue,
} from '../components/interviews/interviewUtils.js';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { downloadAuthenticatedFile, useBidJobs, useBidProfiles, useCreateManualInterview, useDeleteInterview, useUpdateJobBid } from '../lib/api.js';
import { formatDateTimeInDefaultTimezone } from '../lib/formatters.js';
import { isAdminRole } from '../lib/roles.js';
import { DEFAULT_TIME_ZONE_LABEL, fromDefaultTimezoneDatetimeLocal } from '../lib/timezone.js';

const EMPTY_MANUAL_INTERVIEW = {
  title: '',
  company: '',
  location: '',
  jobUrl: '',
  interviewStage: 'todo',
  interviewNextAt: '',
  interviewDurationMinutes: DEFAULT_INTERVIEW_DURATION_MINUTES,
  interviewMeetingLink: '',
  stageMeetingLinks: {},
  callerUserId: '',
  interviewNotes: '',
};

const INTERVIEW_SAVED_VIEWS_STORAGE_KEY = 'applypilot.interviews.savedViews.v1';
const INTERVIEW_DEFAULT_SAVED_VIEWS = [
  {
    id: 'needs-links',
    label: 'Missing meeting links',
    payload: { search: '', needsLinksOnly: true },
  },
  {
    id: 'all-active',
    label: 'All active interviews',
    payload: { search: '', needsLinksOnly: false },
  },
];

export default function InterviewsPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [needsLinksOnly, setNeedsLinksOnly] = useState(() => searchParams.get('needsLinks') === '1');
  const [drafts, setDrafts] = useState({});
  const [activeDropStage, setActiveDropStage] = useState('');
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [selectedInterviewId, setSelectedInterviewId] = useState('');
  const [selectedApplicationJob, setSelectedApplicationJob] = useState(null);
  const [applicationSearch, setApplicationSearch] = useState('');
  const [manualInterview, setManualInterview] = useState(EMPTY_MANUAL_INTERVIEW);
  const [pendingStepChangeSave, setPendingStepChangeSave] = useState(null);
  const [error, setError] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useBidProfiles(
    isAdminRole(currentUser) ? { scope: 'manage' } : {},
  );
  const interviewProfiles = useMemo(
    () => profiles.filter((profile) => ['active', 'legacy'].includes(profile.profileStatus || 'active')),
    [profiles],
  );
  const activeProfile = useMemo(
    () => interviewProfiles.find((profile) => String(profile.id) === String(activeProfileId)) || interviewProfiles[0] || null,
    [interviewProfiles, activeProfileId],
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
  const applicationPickerFilters = useMemo(
    () => ({
      bidTab: BID_TABS.done,
      since: 'all',
      search: applicationSearch,
      limit: 75,
    }),
    [applicationSearch],
  );
  const {
    data: applicationPickerData,
    isLoading: applicationPickerLoading,
  } = useBidJobs(isManualDialogOpen ? activeProfile?.id : '', applicationPickerFilters);
  const { mutate: updateBid, isPending: updatingBid } = useUpdateJobBid();
  const { mutate: createManualInterview, isPending: creatingManualInterview } = useCreateManualInterview();
  const { mutate: deleteInterview, isPending: deletingInterview } = useDeleteInterview();

  useEffect(() => {
    if (!interviewProfiles[0]) return;
    const hasActiveProfile = interviewProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!activeProfileId || !hasActiveProfile) setActiveProfileId(interviewProfiles[0].id);
  }, [activeProfileId, interviewProfiles]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (activeProfileId) nextParams.set('profileId', String(activeProfileId));
    if (search) nextParams.set('search', search);
    if (needsLinksOnly) nextParams.set('needsLinks', '1');
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeProfileId, needsLinksOnly, search, searchParams, setSearchParams]);

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
      status: drafts[job.bid?.id]?.status || job.bid?.status || 'interviewing',
      interviewStage: canonicalInterviewStage(drafts[job.bid?.id]?.interviewStage || job.bid?.interviewStage),
      interviewDurationMinutes:
        drafts[job.bid?.id]?.interviewDurationMinutes || job.bid?.interviewDurationMinutes || DEFAULT_INTERVIEW_DURATION_MINUTES,
      stageMeetingLinks: drafts[job.bid?.id]?.stageMeetingLinks || job.bid?.stageMeetingLinks || {},
      meetingLink: drafts[job.bid?.id]?.meetingLink || job.bid?.meetingLink || '',
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

  function applySavedView(view) {
    if (view?.activeProfileId) setActiveProfileId(view.activeProfileId);
    if (Object.prototype.hasOwnProperty.call(view || {}, 'search')) setSearch(view.search || '');
    if (Object.prototype.hasOwnProperty.call(view || {}, 'needsLinksOnly')) setNeedsLinksOnly(Boolean(view.needsLinksOnly));
  }

  function saveInterview(job, overrides = {}, options = {}) {
    if (!job.bid) return;
    const draft = draftFor(job);
    const bidData = {
      ...draft,
      ...overrides,
      interviewStage: canonicalInterviewStage(overrides.interviewStage || draft.interviewStage),
      profileId: activeProfile?.id,
    };
    const stepChange = interviewStepChange(job, bidData);
    if (stepChange && !options.confirmStepChange) {
      setPendingStepChangeSave({ job, bidData, ...stepChange });
      return;
    }
    submitInterviewSave(job, bidData);
  }

  function submitInterviewSave(job, bidData) {
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

  function handleDragEnd({ jobId, stage }) {
    const job = jobs.find((row) => String(row.id) === String(jobId));
    setActiveDropStage('');
    if (!stage || !job || !job.bid) return;
    if (interviewColumnValue(job, draftFor) === stage) return;
    const status = interviewStatusForColumn(stage);
    const interviewStage = interviewStageForColumn(stage, draftFor(job).interviewStage);
    saveInterview(job, { interviewStage, status, interviewNextAt: null });
  }

  function confirmPendingStepChange() {
    if (!pendingStepChangeSave) return;
    submitInterviewSave(pendingStepChangeSave.job, pendingStepChangeSave.bidData);
    setPendingStepChangeSave(null);
  }

  function closePendingStepChangeDialog() {
    setPendingStepChangeSave(null);
  }

  function openManualDialog() {
    setError('');
    setManualInterview(EMPTY_MANUAL_INTERVIEW);
    setSelectedApplicationJob(null);
    setApplicationSearch('');
    setIsManualDialogOpen(true);
  }

  function closeManualDialog() {
    setIsManualDialogOpen(false);
    setManualInterview(EMPTY_MANUAL_INTERVIEW);
    setSelectedApplicationJob(null);
    setApplicationSearch('');
  }

  function openInterviewDialog(job) {
    if (!job?.bid?.id) return;
    setSelectedInterviewId(String(job.bid.id));
  }

  function closeInterviewDialog() {
    setSelectedInterviewId('');
  }

  function submitManualInterview(event) {
    event.preventDefault();
    if (!activeProfile) return;
    setError('');
    if (selectedApplicationJob?.bid?.id) {
      const stageMeetingLinks = manualInterview.interviewMeetingLink
        ? { [manualInterview.interviewStage]: manualInterview.interviewMeetingLink }
        : {};
      updateBid(
        {
          bidId: selectedApplicationJob.bid.id,
          jobId: selectedApplicationJob.id,
          bidData: {
            ...selectedApplicationJob.bid,
            profileId: activeProfile.id,
            status: 'interviewing',
            interviewStage: manualInterview.interviewStage,
            interviewNextAt: fromDefaultTimezoneDatetimeLocal(manualInterview.interviewNextAt),
            interviewDurationMinutes: manualInterview.interviewDurationMinutes,
            callerUserId: manualInterview.callerUserId,
            interviewNotes: manualInterview.interviewNotes,
            stageMeetingLinks,
          },
        },
        {
          onSuccess: closeManualDialog,
          onError: (interviewError) => setError(interviewError.message),
        },
      );
      return;
    }
    createManualInterview(
      {
        ...manualInterview,
        profileId: activeProfile.id,
        interviewNextAt: fromDefaultTimezoneDatetimeLocal(manualInterview.interviewNextAt),
        stageMeetingLinks: manualInterview.interviewMeetingLink
          ? { [manualInterview.interviewStage]: manualInterview.interviewMeetingLink }
          : {},
      },
      {
        onSuccess: closeManualDialog,
        onError: (interviewError) => setError(interviewError.message),
      },
    );
  }

  function handleDeleteInterview(job) {
    if (!job.bid?.id) return;
    const label = [job.title, job.company].filter(Boolean).join(' at ') || 'this interview';
    if (!window.confirm(`Delete ${label}?`)) return;
    setError('');
    deleteInterview(job.bid.id, {
      onError: (interviewError) => setError(interviewError.message),
      onSuccess: () => {
        closeInterviewDialog();
        setDrafts((current) => {
          const next = { ...current };
          delete next[job.bid.id];
          return next;
        });
      },
    });
  }

  const activeColor = PROFILE_COLORS[activeProfile?.colorScheme || 'green'];
  const allJobs = interviewsData?.jobs || [];
  const jobs = needsLinksOnly ? allJobs.filter((job) => !hasMeetingLink(job, draftFor(job))) : allJobs;
  const selectedJob = selectedInterviewId
    ? jobs.find((job) => String(job.bid?.id) === String(selectedInterviewId)) || null
    : null;
  const selectedDraft = selectedJob ? draftFor(selectedJob) : null;
  const selectedStage = selectedDraft?.interviewStage || INTERVIEW_STAGES[0].value;
  const selectedColumn = selectedJob ? interviewColumnValue(selectedJob, draftFor) : selectedStage;
  const selectedStageNotes = selectedDraft?.stageNotes || {};
  const selectedStageNote = selectedStageNotes[selectedStage] || selectedDraft?.interviewNotes || '';
  const selectedStageMeetingLinks = selectedDraft?.stageMeetingLinks || {};
  const selectedStageMeetingLink = selectedStageMeetingLinks[selectedStage] || '';
  const selectedJobUrl = externalJobUrl(selectedJob);
  const selectedMeetingUrl = externalUrl(selectedStageMeetingLink);
  const selectedResumeUrl = resumeDownloadUrl(selectedJob?.tailoredResume);
  const selectedResumeStatus = selectedJob?.tailoredResume?.status || '';
  const callerUsers = interviewsData?.callerUsers || [];
  const applicationOptions = useMemo(
    () => (applicationPickerData?.jobs || []).filter((job) => job?.bid?.id && job.bid.status === 'submitted'),
    [applicationPickerData?.jobs],
  );
  const jobsByStage = groupJobsByStage(jobs, draftFor);
  const effectiveCurrentUser = interviewsData?.currentUser || currentUser;
  const isActiveProfileOwner = String(activeProfile?.userId || '') === String(effectiveCurrentUser?.id || currentUser?.id || '');
  const activeInterviewCount = Number(activeProfile?.progress?.activeInterviews || 0);
  const missingMeetingLinkCount = allJobs.filter((job) => !hasMeetingLink(job, draftFor(job))).length;
  const totalInterviewCount = Number(activeProfile?.progress?.totalInterviews || interviewsData?.total || 0);
  const canEditInterviews = currentUser?.role !== 'caller' && (isAdminRole(currentUser) || isActiveProfileOwner);
  const canDeleteSelectedInterview =
    selectedJob &&
    canEditInterviews &&
    (isAdminRole(currentUser) || String(selectedJob.bid?.profileId || '') === String(activeProfile?.id || ''));
  const loading = profilesLoading || interviewsLoading;
  const pageError = error || profilesError?.message || interviewsError?.message || '';

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {!interviewProfiles.length && !profilesLoading ? (
        <EmptyState
          title="No interview profiles available"
          detail="Interview work appears after an active or legacy profile has applications in the interview pipeline."
        />
      ) : null}

      {profilesLoading || interviewProfiles.length ? (
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
            profiles={interviewProfiles}
            showDailyGoal={false}
            showInterviewCounts
            onProfileChange={setActiveProfileId}
          />

          <Paper
            variant="outlined"
            sx={{
              overflow: 'hidden',
              boxShadow: 1,
              height: { xs: 'auto', md: '100%' },
              minHeight: { md: 0 },
              minWidth: 0,
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
                  {activeInterviewCount.toLocaleString()} active · {totalInterviewCount.toLocaleString()} total
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {loading ? <CircularProgress size={22} /> : null}
                {canEditInterviews ? (
                  <Button
                    disabled={!activeProfile || creatingManualInterview}
                    onClick={openManualDialog}
                    size="small"
                    startIcon={<AddIcon />}
                    variant="contained"
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Register
                  </Button>
                ) : null}
              </Box>
            </Box>

            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: '#F8FAFC' }}>
              <SavedViewsToolbar
                currentView={{ activeProfileId, search, needsLinksOnly }}
                defaultViews={INTERVIEW_DEFAULT_SAVED_VIEWS}
                helperText={`${missingMeetingLinkCount.toLocaleString()} interview${missingMeetingLinkCount === 1 ? '' : 's'} missing a stage meeting link.`}
                onApplyView={applySavedView}
                storageKey={INTERVIEW_SAVED_VIEWS_STORAGE_KEY}
                title="Interview saved views"
              />
            </Box>

            <Box sx={{ flex: 1, minHeight: { md: 0 }, minWidth: 0, overflow: 'hidden', bgcolor: 'background.paper' }}>
              {loading && !jobs.length ? <InterviewLoadingState /> : null}
              {!loading || jobs.length ? (
                <InterviewKanbanBoard
                  activeColor={activeColor}
                  activeDropStage={activeDropStage}
                  callerUsers={callerUsers}
                  currentUser={effectiveCurrentUser}
                  canAssignCallers={isAdminRole(currentUser)}
                  canDeleteInterviews={canEditInterviews}
                  draftFor={draftFor}
                  isDeleting={deletingInterview}
                  isSaving={updatingBid || !canEditInterviews}
                  jobsByStage={jobsByStage}
                  onDragEnd={canEditInterviews ? handleDragEnd : () => {}}
                  onDragOver={setActiveDropStage}
                  onDraftChange={updateDraft}
                  onDelete={handleDeleteInterview}
                  onOpen={openInterviewDialog}
                  onSave={saveInterview}
                />
              ) : null}
            </Box>
          </Paper>
        </Box>
      ) : null}

      <Dialog open={isManualDialogOpen} onClose={closeManualDialog} fullWidth maxWidth="sm">
        <form onSubmit={submitManualInterview}>
          <DialogTitle>Register interview</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
            <Autocomplete
              autoFocus
              clearOnBlur={false}
              filterOptions={(options) => options}
              getOptionLabel={applicationOptionLabel}
              isOptionEqualToValue={(option, value) => String(option?.bid?.id || '') === String(value?.bid?.id || '')}
              loading={applicationPickerLoading}
              noOptionsText={applicationSearch ? 'No submitted applications found' : 'No submitted applications'}
              options={applicationOptions}
              value={selectedApplicationJob}
              inputValue={applicationSearch}
              onChange={(_event, option) => {
                setSelectedApplicationJob(option);
                if (option) {
                  setApplicationSearch(applicationOptionLabel(option));
                  setManualInterview((current) => ({
                    ...current,
                    title: option.title || '',
                    company: option.company || '',
                    location: option.location || '',
                    jobUrl: option.url || '',
                  }));
                }
              }}
              onInputChange={(_event, value, reason) => {
                setApplicationSearch(value);
                if (reason === 'clear' || reason === 'input') setSelectedApplicationJob(null);
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'grid', gap: 0.25 }}>
                  <Typography variant="body2" fontWeight={800}>
                    {option.title || 'Untitled role'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[option.company, option.location].filter(Boolean).join(' · ') || 'Submitted application'}
                  </Typography>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Application"
                  placeholder="Search submitted applications"
                  helperText="Submitted applications for this profile"
                />
              )}
              sx={{ mt: 1 }}
            />
            {selectedApplicationJob ? (
              <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 0.75, bgcolor: '#F8FAFC' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Box minWidth={0}>
                    <Typography fontWeight={900} noWrap>
                      {selectedApplicationJob.title || 'Untitled role'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {[selectedApplicationJob.company, selectedApplicationJob.location].filter(Boolean).join(' · ') || 'Submitted application'}
                    </Typography>
                  </Box>
                  <Chip label="From application" sx={{ bgcolor: activeColor.soft, color: activeColor.dark, fontWeight: 900 }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {selectedApplicationJob.bid?.bidAt ? `Applied ${formatShortDate(selectedApplicationJob.bid.bidAt)}` : 'Submitted application'}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedApplicationJob(null);
                      setApplicationSearch('');
                      setManualInterview((current) => ({
                        ...current,
                        title: '',
                        company: '',
                        location: '',
                        jobUrl: '',
                      }));
                    }}
                  >
                    Use manual
                  </Button>
                </Box>
              </Paper>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  <TextField
                    label="Job title"
                    required
                    value={manualInterview.title}
                    onChange={(event) => setManualInterview((current) => ({ ...current, title: event.target.value }))}
                  />
                  <TextField
                    label="Company"
                    required
                    value={manualInterview.company}
                    onChange={(event) => setManualInterview((current) => ({ ...current, company: event.target.value }))}
                  />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  <TextField
                    label="Location"
                    value={manualInterview.location}
                    onChange={(event) => setManualInterview((current) => ({ ...current, location: event.target.value }))}
                  />
                  <TextField
                    label="Job link"
                    type="url"
                    value={manualInterview.jobUrl}
                    onChange={(event) => setManualInterview((current) => ({ ...current, jobUrl: event.target.value }))}
                  />
                </Box>
              </>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                label={`Next interview (${DEFAULT_TIME_ZONE_LABEL})`}
                type="datetime-local"
                value={toDatetimeLocalValue(manualInterview.interviewNextAt)}
                onChange={(event) => setManualInterview((current) => ({ ...current, interviewNextAt: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormControl>
                <InputLabel>Step</InputLabel>
                <Select
                  label="Step"
                  value={manualInterview.interviewStage}
                  onChange={(event) => setManualInterview((current) => ({ ...current, interviewStage: event.target.value }))}
                >
                  {INTERVIEW_STAGES.map((stage) => (
                    <MenuItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <FormControl>
              <InputLabel>Duration</InputLabel>
              <Select
                label="Duration"
                value={manualInterview.interviewDurationMinutes}
                onChange={(event) =>
                  setManualInterview((current) => ({ ...current, interviewDurationMinutes: Number(event.target.value) }))
                }
              >
                {INTERVIEW_DURATION_OPTIONS.map((duration) => (
                  <MenuItem key={duration.value} value={duration.value}>
                    {duration.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {isAdminRole(currentUser) ? (
              <FormControl>
                <InputLabel>Assignee</InputLabel>
                <Select
                  label="Assignee"
                  value={manualInterview.callerUserId}
                  onChange={(event) => setManualInterview((current) => ({ ...current, callerUserId: event.target.value }))}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {callerUsers.map((caller) => (
                    <MenuItem key={caller.id} value={caller.id}>
                      {caller.username}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <TextField
              label={`${stageLabel(manualInterview.interviewStage)} meeting link`}
              type="url"
              value={manualInterview.interviewMeetingLink}
              onChange={(event) => setManualInterview((current) => ({ ...current, interviewMeetingLink: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Notes"
              multiline
              minRows={3}
              value={manualInterview.interviewNotes}
              onChange={(event) => setManualInterview((current) => ({ ...current, interviewNotes: event.target.value }))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeManualDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={creatingManualInterview || updatingBid}>
              {selectedApplicationJob ? 'Register from application' : 'Register manually'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(selectedJob)} onClose={closeInterviewDialog} fullWidth maxWidth="md">
        {selectedJob && selectedDraft ? (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography fontWeight={900} noWrap>
                    {selectedJob.title || 'Untitled role'}
                  </Typography>
                  <Chip label={interviewColumnLabel(selectedColumn)} size="small" sx={{ bgcolor: activeColor.soft, color: activeColor.dark, fontWeight: 900 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {[selectedJob.company, selectedJob.location].filter(Boolean).join(' · ') || 'Interview'}
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' }, gap: 2, pt: 2 }}>
              <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start', minWidth: 0 }}>
                <TextField
                  label={`${stageLabel(selectedStage)} notes`}
                  minRows={8}
                  multiline
                  value={selectedStageNote}
                  onChange={(event) => {
                    const nextStageNotes = { ...selectedStageNotes, [selectedStage]: event.target.value };
                    updateDraft(selectedJob, 'stageNotes', nextStageNotes);
                    updateDraft(selectedJob, 'interviewNotes', event.target.value);
                  }}
                  disabled={updatingBid || !canEditInterviews}
                  sx={{ mt: 0.75 }}
                  slotProps={{
                    input: { sx: { alignItems: 'flex-start', pt: 1.75 } },
                    inputLabel: { shrink: true, sx: { bgcolor: 'background.paper', px: 0.5 } },
                  }}
                />
                {selectedDraft.logs?.length ? (
                  <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 0.75, bgcolor: '#F8FAFC' }}>
                    <Typography variant="body2" fontWeight={900}>
                      Journey
                    </Typography>
                    {selectedDraft.logs.map((log) => (
                      <Box key={log.id} sx={{ display: 'grid', gap: 0.2, minWidth: 0 }}>
                        <Typography variant="body2">{formatJourneyLog(log)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                        </Typography>
                      </Box>
                    ))}
                  </Paper>
                ) : null}
              </Box>
              <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start', pt: 0.5 }}>
                <FormControl size="small">
                  <InputLabel sx={{ bgcolor: 'background.paper', px: 0.5 }}>Status</InputLabel>
                  <Select
                    label="Status"
                    value={selectedColumn}
                    onChange={(event) => {
                      const nextColumn = event.target.value;
                      const nextStage = interviewStageForColumn(nextColumn, selectedStage);
                      const nextStatus = interviewStatusForColumn(nextColumn);
                      const stageChanged = nextStage !== selectedStage;
                      updateDraft(selectedJob, 'interviewStage', nextStage);
                      updateDraft(selectedJob, 'status', nextStatus);
                      updateDraft(selectedJob, 'interviewNotes', selectedStageNotes[nextStage] || '');
                      updateDraft(selectedJob, 'meetingLink', selectedStageMeetingLinks[nextStage] || '');
                      if (stageChanged) updateDraft(selectedJob, 'interviewNextAt', null);
                    }}
                    disabled={updatingBid || !canEditInterviews}
                  >
                    {INTERVIEW_KANBAN_COLUMNS.map((column) => (
                      <MenuItem key={column.value} value={column.value}>
                        {column.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label={`Next interview (${DEFAULT_TIME_ZONE_LABEL})`}
                  size="small"
                  type="datetime-local"
                  value={toDatetimeLocalValue(selectedDraft.interviewNextAt)}
                  onChange={(event) => updateDraft(selectedJob, 'interviewNextAt', fromDefaultTimezoneDatetimeLocal(event.target.value))}
                  disabled={updatingBid || !canEditInterviews}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <FormControl size="small">
                  <InputLabel>Duration</InputLabel>
                  <Select
                    label="Duration"
                    value={selectedDraft.interviewDurationMinutes || DEFAULT_INTERVIEW_DURATION_MINUTES}
                    onChange={(event) => updateDraft(selectedJob, 'interviewDurationMinutes', Number(event.target.value))}
                    disabled={updatingBid || !canEditInterviews}
                  >
                    {INTERVIEW_DURATION_OPTIONS.map((duration) => (
                      <MenuItem key={duration.value} value={duration.value}>
                        {duration.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label={`${stageLabel(selectedStage)} meeting link`}
                  size="small"
                  type="url"
                  value={selectedStageMeetingLink}
                  onChange={(event) => {
                    const nextStageMeetingLinks = { ...selectedStageMeetingLinks, [selectedStage]: event.target.value };
                    updateDraft(selectedJob, 'stageMeetingLinks', nextStageMeetingLinks);
                    updateDraft(selectedJob, 'meetingLink', event.target.value);
                  }}
                  disabled={updatingBid || !canEditInterviews}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                {isAdminRole(currentUser) ? (
                  <FormControl size="small">
                    <InputLabel>Assignee</InputLabel>
                    <Select
                      label="Assignee"
                      value={selectedDraft.callerUserId || ''}
                      onChange={(event) => updateDraft(selectedJob, 'callerUserId', event.target.value)}
                      disabled={updatingBid || !canEditInterviews}
                    >
                      <MenuItem value="">Unassigned</MenuItem>
                      {callerUsers.map((caller) => (
                        <MenuItem key={caller.id} value={caller.id}>
                          {caller.username}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}
                {selectedJobUrl ? (
                  <Button component="a" href={selectedJobUrl} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />} variant="outlined">
                    Job link
                  </Button>
                ) : null}
                {selectedResumeUrl ? (
                  <Button
                    onClick={() => downloadAuthenticatedFile(selectedResumeUrl, resumeFileName(selectedJob?.tailoredResume?.filePath))}
                    startIcon={<OpenInNewIcon />}
                    variant="outlined"
                  >
                    Resume
                  </Button>
                ) : selectedResumeStatus ? (
                  <Chip label={`Resume: ${selectedResumeStatus}`} size="small" sx={{ justifySelf: 'start', bgcolor: '#F8FAFC', color: '#475569', fontWeight: 900 }} />
                ) : null}
                {selectedMeetingUrl ? (
                  <Button component="a" href={selectedMeetingUrl} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />} variant="contained">
                    Join call
                  </Button>
                ) : null}
              </Box>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between' }}>
              <Box>
                {canDeleteSelectedInterview ? (
                  <Button color="error" startIcon={<DeleteIcon />} disabled={deletingInterview || updatingBid} onClick={() => handleDeleteInterview(selectedJob)}>
                    Delete
                  </Button>
                ) : null}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={closeInterviewDialog}>Close</Button>
                <Button
                  disabled={updatingBid || !canEditInterviews}
                  onClick={() => saveInterview(selectedJob)}
                  variant="contained"
                >
                  Save
                </Button>
              </Box>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
      <Dialog open={Boolean(pendingStepChangeSave)} onClose={closePendingStepChangeDialog} fullWidth maxWidth="xs">
        <DialogTitle>Confirm step change</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1, pt: 2 }}>
          <Typography variant="body2">
            Move this interview from {pendingStepChangeSave?.fromLabel || 'the current step'} to {pendingStepChangeSave?.toLabel || 'the next step'}?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pendingStepChangeSave?.bidData?.interviewNextAt
              ? 'A calendar call will be registered for the new step using the next interview time.'
              : 'No calendar call will be registered for this move because no next interview time is set.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePendingStepChangeDialog}>Keep editing</Button>
          <Button disabled={updatingBid} onClick={confirmPendingStepChange} variant="contained">
            Confirm move
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function externalJobUrl(job) {
  const url = job?.rawJob?.originalUrl || job?.url || '';
  return externalUrl(url);
}

function externalUrl(url) {
  return /^https?:\/\//i.test(String(url)) ? url : '';
}

function resumeDownloadUrl(resume) {
  if (resume?.status !== 'ready' || !resume?.filePath || !resume?.id) return '';
  return `/api/bid/tailored-resumes/${encodeURIComponent(resume.id)}/download`;
}

function resumeFileName(filePath) {
  return filePath ? String(filePath).split('/').pop() || 'tailored-resume.docx' : 'tailored-resume.docx';
}

function hasMeetingLink(job, draft) {
  const stage = canonicalInterviewStage(draft?.interviewStage || job?.bid?.interviewStage);
  const stageLinks = draft?.stageMeetingLinks || job?.bid?.stageMeetingLinks || {};
  return Boolean(String(stageLinks[stage] || draft?.meetingLink || job?.bid?.meetingLink || '').trim());
}

function interviewStepChange(job, bidData) {
  const fromStage = canonicalInterviewStage(job?.bid?.interviewStage || 'todo');
  const toStage = canonicalInterviewStage(bidData?.interviewStage || fromStage);
  if (fromStage === toStage) return null;
  return {
    fromStage,
    toStage,
    fromLabel: stageLabel(fromStage),
    toLabel: stageLabel(toStage),
  };
}

function applicationOptionLabel(option) {
  if (!option || typeof option === 'string') return option || '';
  return [option.title || 'Untitled role', option.company].filter(Boolean).join(' · ');
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function stageLabel(value) {
  return INTERVIEW_STAGES.find((stage) => stage.value === value)?.label || 'Stage';
}

function interviewColumnLabel(value) {
  return INTERVIEW_KANBAN_COLUMNS.find((column) => column.value === value)?.label || stageLabel(value);
}

function formatJourneyLog(log) {
  const stage = log.metadata?.stage ? stageLabel(log.metadata.stage) : '';
  const scheduledAt = log.metadata?.scheduledAt ? formatDateTimeInDefaultTimezone(log.metadata.scheduledAt) : '';
  return {
    created: 'Created',
    first_scheduled: 'First interview scheduled',
    interview_occurrence: `${stage || 'Interview'} kept as completed${scheduledAt ? ` (${scheduledAt})` : ''}`,
    schedule_changed: 'Schedule changed',
    stage_changed: `Moved ${stageLabel(log.fromValue)} -> ${stageLabel(log.toValue)}`,
    stage_note_changed: `${stage || 'Stage'} note updated`,
    stage_meeting_link_changed: `${stage || 'Stage'} meeting link updated`,
  }[log.eventType] || log.eventType;
}
