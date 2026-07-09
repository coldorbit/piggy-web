import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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
import { APPLICATION_WORKFLOW_STATUSES, BID_TABS, DONE_STATUSES, INTERVIEW_KANBAN_COLUMNS, INTERVIEW_STAGES } from '../components/bids/bidConstants.js';
import { filterRowsByWorkspace, workspaceLabel } from '../components/admin/SuperadminWorkspaceLens.jsx';
import { useWorkspaceFilter } from '../components/admin/WorkspaceFilterContext.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
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
import {
  downloadAuthenticatedFile,
  useBidJobs,
  useBidProfiles,
  useCreateInterviewCall,
  useCreateManualInterview,
  useDeleteInterview,
  useUpdateInterviewCall,
  useUpdateJobBid,
} from '../lib/api.js';
import { formatDateTimeInDefaultTimezone } from '../lib/formatters.js';
import { canRegisterManualInterviewCalls, isAdminRole, isSuperadmin } from '../lib/roles.js';
import { DEFAULT_TIME_ZONE_LABEL, fromDefaultTimezoneDatetimeLocal } from '../lib/timezone.js';

const EMPTY_MANUAL_INTERVIEW = {
  title: '',
  company: '',
  location: '',
  jobUrl: '',
  interviewStage: 'screening',
  interviewNextAt: '',
  interviewDurationMinutes: DEFAULT_INTERVIEW_DURATION_MINUTES,
  interviewMeetingLink: '',
  stageMeetingLinks: {},
  callerUserId: '',
  interviewNotes: '',
};

const EMPTY_MANUAL_CALL = {
  id: '',
  interviewStage: 'screening',
  scheduledAt: '',
  durationMinutes: DEFAULT_INTERVIEW_DURATION_MINUTES,
  callerUserId: '',
  meetingLink: '',
  notes: '',
};

