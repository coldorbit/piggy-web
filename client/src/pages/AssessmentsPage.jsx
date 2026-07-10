import AddLinkIcon from '@mui/icons-material/AddLink';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  useAssessmentProfiles,
  useAssessments,
  useCreateAssessment,
  useDeleteAssessment,
  useMarkAssessmentDone,
  useJobs,
} from '../lib/api.js';
import { formatDateTime } from '../lib/formatters.js';
import { isAdminRole } from '../lib/roles.js';

const ASSESSMENT_CATEGORY_OPTIONS = [
  { value: 'coding', label: 'Coding' },
  { value: 'technical', label: 'Technical' },
  { value: 'take_home', label: 'Take-home' },
  { value: 'aptitude', label: 'Aptitude' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'language', label: 'Language' },
  { value: 'personality', label: 'Personality' },
  { value: 'other', label: 'Other' },
];

const EMPTY_ASSESSMENT_FORM = {
  assessmentLink: '',
  category: 'coding',
  expiresAt: '',
};
const ALL_ASSESSMENTS = 'all';

export default function AssessmentsPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || ALL_ASSESSMENTS);
  const [form, setForm] = useState(EMPTY_ASSESSMENT_FORM);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobSearch, setJobSearch] = useState('');
  const [pageError, setPageError] = useState('');

  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useAssessmentProfiles();
  const activeProfile = useMemo(
    () => profiles.find((profile) => String(profile.id) === String(activeProfileId)) || null,
    [activeProfileId, profiles],
  );
  const {
    data: assessmentsData,
    isLoading: assessmentsLoading,
    isFetching: assessmentsFetching,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useAssessments(activeProfile?.id || ALL_ASSESSMENTS);

  const jobFilters = useMemo(
    () => ({
      search: jobSearch.trim(),
      limit: 8,
      since: 'all',
      visibility: 'visible',
      sort: 'scraped_desc',
    }),
    [jobSearch],
  );
  const { data: jobsData, isFetching: jobsFetching } = useJobs(jobFilters);
  const createAssessment = useCreateAssessment();
  const deleteAssessment = useDeleteAssessment();
  const markAssessmentDone = useMarkAssessmentDone();
  const assessments = assessmentsData?.assessments || [];
  const stats = assessmentStats(assessments);
  const errorMessage =
    pageError ||
    profilesError?.message ||
    assessmentsError?.message ||
    createAssessment.error?.message ||
    deleteAssessment.error?.message ||
    markAssessmentDone.error?.message ||
    '';
  const canRegister = Boolean(activeProfile?.id && form.assessmentLink.trim() && form.category && !createAssessment.isPending);

  useEffect(() => {
    if (profilesLoading || activeProfileId === ALL_ASSESSMENTS) return;
    const hasProfile = profiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!hasProfile) setActiveProfileId(ALL_ASSESSMENTS);
  }, [activeProfileId, profiles, profilesLoading]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (activeProfileId && activeProfileId !== ALL_ASSESSMENTS) nextParams.set('profileId', activeProfileId);
    if (nextParams.toString() !== searchParams.toString()) setSearchParams(nextParams, { replace: true });
  }, [activeProfileId, searchParams, setSearchParams]);

  function updateForm(updates) {
    setForm((current) => ({ ...current, ...updates }));
    if (pageError) setPageError('');
  }

  function submitAssessment(event) {
    event.preventDefault();
    if (!activeProfile || !canRegister) return;
    setPageError('');
    createAssessment.mutate(
      {
        profileId: activeProfile.id,
        category: form.category,
        assessmentLink: form.assessmentLink,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        jobId: selectedJob ? jobOptionId(selectedJob) : null,
      },
      {
        onSuccess: () => {
          setForm((current) => ({ ...EMPTY_ASSESSMENT_FORM, category: current.category }));
          setSelectedJob(null);
          setJobSearch('');
        },
        onError: (error) => setPageError(error.message),
      },
    );
  }

  function removeAssessment(assessment) {
    if (!window.confirm('Delete this assessment?')) return;
    setPageError('');
    deleteAssessment.mutate(
      { assessmentId: assessment.id },
      { onError: (error) => setPageError(error.message) },
    );
  }

  function completeAssessment(assessment) {
    if (!assessment?.id) return;
    setPageError('');
    markAssessmentDone.mutate(
      { assessmentId: assessment.id },
      { onError: (error) => setPageError(error.message) },
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start', minHeight: 0 }}>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      {!profiles.length && !profilesLoading ? (
        <EmptyState
          title="No active profiles available"
          detail="Assessments can be registered once an active profile is available."
        />
      ) : null}

      {profilesLoading || profiles.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
            gap: 1.5,
            height: { xs: 'auto', md: 'calc(100vh - 108px)', xl: 'calc(100vh - 124px)' },
            minHeight: { md: 0 },
            minWidth: 0,
          }}
        >
          <AssessmentProfileFilter
            activeProfile={activeProfile}
            value={activeProfileId}
            isLoading={profilesLoading}
            profiles={profiles}
            showOwner={isAdminRole(currentUser)}
            onProfileChange={setActiveProfileId}
          />

          <AssessmentForm
            activeProfile={activeProfile}
            form={form}
            isSaving={createAssessment.isPending}
            jobOptions={jobsData?.jobs || []}
            jobSearch={jobSearch}
            jobsFetching={jobsFetching}
            selectedJob={selectedJob}
            canRegister={canRegister}
            onFormChange={updateForm}
            onJobChange={setSelectedJob}
            onJobSearchChange={setJobSearch}
            onSubmit={submitAssessment}
          />
          <AssessmentStats
            isFetching={assessmentsFetching}
            stats={stats}
            onRefresh={refetchAssessments}
          />
          <AssessmentList
            activeProfile={activeProfile}
            assessments={assessments}
            currentUser={currentUser}
            isDeleting={deleteAssessment.isPending}
            isMarkingDone={markAssessmentDone.isPending}
            isLoading={assessmentsLoading && !assessmentsData}
            onDelete={removeAssessment}
            onMarkDone={completeAssessment}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function AssessmentProfileFilter({ activeProfile, isLoading, onProfileChange, profiles, showOwner, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        boxShadow: 1,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
        <TextField
          select
          label="Profile"
          size="small"
          value={isLoading ? ALL_ASSESSMENTS : value}
          disabled={isLoading}
          onChange={(event) => onProfileChange(event.target.value)}
          sx={{ width: { xs: '100%', sm: 320 } }}
        >
          <MenuItem value={ALL_ASSESSMENTS}>All assessments</MenuItem>
          {profiles.map((profile) => (
            <MenuItem key={profile.id} value={String(profile.id)}>
              {profileOptionLabel(profile, showOwner)}
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Chip
            label={`${profiles.reduce((total, profile) => total + Number(profile.assessmentCount || 0), 0).toLocaleString()} total`}
            size="small"
            sx={{ bgcolor: '#EEF2FF', color: '#3730A3', fontWeight: 600 }}
          />
          {activeProfile ? (
            <Chip label={`${Number(activeProfile.assessmentCount || 0).toLocaleString()} selected`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}

function profileOptionLabel(profile, showOwner) {
  const owner = showOwner && profile.ownerUsername ? ` - ${profile.ownerUsername}` : '';
  return `${profile.name}${owner}`;
}

function AssessmentForm({
  activeProfile,
  canRegister,
  form,
  isSaving,
  jobOptions,
  jobSearch,
  jobsFetching,
  onFormChange,
  onJobChange,
  onJobSearchChange,
  onSubmit,
  selectedJob,
}) {
  return (
    <Paper component="form" variant="outlined" onSubmit={onSubmit} sx={{ p: 1.5, boxShadow: 1 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '160px minmax(220px, 1fr) 220px minmax(260px, 1fr) auto' },
          gap: 1,
          alignItems: 'start',
        }}
      >
        <TextField
          select
          required
          label="Category"
          size="small"
          value={form.category}
          onChange={(event) => onFormChange({ category: event.target.value })}
        >
          {ASSESSMENT_CATEGORY_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          required
          fullWidth
          label="Assessment link"
          size="small"
          type="url"
          value={form.assessmentLink}
          onChange={(event) => onFormChange({ assessmentLink: event.target.value })}
        />
        <TextField
          fullWidth
          label="Expiry time (optional)"
          size="small"
          type="datetime-local"
          value={form.expiresAt}
          onChange={(event) => onFormChange({ expiresAt: event.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <Autocomplete
          size="small"
          options={jobOptions}
          value={selectedJob}
          inputValue={jobSearch}
          loading={jobsFetching}
          filterOptions={(options) => options}
          isOptionEqualToValue={(option, value) => String(jobOptionId(option)) === String(jobOptionId(value))}
          getOptionLabel={jobOptionLabel}
          onChange={(_event, value) => onJobChange(value)}
          onInputChange={(_event, value) => onJobSearchChange(value)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Scraped job (optional)"
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  endAdornment: (
                    <>
                      {jobsFetching ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.slotProps.input.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props;
            return (
              <Box component="li" key={key || jobOptionId(option)} {...optionProps} sx={{ display: 'grid !important', gap: 0.25 }}>
                <Typography variant="body2" fontWeight={600}>
                  {jobOptionTitle(option)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[option.publicJobId, option.source, option.location].filter(Boolean).join(' - ')}
                </Typography>
              </Box>
            );
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!canRegister}
          startIcon={isSaving ? <CircularProgress color="inherit" size={16} /> : <AddLinkIcon />}
          sx={{ minHeight: 40, whiteSpace: 'nowrap' }}
        >
          Register
        </Button>
      </Box>
      {activeProfile ? (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Profile
          </Typography>
          <Chip label={activeProfile.name} size="small" sx={{ fontWeight: 600 }} />
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Choose a profile from the filter to register a new assessment.
        </Typography>
      )}
    </Paper>
  );
}

function AssessmentStats({ isFetching, onRefresh, stats }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, minmax(0, 1fr)) auto' }, gap: 1, alignItems: 'stretch' }}>
      <AssessmentStat label="Total" value={stats.total} tone="slate" />
      <AssessmentStat label="Active" value={stats.active} tone="green" />
      <AssessmentStat label="Due soon" value={stats.dueSoon} tone="amber" />
      <AssessmentStat label="Expired" value={stats.expired} tone="rose" />
      <AssessmentStat label="Done" value={stats.done} tone="blue" />
      <Button
        type="button"
        variant="outlined"
        onClick={() => onRefresh()}
        startIcon={isFetching ? <CircularProgress color="inherit" size={16} /> : <RefreshIcon />}
        sx={{ minHeight: 42, whiteSpace: 'nowrap' }}
      >
        Refresh
      </Button>
    </Box>
  );
}

function AssessmentStat({ label, tone, value }) {
  const styles = {
    amber: { bgcolor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' },
    blue: { bgcolor: 'rgba(0, 103, 192, 0.10)', borderColor: 'rgba(0, 103, 192, 0.28)', color: '#005A9E' },
    green: { bgcolor: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' },
    rose: { bgcolor: '#FFF1F2', borderColor: '#FECDD3', color: '#9F1239' },
    slate: { bgcolor: 'rgba(246, 248, 251, 0.86)', borderColor: 'rgba(0, 0, 0, 0.09)', color: '#334155' },
  }[tone];

  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, ...styles }}>
      <Typography variant="caption" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={600} lineHeight={1.1}>
        {Number(value || 0).toLocaleString()}
      </Typography>
    </Paper>
  );
}

function AssessmentList({ activeProfile, assessments, currentUser, isDeleting, isLoading, isMarkingDone, onDelete, onMarkDone }) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', gap: 1, alignContent: 'start', overflow: 'auto', minHeight: 0 }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Paper key={`assessment-loading-${index}`} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
            <Skeleton width="28%" />
            <Skeleton width="66%" />
            <Skeleton width="45%" />
          </Paper>
        ))}
      </Box>
    );
  }

  if (!assessments.length) {
    return (
      <EmptyState
        title="No assessments registered"
        detail={activeProfile ? 'Registered assessments for this profile will appear here.' : 'Registered assessments will appear here.'}
        sx={{ alignSelf: 'start' }}
      />
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 1, alignContent: 'start', overflow: 'auto', minHeight: 0, pr: { md: 0.5 } }}>
      {assessments.map((assessment) => (
        <AssessmentCard
          assessment={assessment}
          activeProfile={activeProfile}
          currentUser={currentUser}
          isDeleting={isDeleting}
          isMarkingDone={isMarkingDone}
          key={assessment.id}
          onDelete={() => onDelete(assessment)}
          onMarkDone={() => onMarkDone(assessment)}
        />
      ))}
    </Box>
  );
}

function AssessmentCard({ activeProfile, assessment, currentUser, isDeleting, isMarkingDone, onDelete, onMarkDone }) {
  const deadline = assessmentDeadline(assessment);
  const job = assessment.job;
  const profile = activeProfile || assessment.profile;
  const title = job ? jobOptionTitle(job) : assessment.categoryLabel || 'Assessment';
  const isDone = assessment.status === 'done' || Boolean(assessment.completedAt);
  const canMarkDone = !isDone && canMarkAssessmentDone(currentUser, assessment, profile);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderRadius: 1,
        boxShadow: 1,
        borderColor: deadline.borderColor,
        display: 'grid',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'flex-start', minWidth: 0 }}>
        <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            <Chip label={assessment.categoryLabel || assessment.category} size="small" sx={{ bgcolor: '#EEF2FF', color: '#3730A3', fontWeight: 600 }} />
            <Chip label={deadline.label} size="small" sx={{ bgcolor: deadline.bgcolor, color: deadline.color, fontWeight: 600 }} />
            {!activeProfile && profile?.name ? <Chip label={profile.name} size="small" variant="outlined" sx={{ fontWeight: 600 }} /> : null}
            {job?.source ? <Chip label={job.source} size="small" variant="outlined" sx={{ fontWeight: 600 }} /> : null}
          </Stack>
          <Typography fontWeight={600} noWrap>
            {title}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <LinkIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary" noWrap>
              {linkLabel(assessment.assessmentLink)}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          {canMarkDone ? (
            <Tooltip title="Mark done">
              <span>
                <IconButton
                  type="button"
                  size="small"
                  aria-label="Mark assessment done"
                  disabled={isMarkingDone}
                  onClick={onMarkDone}
                  sx={{ border: 1, borderColor: 'divider' }}
                >
                  {isMarkingDone ? <CircularProgress size={16} /> : <CheckCircleIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
          <Tooltip title="Open assessment">
            <IconButton
              component="a"
              href={assessment.assessmentLink}
              target="_blank"
              rel="noreferrer"
              size="small"
              aria-label="Open assessment"
              sx={{ border: 1, borderColor: 'divider' }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete assessment">
            <span>
              <IconButton
                type="button"
                size="small"
                aria-label="Delete assessment"
                disabled={isDeleting}
                onClick={onDelete}
                sx={{ border: 1, borderColor: 'divider' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {assessment.expiresAt ? <DetailChip label={`Expires ${formatDateTime(assessment.expiresAt)}`} /> : <DetailChip label="No expiry" />}
        {assessment.completedAt ? <DetailChip label={`Done ${formatDateTime(assessment.completedAt)}`} /> : null}
        <DetailChip label={`Added ${formatDateTime(assessment.createdAt)}`} />
        {assessment.createdBy?.username ? <DetailChip label={`By ${assessment.createdBy.username}`} /> : null}
        {job?.publicJobId ? <DetailChip label={job.publicJobId} /> : null}
        {job?.location ? <DetailChip label={job.location} /> : null}
      </Stack>
    </Paper>
  );
}

function DetailChip({ label }) {
  return (
    <Chip
      label={label}
      size="small"
      variant="outlined"
      sx={{ bgcolor: '#ffffff', color: 'text.secondary', fontWeight: 600, maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
    />
  );
}

function assessmentStats(assessments) {
  return assessments.reduce(
    (stats, assessment) => {
      const deadline = assessmentDeadline(assessment);
      stats.total += 1;
      if (deadline.state === 'done') stats.done += 1;
      else if (deadline.state === 'expired') stats.expired += 1;
      else if (deadline.state === 'dueSoon') {
        stats.active += 1;
        stats.dueSoon += 1;
      } else {
        stats.active += 1;
      }
      return stats;
    },
    { total: 0, active: 0, dueSoon: 0, expired: 0, done: 0 },
  );
}

function assessmentDeadline(assessment) {
  if (assessment.completedAt || assessment.status === 'done') {
    return {
      state: 'done',
      label: 'Done',
      bgcolor: 'rgba(0, 103, 192, 0.16)',
      borderColor: '#93C5FD',
      color: '#005A9E',
    };
  }
  if (!assessment.expiresAt) {
    return {
      state: 'none',
      label: 'No expiry',
      bgcolor: 'rgba(246, 248, 251, 0.86)',
      borderColor: 'rgba(0, 0, 0, 0.09)',
      color: '#475569',
    };
  }
  const time = Date.parse(assessment.expiresAt);
  if (!Number.isFinite(time)) {
    return {
      state: 'none',
      label: 'No expiry',
      bgcolor: 'rgba(246, 248, 251, 0.86)',
      borderColor: 'rgba(0, 0, 0, 0.09)',
      color: '#475569',
    };
  }
  const remainingMs = time - Date.now();
  if (remainingMs <= 0) {
    return {
      state: 'expired',
      label: 'Expired',
      bgcolor: '#FFE4E6',
      borderColor: '#FDA4AF',
      color: '#9F1239',
    };
  }
  if (remainingMs <= 48 * 60 * 60 * 1000) {
    return {
      state: 'dueSoon',
      label: 'Due soon',
      bgcolor: '#FEF3C7',
      borderColor: '#FBBF24',
      color: '#92400E',
    };
  }
  return {
    state: 'active',
    label: 'Active',
    bgcolor: '#DCFCE7',
    borderColor: '#86EFAC',
    color: '#166534',
  };
}

function canMarkAssessmentDone(currentUser, assessment, activeProfile) {
  if (!currentUser || !assessment) return false;
  if (isAdminRole(currentUser)) return true;
  return (
    String(assessment.userId) === String(currentUser.id) ||
    String(assessment.createdBy?.id) === String(currentUser.id) ||
    String(activeProfile?.userId) === String(currentUser.id)
  );
}

function jobOptionId(job) {
  return job?.representativeJobId || job?.id || '';
}

function jobOptionLabel(job) {
  if (!job) return '';
  return [jobOptionTitle(job), job.publicJobId, job.location].filter(Boolean).join(' - ');
}

function jobOptionTitle(job) {
  return [job.company, job.title].filter(Boolean).join(' - ') || 'Untitled job';
}

function linkLabel(value) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '') + url.pathname;
  } catch {
    return value;
  }
}
