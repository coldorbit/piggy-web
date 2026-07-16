import { InterviewRegistrationDialogs } from './InterviewRegistrationDialogs.jsx';
import { callAssigneeLabel, callForStage, callSourceLabel, externalJobUrl, externalUrl, formatDuration, formatJourneyLog, hasMeetingLink, interviewColumnLabel, interviewStepChange, resumeDownloadUrl, resumeFileName, sortedInterviewCalls, stageLabel } from './InterviewPageUtils.js';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
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
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import BidProfileTabs from '../components/bids/BidProfileTabs.jsx';
import { APPLICATION_WORKFLOW_STATUSES, BID_TABS, DONE_STATUSES, INTERVIEW_KANBAN_COLUMNS, INTERVIEW_STAGES } from '../components/bids/bidConstants.js';
import { filterRowsByWorkspace, workspaceLabel } from '../components/admin/SuperadminWorkspaceLens.jsx';
import { useWorkspaceFilter } from '../components/admin/WorkspaceFilterContext.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import InterviewKanbanBoard from '../components/interviews/InterviewKanbanBoard.jsx';
import InterviewLoadingState from '../components/interviews/InterviewLoadingState.jsx';
import { InterviewFailureFeedbackDialog, InterviewFailureFeedbackFields, isFailedInterviewStatus } from '../components/interviews/InterviewFailureFeedback.jsx';
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
import { canAccessProfileHub, canRegisterManualInterviewCalls, canUseWorkspaceLens, isAdminRole } from '../lib/roles.js';
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
  const [pendingFailureSave, setPendingFailureSave] = useState(null);
  const [isJourneyExpanded, setIsJourneyExpanded] = useState(false);
  const [error, setError] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { activeWorkspaceId, workspaceError, workspaces } = useWorkspaceFilter();
  const workspaceLensEnabled = canUseWorkspaceLens(currentUser);
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
      workspaceName: workspaceLensEnabled ? workspaceLabel(workspaces, profile.workspaceId) : '',
    })),
    [interviewProfiles, workspaceLensEnabled, workspaces],
  );
  const workspaceInterviewProfiles = useMemo(
    () => (workspaceLensEnabled ? filterRowsByWorkspace(interviewProfilesWithWorkspace, activeWorkspaceId) : interviewProfilesWithWorkspace),
    [activeWorkspaceId, interviewProfilesWithWorkspace, workspaceLensEnabled],
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
    if (isFailedInterviewStatus(bidData.status) && !bidData.failureFeedback) {
      setPendingFailureSave({ job, bidData });
      return;
    }
    const stepChange = interviewStepChange(job, bidData);
    if (stepChange && !options.confirmStepChange) {
      setPendingStepChangeSave({ job, bidData, ...stepChange });
      return;
    }
    submitInterviewSave(job, bidData);
  }

  function confirmFailureFeedback(feedback) {
    if (!pendingFailureSave) return;
    submitInterviewSave(pendingFailureSave.job, { ...pendingFailureSave.bidData, ...feedback });
    setPendingFailureSave(null);
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
                <Typography fontWeight={600} noWrap>
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

      <InterviewRegistrationDialogs
        activeColor={activeColor}
        activeProfile={activeProfile}
        applicationOptions={applicationOptions}
        applicationPickerLoading={applicationPickerLoading}
        applicationSearch={applicationSearch}
        callerUsers={callerUsers}
        canRegisterCalls={canRegisterCalls}
        closeManualCallDialog={closeManualCallDialog}
        closeManualDialog={closeManualDialog}
        closePendingStepChangeDialog={closePendingStepChangeDialog}
        confirmPendingStepChange={confirmPendingStepChange}
        creatingInterviewCall={creatingInterviewCall}
        creatingManualInterview={creatingManualInterview}
        isManualCallDialogOpen={isManualCallDialogOpen}
        isManualDialogOpen={isManualDialogOpen}
        manualCall={manualCall}
        manualInterview={manualInterview}
        pendingStepChangeSave={pendingStepChangeSave}
        selectedApplicationJob={selectedApplicationJob}
        selectedJob={selectedJob}
        setApplicationSearch={setApplicationSearch}
        setManualCall={setManualCall}
        setManualInterview={setManualInterview}
        setSelectedApplicationJob={setSelectedApplicationJob}
        submitManualCall={submitManualCall}
        submitManualInterview={submitManualInterview}
        updateManualCallStage={updateManualCallStage}
        updatingBid={updatingBid}
        updatingInterviewCall={updatingInterviewCall}
      />

      <InterviewFailureFeedbackDialog
        interviewLabel={[pendingFailureSave?.job?.title, pendingFailureSave?.job?.company].filter(Boolean).join(' at ')}
        isSaving={updatingBid}
        onClose={() => setPendingFailureSave(null)}
        onConfirm={confirmFailureFeedback}
        open={Boolean(pendingFailureSave)}
      />

      <Dialog open={Boolean(selectedJob)} onClose={closeInterviewDialog} fullWidth maxWidth="md">
        {selectedJob && selectedDraft ? (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography fontWeight={600} noWrap>
                    {selectedJob.title || 'Untitled role'}
                  </Typography>
                  <Chip label={interviewColumnLabel(selectedColumn)} size="small" sx={{ bgcolor: activeColor.soft, color: activeColor.dark, fontWeight: 600 }} />
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
                <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 1, bgcolor: 'rgba(246, 248, 251, 0.86)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Calls
                    </Typography>
                    <Chip
                      label={`${selectedCalls.length} ${selectedCalls.length === 1 ? 'call' : 'calls'}`}
                      size="small"
                      sx={{ bgcolor: activeColor.soft, color: activeColor.dark, fontWeight: 600 }}
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
                                <Typography variant="body2" fontWeight={600} noWrap>
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
                                sx={{ bgcolor: '#edf0ff', color: '#343f91', fontWeight: 600, maxWidth: '100%' }}
                              />
                              {call.sourceType ? (
                                <Chip
                                  label={callSourceLabel(call.sourceType)}
                                  size="small"
                                  sx={{ bgcolor: '#ECFDF5', color: '#486860', fontWeight: 600, maxWidth: '100%' }}
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
                                  sx={{ minHeight: 24, px: 1, py: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}
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
                  <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: isJourneyExpanded ? 0.75 : 0, bgcolor: 'rgba(246, 248, 251, 0.86)' }}>
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
                        fontWeight: 600,
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
                      if (nextStatus !== selectedDraft.status) {
                        updateDraft(selectedJob, 'failureFeedback', '');
                        updateDraft(selectedJob, 'failureFeedbackNotes', '');
                      }
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
                {isFailedInterviewStatus(selectedDraft.status) ? (
                  <InterviewFailureFeedbackFields
                    disabled={updatingBid || !canEditInterviews}
                    notes={selectedDraft.failureFeedbackNotes || ''}
                    onNotesChange={(value) => updateDraft(selectedJob, 'failureFeedbackNotes', value)}
                    onReasonChange={(value) => updateDraft(selectedJob, 'failureFeedback', value)}
                    reason={selectedDraft.failureFeedback || ''}
                    showError
                  />
                ) : null}
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
                {activeProfile?.id && canAccessProfileHub(currentUser) ? (
                  <Button
                    component={RouterLink}
                    to={`/profiles/${encodeURIComponent(activeProfile.id)}?tab=interview-prep&interviewId=${encodeURIComponent(selectedJob.bid?.parentInterviewId || selectedJob.bid?.id || '')}`}
                    startIcon={<SchoolOutlinedIcon />}
                    variant="outlined"
                  >
                    Profile prep
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
                  <Chip label={`Resume: ${selectedResumeStatus}`} size="small" sx={{ justifySelf: 'start', bgcolor: 'rgba(246, 248, 251, 0.86)', color: '#475569', fontWeight: 600 }} />
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
                  disabled={updatingBid || !canEditInterviews || (isFailedInterviewStatus(selectedDraft.status) && !selectedDraft.failureFeedback)}
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
    </Box>
  );
}