export default function InterviewsPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [needsLinksOnly, setNeedsLinksOnly] = useState(() => searchParams.get('needsLinks') === '1');
  const [drafts, setDrafts] = useState({});
  const [activeDropStage, setActiveDropStage] = useState('');
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isManualCallDialogOpen, setIsManualCallDialogOpen] = useState(false);
  const [selectedInterviewId, setSelectedInterviewId] = useState('');
  const [selectedApplicationJob, setSelectedApplicationJob] = useState(null);
  const [applicationSearch, setApplicationSearch] = useState('');
  const [manualInterview, setManualInterview] = useState(EMPTY_MANUAL_INTERVIEW);
  const [manualCall, setManualCall] = useState(EMPTY_MANUAL_CALL);
  const [pendingStepChangeSave, setPendingStepChangeSave] = useState(null);
  const [isJourneyExpanded, setIsJourneyExpanded] = useState(false);
  const [error, setError] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { activeWorkspaceId, workspaceError, workspaces } = useWorkspaceFilter();
  const superadminView = isSuperadmin(currentUser);
  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useBidProfiles(
    isAdminRole(currentUser) ? { scope: 'manage' } : {},
  );
  const interviewProfiles = useMemo(
    () => profiles.filter((profile) => ['active', 'legacy'].includes(profile.profileStatus || 'active')),
    [profiles],
  );
  const interviewProfilesWithWorkspace = useMemo(
    () => interviewProfiles.map((profile) => ({
      ...profile,
      workspaceName: superadminView ? workspaceLabel(workspaces, profile.workspaceId) : '',
    })),
    [interviewProfiles, superadminView, workspaces],
  );
  const workspaceInterviewProfiles = useMemo(
    () => (superadminView ? filterRowsByWorkspace(interviewProfilesWithWorkspace, activeWorkspaceId) : interviewProfilesWithWorkspace),
    [activeWorkspaceId, interviewProfilesWithWorkspace, superadminView],
  );
  const activeProfile = useMemo(
    () => workspaceInterviewProfiles.find((profile) => String(profile.id) === String(activeProfileId)) || workspaceInterviewProfiles[0] || null,
    [activeProfileId, workspaceInterviewProfiles],
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
  const { mutate: createInterviewCall, isPending: creatingInterviewCall } = useCreateInterviewCall();
  const { mutate: updateInterviewCall, isPending: updatingInterviewCall } = useUpdateInterviewCall();
  const { mutate: deleteInterview, isPending: deletingInterview } = useDeleteInterview();

  useEffect(() => {
    if (!workspaceInterviewProfiles[0]) return;
    const hasActiveProfile = workspaceInterviewProfiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!activeProfileId || !hasActiveProfile) setActiveProfileId(workspaceInterviewProfiles[0].id);
  }, [activeProfileId, workspaceInterviewProfiles]);

  useEffect(() => {
    setSelectedInterviewId('');
    setError('');
  }, [activeWorkspaceId]);

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

  function openManualCallDialog(job, call = null) {
    if (!job?.bid?.id) return;
    const draft = draftFor(job);
    const draftStage = canonicalInterviewStage(draft.interviewStage);
    const stage = call?.interviewStage || (draftStage === 'todo' ? 'screening' : draftStage);
    const existingCall = callForStage(job, stage);
    const stageNotes = draft.stageNotes || {};
    const stageMeetingLinks = draft.stageMeetingLinks || {};
    const callDraft = call || existingCall;
    setError('');
    setManualCall({
      id: callDraft?.id || '',
      interviewStage: stage,
      scheduledAt: toDatetimeLocalValue(callDraft?.scheduledAt || draft.interviewNextAt),
      durationMinutes: callDraft?.durationMinutes || draft.interviewDurationMinutes || DEFAULT_INTERVIEW_DURATION_MINUTES,
      callerUserId: callDraft?.callerUserId || draft.callerUserId || '',
      meetingLink: callDraft?.meetingLink || stageMeetingLinks[stage] || draft.meetingLink || '',
      notes: callDraft?.notes || stageNotes[stage] || draft.interviewNotes || '',
    });
    setIsManualCallDialogOpen(true);
  }

  function updateManualCallStage(stage) {
    const normalizedStage = canonicalInterviewStage(stage);
    const existingCall = callForStage(selectedJob, normalizedStage);
    const draft = selectedJob ? draftFor(selectedJob) : {};
    const stageNotes = draft.stageNotes || {};
    const stageMeetingLinks = draft.stageMeetingLinks || {};
    setManualCall((current) => ({
      ...current,
      id: existingCall?.id || '',
      interviewStage: normalizedStage,
      scheduledAt: toDatetimeLocalValue(existingCall?.scheduledAt || current.scheduledAt),
      durationMinutes: existingCall?.durationMinutes || current.durationMinutes || DEFAULT_INTERVIEW_DURATION_MINUTES,
      callerUserId: existingCall?.callerUserId || current.callerUserId || '',
      meetingLink: existingCall?.meetingLink || stageMeetingLinks[normalizedStage] || '',
      notes: existingCall?.notes || stageNotes[normalizedStage] || '',
    }));
  }

  function closeManualCallDialog() {
    setIsManualCallDialogOpen(false);
    setManualCall(EMPTY_MANUAL_CALL);
  }

  function openInterviewDialog(job) {
    if (!job?.bid?.id) return;
    setIsJourneyExpanded(false);
    setSelectedInterviewId(String(job.bid.id));
  }

  function closeInterviewDialog() {
    setIsJourneyExpanded(false);
    setSelectedInterviewId('');
    closeManualCallDialog();
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

  function submitManualCall(event) {
    event.preventDefault();
    if (!selectedJob?.bid?.parentInterviewId) return;
    setError('');
    const existingCall = manualCall.id ? selectedDraft?.calls?.find((call) => String(call.id) === String(manualCall.id)) : callForStage(selectedJob, manualCall.interviewStage);
    const defaultCallerUserId = String(existingCall?.callerUserId ?? selectedDraft?.callerUserId ?? '');
    const callData = {
      interviewStage: manualCall.interviewStage,
      scheduledAt: fromDefaultTimezoneDatetimeLocal(manualCall.scheduledAt),
      durationMinutes: manualCall.durationMinutes,
      meetingLink: manualCall.meetingLink,
      notes: manualCall.notes,
      ...(String(manualCall.callerUserId || '') !== defaultCallerUserId ? { callerUserId: manualCall.callerUserId } : {}),
    };
    const existingCallId = manualCall.id || callForStage(selectedJob, manualCall.interviewStage)?.id || '';
    const mutationOptions = {
      onSuccess: closeManualCallDialog,
      onError: (callError) => setError(callError.message),
    };

    if (existingCallId) {
      updateInterviewCall({ interviewCallId: existingCallId, callData }, mutationOptions);
      return;
    }

    createInterviewCall({ interviewId: selectedJob.bid.parentInterviewId, callData }, mutationOptions);
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
  const selectedCalls = sortedInterviewCalls(selectedDraft?.calls);
  const selectedHasCall = selectedCalls.length > 0;
  const callerUsers = interviewsData?.callerUsers || [];
  const applicationOptions = useMemo(
    () => (applicationPickerData?.jobs || []).filter((job) => job?.bid?.id && DONE_STATUSES.has(job.bid.status)),
    [applicationPickerData?.jobs],
  );
  const jobsByStage = groupJobsByStage(jobs, draftFor);
  const effectiveCurrentUser = interviewsData?.currentUser || currentUser;
  const isActiveProfileOwner = String(activeProfile?.userId || '') === String(effectiveCurrentUser?.id || currentUser?.id || '');
  const activeInterviewCount = Number(activeProfile?.progress?.activeInterviews || 0);
  const totalInterviewCount = Number(activeProfile?.progress?.totalInterviews || interviewsData?.total || 0);
  const canRegisterCalls = canRegisterManualInterviewCalls(currentUser);
  const canEditInterviews = currentUser?.role !== 'caller' && (isAdminRole(currentUser) || isActiveProfileOwner);
  const canDeleteSelectedInterview =
    selectedJob &&
    canEditInterviews &&
    (isAdminRole(currentUser) || String(selectedJob.bid?.profileId || '') === String(activeProfile?.id || ''));
  const loading = profilesLoading || interviewsLoading;
  const pageError = error || profilesError?.message || interviewsError?.message || workspaceError?.message || '';

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}
      {!workspaceInterviewProfiles.length && !profilesLoading ? (
        <EmptyState
          title="No interview profiles available"
          detail="Interview work appears after an active or legacy profile has applications in the interview pipeline."
        />
      ) : null}

      {profilesLoading || workspaceInterviewProfiles.length ? (
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
            profiles={workspaceInterviewProfiles}
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

            <Box sx={{ flex: 1, minHeight: { md: 0 }, minWidth: 0, overflow: 'hidden', bgcolor: 'background.paper' }}>
              {loading && !jobs.length ? <InterviewLoadingState /> : null}
              {!loading || jobs.length ? (
                <InterviewKanbanBoard
                  activeColor={activeColor}
                  activeDropStage={activeDropStage}
                  callerUsers={callerUsers}
                  currentUser={effectiveCurrentUser}
                  canAssignCallers={canRegisterCalls}
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
              noOptionsText={applicationSearch ? 'No done applications found' : 'No done applications'}
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
                    {[option.company, option.location, statusLabel(option.bid?.status)].filter(Boolean).join(' · ') || 'Done application'}
                  </Typography>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Application"
                  placeholder="Search done applications"
                  helperText="Done-tab applications for this profile"
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
                      {[selectedApplicationJob.company, selectedApplicationJob.location, statusLabel(selectedApplicationJob.bid?.status)].filter(Boolean).join(' · ') || 'Done application'}
                    </Typography>
                  </Box>
                  <Chip label="From application" sx={{ bgcolor: activeColor.soft, color: activeColor.dark, fontWeight: 900 }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {[statusLabel(selectedApplicationJob.bid?.status), selectedApplicationJob.bid?.bidAt ? `Applied ${formatShortDate(selectedApplicationJob.bid.bidAt)}` : 'Done application'].filter(Boolean).join(' · ')}
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
                required
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
                  {INTERVIEW_STAGES.filter((stage) => stage.value !== 'todo').map((stage) => (
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
            {canRegisterCalls ? (
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
            <Button type="submit" variant="contained" disabled={creatingManualInterview || updatingBid || !manualInterview.interviewNextAt}>
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
                {!selectedHasCall ? (
                  <Alert severity="warning">
                    Create at least one call for this interview.
                  </Alert>
                ) : null}
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
                <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 1, bgcolor: '#F8FAFC' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" fontWeight={900}>
                      Calls
                    </Typography>
                    <Chip
                      label={`${selectedCalls.length} ${selectedCalls.length === 1 ? 'call' : 'calls'}`}
                      size="small"
                      sx={{ bgcolor: activeColor.soft, color: activeColor.dark, fontWeight: 900 }}
                    />
                  </Box>
                  {selectedCalls.length ? (
                    <Box component="ul" sx={{ display: 'grid', gap: 0.75, listStyle: 'none', m: 0, p: 0 }}>
                      {selectedCalls.map((call) => {
                        const meetingUrl = externalUrl(call.meetingLink);
                        return (
                          <Box
                            component="li"
                            key={call.id}
                            sx={{
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              bgcolor: 'background.paper',
                              display: 'grid',
                              gap: 0.75,
                              minWidth: 0,
                              p: 1,
                            }}
                          >
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) max-content', gap: 1, alignItems: 'start' }}>
                              <Box minWidth={0}>
                                <Typography variant="body2" fontWeight={900} noWrap>
                                  {stageLabel(call.interviewStage)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {formatDateTimeInDefaultTimezone(call.scheduledAt)}
                                  {call.durationMinutes ? ` · ${formatDuration(call.durationMinutes)}` : ''}
                                </Typography>
                              </Box>
                              {canRegisterCalls ? (
                                <Button size="small" onClick={() => openManualCallDialog(selectedJob, call)}>
                                  Edit
                                </Button>
                              ) : null}
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, minWidth: 0 }}>
                              <Chip
                                label={callAssigneeLabel(call, callerUsers, selectedDraft, effectiveCurrentUser)}
                                size="small"
                                sx={{ bgcolor: '#edf0ff', color: '#343f91', fontWeight: 800, maxWidth: '100%' }}
                              />
                              {call.sourceType ? (
                                <Chip
                                  label={callSourceLabel(call.sourceType)}
                                  size="small"
                                  sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 800, maxWidth: '100%' }}
                                />
                              ) : null}
                              {meetingUrl ? (
                                <Button
                                  component="a"
                                  href={meetingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  size="small"
                                  startIcon={<OpenInNewIcon fontSize="small" />}
                                  variant="outlined"
                                  sx={{ minHeight: 24, px: 1, py: 0, fontSize: 12, fontWeight: 900, lineHeight: 1.4 }}
                                >
                                  Link
                                </Button>
                              ) : null}
                            </Box>
                            {call.notes ? (
                              <Typography variant="body2" color="text.secondary">
                                {call.notes}
                              </Typography>
                            ) : null}
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No calls registered.
                    </Typography>
                  )}
                </Paper>
                {selectedDraft.logs?.length ? (
                  <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: isJourneyExpanded ? 0.75 : 0, bgcolor: '#F8FAFC' }}>
                    <Button
                      aria-expanded={isJourneyExpanded}
                      endIcon={
                        <ExpandMoreIcon
                          fontSize="small"
                          sx={{ transform: isJourneyExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }}
                        />
                      }
                      onClick={() => setIsJourneyExpanded((expanded) => !expanded)}
                      sx={{
                        alignItems: 'center',
                        color: 'text.primary',
                        fontWeight: 900,
                        justifyContent: 'space-between',
                        minHeight: 32,
                        p: 0,
                        textTransform: 'none',
                      }}
                    >
                      Journey
                    </Button>
                    <Collapse in={isJourneyExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ display: 'grid', gap: 0.75, pt: 0.75 }}>
                        {selectedDraft.logs.map((log) => (
                          <Box key={log.id} sx={{ display: 'grid', gap: 0.2, minWidth: 0 }}>
                            <Typography variant="body2">{formatJourneyLog(log)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Collapse>
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
                {canRegisterCalls ? (
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
                {canRegisterCalls ? (
                  <Button
                    disabled={creatingInterviewCall}
                    onClick={() => openManualCallDialog(selectedJob)}
                    startIcon={<AddIcon />}
                  >
                    Register call
                  </Button>
                ) : null}
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
      <Dialog open={isManualCallDialogOpen} onClose={closeManualCallDialog} fullWidth maxWidth="sm">
        <form onSubmit={submitManualCall}>
          <DialogTitle>Register call</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
            {selectedJob ? (
              <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 0.35, bgcolor: '#F8FAFC' }}>
                <Typography fontWeight={900} noWrap>
                  {selectedJob.title || 'Untitled role'}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {[selectedJob.company, activeProfile?.name].filter(Boolean).join(' · ') || 'Interview'}
                </Typography>
              </Paper>
            ) : null}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                autoFocus
                label={`Call time (${DEFAULT_TIME_ZONE_LABEL})`}
                required
                type="datetime-local"
                value={toDatetimeLocalValue(manualCall.scheduledAt)}
                onChange={(event) => setManualCall((current) => ({ ...current, scheduledAt: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormControl>
                <InputLabel>Step</InputLabel>
                <Select
                  label="Step"
                  value={manualCall.interviewStage}
                  onChange={(event) => updateManualCallStage(event.target.value)}
                >
                  {INTERVIEW_STAGES.filter((stage) => stage.value !== 'todo').map((stage) => (
                    <MenuItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: callerUsers.length ? '1fr 1fr' : '1fr' }, gap: 1.5 }}>
              <FormControl>
                <InputLabel>Duration</InputLabel>
                <Select
                  label="Duration"
                  value={manualCall.durationMinutes}
                  onChange={(event) => setManualCall((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
                >
                  {INTERVIEW_DURATION_OPTIONS.map((duration) => (
                    <MenuItem key={duration.value} value={duration.value}>
                      {duration.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {callerUsers.length ? (
                <FormControl>
                  <InputLabel>Assignee</InputLabel>
                  <Select
                    label="Assignee"
                    value={manualCall.callerUserId}
                    onChange={(event) => setManualCall((current) => ({ ...current, callerUserId: event.target.value }))}
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
            </Box>
            <TextField
              label={`${stageLabel(manualCall.interviewStage)} meeting link`}
              type="url"
              value={manualCall.meetingLink}
              onChange={(event) => setManualCall((current) => ({ ...current, meetingLink: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Call notes"
              multiline
              minRows={3}
              value={manualCall.notes}
              onChange={(event) => setManualCall((current) => ({ ...current, notes: event.target.value }))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeManualCallDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={creatingInterviewCall || updatingInterviewCall || !manualCall.scheduledAt}>
              {manualCall.id ? 'Update call' : 'Register call'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Dialog open={Boolean(pendingStepChangeSave)} onClose={closePendingStepChangeDialog} fullWidth maxWidth="xs">
        <DialogTitle>Confirm step change</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1, pt: 2 }}>
          <Typography variant="body2">
            Move this interview from {pendingStepChangeSave?.fromLabel || 'the current step'} to {pendingStepChangeSave?.toLabel || 'the next step'}?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pendingStepChangeSave?.willRegisterCall && pendingStepChangeSave?.bidData?.interviewNextAt
              ? 'A calendar call will be registered for the new step using the next interview time.'
              : pendingStepChangeSave?.willRegisterCall
                ? 'No calendar call will be registered for this move because no next interview time is set.'
                : 'No calendar call will be registered for this move.'}
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

function callForStage(job, stage) {
  const calls = Array.isArray(job?.bid?.calls) ? job.bid.calls : [];
  return calls.find((call) => String(call.interviewStage || '') === String(stage || '')) || null;
}

function sortedInterviewCalls(calls) {
  if (!Array.isArray(calls)) return [];
  return [...calls].sort((left, right) => {
    const leftTime = sortableTime(left.scheduledAt);
    const rightTime = sortableTime(right.scheduledAt);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return Number(left.id || 0) - Number(right.id || 0);
  });
}

function sortableTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
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
    willRegisterCall: shouldRegisterCallForStepChange(fromStage, toStage, bidData?.status),
  };
}

function shouldRegisterCallForStepChange(fromStage, toStage, nextStatus = 'interviewing') {
  if (['failed', 'lost'].includes(String(nextStatus || '').trim())) return false;
  if (fromStage === 'todo' && toStage === 'screening') return false;
  return fromStage !== toStage;
}

function applicationOptionLabel(option) {
  if (!option || typeof option === 'string') return option || '';
  return [option.title || 'Untitled role', option.company].filter(Boolean).join(' · ');
}

function statusLabel(status) {
  if (status === 'won') return 'Won';
  if (status === 'lost') return 'Lost';
  const workflowStatus = APPLICATION_WORKFLOW_STATUSES.find((option) => option.value === status);
  if (workflowStatus) return workflowStatus.label;
  return '';
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDuration(minutes) {
  const value = Number(minutes || 0);
  if (!value) return '';
  if (value < 60) return `${value} min`;
  const hours = value / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

function callAssigneeLabel(call, callerUsers, selectedDraft, currentUser) {
  const callerUserId = String(call?.callerUserId || '');
  if (!callerUserId) return 'Unassigned';
  const caller = callerUsers.find((user) => String(user.id) === callerUserId);
  if (caller?.username) return caller.username;
  if (String(selectedDraft?.callerUser?.id || '') === callerUserId && selectedDraft?.callerUser?.username) return selectedDraft.callerUser.username;
  if (String(currentUser?.id || '') === callerUserId && currentUser?.username) return currentUser.username;
  return `Caller #${callerUserId}`;
}

function callSourceLabel(sourceType) {
  return {
    created: 'Created',
    current_schedule: 'Current schedule',
    manual: 'Manual',
    schedule_update: 'Schedule update',
  }[sourceType] || sourceType;
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
