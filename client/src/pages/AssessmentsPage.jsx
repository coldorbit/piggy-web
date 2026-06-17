import AddLinkIcon from '@mui/icons-material/AddLink';
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
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  useAssessmentProfiles,
  useAssessments,
  useCreateAssessment,
  useDeleteAssessment,
  useJobs,
} from '../lib/api.js';
import { formatDateTime } from '../lib/formatters.js';
import { PROFILE_BADGE_COLORS, PROFILE_COLORS } from '../components/profiles/profileConstants.js';
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

export default function AssessmentsPage({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeProfileId, setActiveProfileId] = useState(() => searchParams.get('profileId') || '');
  const [form, setForm] = useState(EMPTY_ASSESSMENT_FORM);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobSearch, setJobSearch] = useState('');
  const [pageError, setPageError] = useState('');

  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useAssessmentProfiles();
  const activeProfile = useMemo(
    () => profiles.find((profile) => String(profile.id) === String(activeProfileId)) || profiles[0] || null,
    [activeProfileId, profiles],
  );
  const {
    data: assessmentsData,
    isLoading: assessmentsLoading,
    isFetching: assessmentsFetching,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useAssessments(activeProfile?.id);

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
  const activeColor = PROFILE_COLORS[activeProfile?.colorScheme || 'green'] || PROFILE_COLORS.green;
  const assessments = assessmentsData?.assessments || [];
  const stats = assessmentStats(assessments);
  const errorMessage =
    pageError ||
    profilesError?.message ||
    assessmentsError?.message ||
    createAssessment.error?.message ||
    deleteAssessment.error?.message ||
    '';
  const canRegister = Boolean(activeProfile?.id && form.assessmentLink.trim() && form.category && !createAssessment.isPending);

  useEffect(() => {
    if (!profiles[0]) return;
    const hasProfile = profiles.some((profile) => String(profile.id) === String(activeProfileId));
    if (!activeProfileId || !hasProfile) setActiveProfileId(profiles[0].id);
  }, [activeProfileId, profiles]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (activeProfileId) nextParams.set('profileId', activeProfileId);
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
            gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)', xl: '240px minmax(0, 1fr)' },
            gap: 1.5,
            alignItems: 'stretch',
            height: { xs: 'auto', md: 'calc(100vh - 108px)', xl: 'calc(100vh - 124px)' },
            minHeight: { md: 0 },
            minWidth: 0,
          }}
        >
          <AssessmentProfileTabs
            activeColor={activeColor}
            activeProfile={activeProfile}
            isLoading={profilesLoading}
            profiles={profiles}
            showOwner={isAdminRole(currentUser)}
            onProfileChange={setActiveProfileId}
          />

          <Box sx={{ display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: 1.5, minHeight: 0, minWidth: 0 }}>
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
              assessments={assessments}
              isDeleting={deleteAssessment.isPending}
              isLoading={assessmentsLoading && !assessmentsData}
              onDelete={removeAssessment}
            />
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

function AssessmentProfileTabs({ activeColor, activeProfile, isLoading, onProfileChange, profiles, showOwner }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        overflow: 'hidden',
        boxShadow: 1,
        alignSelf: 'stretch',
        height: { xs: 'auto', md: '100%' },
        minHeight: 0,
      }}
    >
      <Box sx={{ px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
          Profiles
        </Typography>
      </Box>
      {profiles.length ? (
        <Tabs
          orientation={isDesktop ? 'vertical' : 'horizontal'}
          value={activeProfile ? String(activeProfile.id) : false}
          onChange={(_event, value) => onProfileChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            bgcolor: 'rgba(255, 255, 255, 0.72)',
            '& .MuiTabs-indicator': { backgroundColor: activeColor.main },
            '& .MuiTabs-scroller': { overflowY: { md: 'auto !important' } },
            '& .MuiTabs-flexContainer': { alignItems: 'stretch' },
            '& .MuiTab-root': {
              minHeight: 64,
              alignItems: isDesktop ? 'stretch' : 'center',
              borderRadius: 0,
              borderBottom: isDesktop ? 1 : 0,
              borderRight: isDesktop ? 0 : 1,
              borderColor: 'divider',
              px: 1.25,
              py: 1,
            },
          }}
        >
          {profiles.map((profile) => {
            const color = PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green;
            return (
              <Tab
                key={profile.id}
                value={String(profile.id)}
                label={<ProfileAssessmentTabLabel profile={profile} showOwner={showOwner} />}
                sx={{
                  color: color.dark,
                  fontWeight: 800,
                  textAlign: 'left',
                  '&.Mui-selected': {
                    color: color.dark,
                    backgroundColor: color.soft,
                  },
                }}
              />
            );
          })}
        </Tabs>
      ) : isLoading ? (
        <ProfileTabSkeletons />
      ) : (
        <EmptyState
          title="No profiles yet"
          detail="Profiles will appear here once they are active and available."
          variant="plain"
          sx={{ flex: 1, p: 1.5, justifyItems: 'start', textAlign: 'left', bgcolor: 'transparent' }}
        />
      )}
    </Paper>
  );
}

function ProfileAssessmentTabLabel({ profile, showOwner }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'stretch', minWidth: 0, width: '100%' }}>
      <Typography component="span" variant="body2" fontWeight={800} noWrap>
        {profile.name}
      </Typography>
      {showOwner && profile.ownerUsername ? (
        <Typography component="span" variant="caption" color="text.secondary" noWrap>
          {profile.ownerUsername}
        </Typography>
      ) : null}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        <Chip
          label={profile.profileBadge || 'SWE'}
          size="small"
          sx={{
            ...(PROFILE_BADGE_COLORS[profile.profileBadge || 'SWE'] || {}),
            height: 20,
            fontSize: 11,
            fontWeight: 800,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
        <Chip
          label={`${Number(profile.assessmentCount || 0).toLocaleString()} assessments`}
          size="small"
          sx={{ height: 20, fontSize: 11, fontWeight: 800, bgcolor: '#EEF2FF', color: '#3730A3', '& .MuiChip-label': { px: 0.75 } }}
        />
      </Box>
    </Box>
  );
}

function ProfileTabSkeletons() {
  return (
    <Box sx={{ display: 'grid', alignContent: 'start' }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Box key={`assessment-profile-loading-${index}`} sx={{ minHeight: 64, px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Skeleton width="72%" />
          <Skeleton width="46%" />
        </Box>
      ))}
    </Box>
  );
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
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {jobsFetching ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props;
            return (
              <Box component="li" key={key || jobOptionId(option)} {...optionProps} sx={{ display: 'grid !important', gap: 0.25 }}>
                <Typography variant="body2" fontWeight={800}>
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
          <Chip label={activeProfile.name} size="small" sx={{ fontWeight: 800 }} />
        </Stack>
      ) : null}
    </Paper>
  );
}

function AssessmentStats({ isFetching, onRefresh, stats }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr)) auto' }, gap: 1, alignItems: 'stretch' }}>
      <AssessmentStat label="Total" value={stats.total} tone="slate" />
      <AssessmentStat label="Active" value={stats.active} tone="green" />
      <AssessmentStat label="Due soon" value={stats.dueSoon} tone="amber" />
      <AssessmentStat label="Expired" value={stats.expired} tone="rose" />
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
    green: { bgcolor: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' },
    rose: { bgcolor: '#FFF1F2', borderColor: '#FECDD3', color: '#9F1239' },
    slate: { bgcolor: '#F8FAFC', borderColor: '#E2E8F0', color: '#334155' },
  }[tone];

  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 1, ...styles }}>
      <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={900} lineHeight={1.1}>
        {Number(value || 0).toLocaleString()}
      </Typography>
    </Paper>
  );
}

function AssessmentList({ assessments, isDeleting, isLoading, onDelete }) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', gap: 1, alignContent: 'start', overflow: 'auto', minHeight: 0 }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Paper key={`assessment-loading-${index}`} variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
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
        detail="Registered assessments for this profile will appear here."
        sx={{ alignSelf: 'start' }}
      />
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 1, alignContent: 'start', overflow: 'auto', minHeight: 0, pr: { md: 0.5 } }}>
      {assessments.map((assessment) => (
        <AssessmentCard
          assessment={assessment}
          isDeleting={isDeleting}
          key={assessment.id}
          onDelete={() => onDelete(assessment)}
        />
      ))}
    </Box>
  );
}

function AssessmentCard({ assessment, isDeleting, onDelete }) {
  const deadline = assessmentDeadline(assessment);
  const job = assessment.job;
  const title = job ? jobOptionTitle(job) : assessment.categoryLabel || 'Assessment';

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
            <Chip label={assessment.categoryLabel || assessment.category} size="small" sx={{ bgcolor: '#EEF2FF', color: '#3730A3', fontWeight: 800 }} />
            <Chip label={deadline.label} size="small" sx={{ bgcolor: deadline.bgcolor, color: deadline.color, fontWeight: 800 }} />
            {job?.source ? <Chip label={job.source} size="small" variant="outlined" sx={{ fontWeight: 800 }} /> : null}
          </Stack>
          <Typography fontWeight={900} noWrap>
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
      sx={{ bgcolor: '#ffffff', color: 'text.secondary', fontWeight: 700, maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
    />
  );
}

function assessmentStats(assessments) {
  return assessments.reduce(
    (stats, assessment) => {
      const deadline = assessmentDeadline(assessment);
      stats.total += 1;
      if (deadline.state === 'expired') stats.expired += 1;
      else if (deadline.state === 'dueSoon') {
        stats.active += 1;
        stats.dueSoon += 1;
      } else {
        stats.active += 1;
      }
      return stats;
    },
    { total: 0, active: 0, dueSoon: 0, expired: 0 },
  );
}

function assessmentDeadline(assessment) {
  if (!assessment.expiresAt) {
    return {
      state: 'none',
      label: 'No expiry',
      bgcolor: '#F8FAFC',
      borderColor: '#E2E8F0',
      color: '#475569',
    };
  }
  const time = Date.parse(assessment.expiresAt);
  if (!Number.isFinite(time)) {
    return {
      state: 'none',
      label: 'No expiry',
      bgcolor: '#F8FAFC',
      borderColor: '#E2E8F0',
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
