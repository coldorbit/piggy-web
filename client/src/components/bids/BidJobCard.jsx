import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { formatDate } from '../../lib/formatters.js';
import { downloadAuthenticatedFile } from '../../lib/api.js';
import { jobSourceImageUrl, sourceLabel } from '../../lib/jobSourceImage.js';
import { BIDDER_ROLES, PRIVILEGED_USER_ROLES, isAdminRole, isSuperadmin } from '../../lib/roles.js';
import JobIdBadge from '../jobs/JobIdBadge.jsx';
import JobRegionBadge from '../jobs/JobRegionBadge.jsx';
import { APPLICATION_WORKFLOW_STATUSES, BID_TABS } from './bidConstants.js';
import { isTodoTailoringLocked, moveToInterviewDraft } from './bidJobState.js';
import { useBidWorkspace } from './BidWorkspaceContext.jsx';

const SELECTED_JOB_CARD_BG = 'rgba(0, 103, 192, 0.10)';

export default function BidJobCard({
  isSelected = false,
  isSelectionDisabled = false,
  job,
  onResumeDownload = () => {},
  onSelectedChange,
  selectionId,
}) {
  const {
    activeColor: accent,
    activeProfileIsStatic = false,
    activeTab,
    currentUser,
    draftsForJob,
    isSaving,
    isStoppingTailoring,
    tailoringByJobId = {},
    onDraftChange,
    onHiddenChange,
    onStatusChange,
    onStopTailoring,
    onTailorResume,
  } = useBidWorkspace();
  const draft = draftsForJob(job);
  const cardKey = String(job.groupId || job.id);
  const selectionKey = selectionId || cardKey;
  const isTailoring = Boolean(tailoringByJobId[cardKey] || tailoringByJobId[job.id]);
  const statusDefault = activeTab === BID_TABS.interviews ? 'interviewing' : activeTab === BID_TABS.done ? 'submitted' : undefined;
  const isAdmin = isAdminRole(currentUser);
  const isSuperadminUser = isSuperadmin(currentUser);
  const isBidder = BIDDER_ROLES.includes(currentUser?.role);
  const bidStatus = job.bid?.status || draft.status || 'planned';
  const reviewStatus = reviewStatusValue(bidStatus);
  const isInvalidReviewJob = Boolean(reviewStatus);
  const canRecoverBadWorkJob = activeTab === BID_TABS.badWork && isSuperadminUser;
  const canMoveDoneJobToInterview = activeTab === BID_TABS.done && PRIVILEGED_USER_ROLES.includes(currentUser?.role) && !isBidder;
  const canReviewDoneJob = activeTab === BID_TABS.done && isAdmin;
  const canReviewBadWorkJob = activeTab === BID_TABS.badWork && isAdmin;
  const canReviewTailoredJob = activeTab === BID_TABS.tailored && isAdmin && hasActiveTailoredResumeStatus(job.tailoredResume?.status);
  const showReviewControl = canReviewDoneJob || canReviewBadWorkJob || canReviewTailoredJob;
  const showBidStatusChip = activeTab !== BID_TABS.tailored || isInvalidReviewJob;
  const showStatusControl = activeTab === BID_TABS.interviews || activeTab === BID_TABS.done || canRecoverBadWorkJob;
  const statusControlLabel = canRecoverBadWorkJob ? 'Recover' : 'Status';
  const statusControlValue = canRecoverBadWorkJob && isInvalidReviewJob ? '' : draft.status || statusDefault || 'planned';
  const showReadyToApplyAction = activeProfileIsStatic && activeTab === BID_TABS.todo;
  const showAppliedAction = (activeTab === BID_TABS.tailored && job.tailoredResume?.status === 'ready') || (activeProfileIsStatic && activeTab === BID_TABS.tailored);
  const bidChipLabel = reviewStatusLabel(bidStatus) || (job.bid
    ? `Bid ${formatDate(job.bid.bidAt)}`
    : draft.status === 'planned'
      ? 'Not bid yet'
      : `Bid ${statusLabel(draft.status)}`);
  const tailoredStatus = job.tailoredResume?.status || '';
  const showTailorAction = !activeProfileIsStatic && (activeTab === BID_TABS.todo || tailoredStatus === 'dead_letter');
  const showRetailorAction = !activeProfileIsStatic && activeTab === BID_TABS.tailored && tailoredStatus === 'ready';
  const showStopTailoringAction = activeTab === BID_TABS.tailored && ['requested', 'processing'].includes(tailoredStatus);
  const appliedByLabel = appliedByChipLabel(job.bid, currentUser);
  const tailoringInFlight = tailoredStatus === 'requested' || tailoredStatus === 'processing';
  const hasTailoringRequest = tailoringInFlight || tailoredStatus === 'ready';
  const isTodoLocked = activeTab === BID_TABS.todo && isTodoTailoringLocked(job);
  const tailorActionLabel = tailoredStatus === 'dead_letter' ? 'Retry' : hasTailoringRequest ? 'Requested' : 'Tailor';
  const retailorActionLabel = isTailoring ? 'Tailoring now' : 'Re-tailor';
  const isResumeDownloaded = Boolean(job.tailoredResume?.downloadedAt);
  const sameCompanyTailoring = job.sameCompanyTailoring || null;
  const hasSameCompanyWarning = Boolean(sameCompanyTailoring?.requiresConfirmation);
  const sameCompanyNotice = sameCompanyNoticeText(sameCompanyTailoring);
  const isLinkedInJob = sourceKey(job.source) === 'linkedin';
  const isEasyApply = isEasyApplyMode(job.applyMode);
  const hasUpdatedJobLink = isLinkedInJob && isExternalLinkMode(job.applyMode);
  const hasDownloadableResume = tailoredStatus === 'ready' && job.tailoredResume?.filePath;
  const downloadFilename = job.tailoredResume?.filePath ? String(job.tailoredResume.filePath).split('/').pop() : 'tailored-resume.docx';

  async function downloadResume(event) {
    event.stopPropagation();
    if (isInvalidReviewJob || !hasDownloadableResume) return;
    await downloadAuthenticatedFile(
      `/api/bid/tailored-resumes/${encodeURIComponent(job.tailoredResume.id)}/download`,
      downloadFilename,
    );
    onResumeDownload(job.tailoredResume.id);
  }

  function handleStatusChange(event) {
    const status = event.target.value;
    onDraftChange(job.id, 'status', status);
    onStatusChange(job, { ...draft, status });
  }

  function handleReviewChange(event) {
    const status = event.target.value || 'planned';
    onDraftChange(job.id, 'status', status);
    onStatusChange(job, { ...draft, status });
  }

  function handleApplied() {
    const status = 'submitted';
    onDraftChange(job.id, 'status', status);
    onStatusChange(job, { ...draft, status });
  }

  function handleMoveToInterview() {
    const nextDraft = moveToInterviewDraft(draft);
    onDraftChange(job.id, 'status', nextDraft.status);
    onDraftChange(job.id, 'interviewStage', nextDraft.interviewStage);
    onStatusChange(job, nextDraft);
  }

  function handleCardClick(event) {
    if (isSelectionDisabled) return;
    if (isInteractiveTarget(event.target, event.currentTarget)) return;
    onSelectedChange(selectionKey);
  }

  function handleCardKeyDown(event) {
    if (isSelectionDisabled) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (isInteractiveTarget(event.target, event.currentTarget)) return;
    event.preventDefault();
    onSelectedChange(selectionKey);
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr)',
        gap: 0.75,
        alignItems: 'center',
      }}
    >
        <Checkbox
          checked={isSelected}
          disabled={isSelectionDisabled}
          onChange={() => onSelectedChange(selectionKey)}
          inputProps={{ 'aria-label': `Select ${job.title || 'job'}` }}
          sx={{
            p: 0.5,
            color: 'text.secondary',
            '&.Mui-checked': { color: accent.main },
          }}
        />
        <Card
          variant="outlined"
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
          role="button"
          tabIndex={isSelectionDisabled ? -1 : 0}
          aria-pressed={isSelected}
          aria-disabled={isSelectionDisabled}
          sx={{
            borderColor: isSelected ? accent.main : 'divider',
            borderLeft: hasSameCompanyWarning
              ? '4px solid #dc2626'
              : isResumeDownloaded
                ? '4px solid #15803d'
                : job.bid || isSelected
                  ? `4px solid ${accent.main}`
                  : '4px solid transparent',
            bgcolor: isTodoLocked
              ? '#f8fafc'
              : isSelected
                ? SELECTED_JOB_CARD_BG
                : hasSameCompanyWarning
                  ? '#fef2f2'
                  : isResumeDownloaded
                    ? '#f0fdf4'
                    : 'background.paper',
            boxShadow: isSelected || isResumeDownloaded || hasSameCompanyWarning ? 2 : 1,
            cursor: isSelectionDisabled ? 'default' : 'pointer',
            opacity: isTodoLocked ? 0.72 : 1,
            transition: 'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
            '&:hover': {
              boxShadow: isSelectionDisabled ? 1 : 2,
              transform: isSelectionDisabled ? 'none' : 'translateY(-1px)',
            },
            '&:focus-visible': {
              outline: `2px solid ${accent.main}`,
              outlineOffset: 2,
            },
          }}
        >
          <CardContent sx={{ display: 'grid', gap: 0.65, px: 1, py: 0.85, '&:last-child': { pb: 0.85 } }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(190px, auto) max-content' },
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Box
                minWidth={0}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '44px minmax(0, 1fr)',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <SourceLogo job={job} />
                <Box minWidth={0} sx={{ display: 'grid', gap: 0.25 }}>
                  <Typography
                    component="a"
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    variant="body2"
                    fontWeight={900}
                    sx={{
                      color: 'text.primary',
                      display: 'inline-block',
                      justifySelf: 'start',
                      maxWidth: '100%',
                      textDecoration: 'none',
                      width: 'fit-content',
                      '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                    }}
                  >
                    {job.title || 'Untitled role'}
                  </Typography>
                  <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 0.45 }}>
                    {job.company ? (
                      <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                        {job.company}
                      </Box>
                    ) : (
                      'Unknown company'
                    )}
                    {job.location ? ` · ${job.location}` : null}
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: { xs: 'flex-start', md: 'flex-end' },
                  columnGap: 0.65,
                  rowGap: 0.45,
                  minWidth: 0,
                }}
              >
                <JobIdBadge job={job} sx={{ height: 24 }} />
                {job.isManual ? (
                  <Chip
                    label="Manual"
                    size="small"
                    sx={{ bgcolor: '#ECFDF5', color: '#486860', fontWeight: 900 }}
                  />
                ) : null}
                <JobRegionBadge job={job} sx={{ height: 24 }} />
                {job.locationOptions?.length > 1 ? (
                  <Chip
                    label={`${job.locationOptions.length} locations`}
                    size="small"
                    sx={{ bgcolor: '#F0FDFA', color: '#324B45', fontWeight: 900 }}
                  />
                ) : null}
                {hasUpdatedJobLink ? (
                  <Chip
                    icon={<LinkIcon />}
                    label="Updated job link"
                    size="small"
                    sx={{
                      bgcolor: '#f0f9ff',
                      color: '#075985',
                      fontWeight: 800,
                      '& .MuiChip-icon': { color: '#0284c7' },
                    }}
                  />
                ) : null}
                {job.applyMode && !isLinkedInJob ? <ApplyModeChip applyMode={job.applyMode} /> : null}
                {sameCompanyTailoring ? (
                  <Chip
                    label={hasSameCompanyWarning ? 'Same company warning' : `Prior same-company ${sameCompanyTailoring.daysSincePrior}d`}
                    size="small"
                    sx={{
                      bgcolor: hasSameCompanyWarning ? '#fee2e2' : '#fff7ed',
                      color: hasSameCompanyWarning ? '#991b1b' : '#9a3412',
                      fontWeight: 900,
                    }}
                  />
                ) : null}
                <Chip
                  label={formatDate(job.postedAt || job.scrapedAt)}
                  size="small"
                  sx={{ bgcolor: '#f7ead1', color: '#70400d', fontWeight: 700 }}
                />
                {showBidStatusChip && (job.bid || draft.status !== 'planned') ? (
                  <Chip
                    label={bidChipLabel}
                    size="small"
                    sx={isInvalidReviewJob ? reviewStatusSx(reviewStatus) : { bgcolor: accent.soft, color: accent.dark, fontWeight: 800 }}
                  />
                ) : null}
                {activeTab !== BID_TABS.done && activeTab !== BID_TABS.interviews && tailoredStatus ? (
                  <Chip
                    label={tailoredStatusLabel(tailoredStatus)}
                    size="small"
                    sx={tailoredStatusSx(tailoredStatus)}
                  />
                ) : null}
                {isResumeDownloaded ? (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Downloaded"
                    size="small"
                    sx={{
                      bgcolor: '#dcfce7',
                      color: '#166534',
                      fontWeight: 900,
                      '& .MuiChip-icon': { color: '#15803d' },
                    }}
                  />
                ) : null}
                {(activeTab === BID_TABS.done || activeTab === BID_TABS.badWork || activeTab === BID_TABS.interviews) && appliedByLabel ? (
                  <Chip
                    label={appliedByLabel}
                    size="small"
                    sx={{ bgcolor: '#edf0ff', color: '#343f91', fontWeight: 800 }}
                  />
                ) : null}
              </Box>
              <Stack
                direction="row"
                spacing={0.65}
                justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                alignItems="center"
                justifySelf={{ xs: 'stretch', md: 'end' }}
                flexShrink={0}
              >
                {showStatusControl ? (
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{statusControlLabel}</InputLabel>
                    <Select
                      label={statusControlLabel}
                      value={statusControlValue}
                      onChange={handleStatusChange}
                      disabled={isSaving}
                    >
                      {canRecoverBadWorkJob && isInvalidReviewJob ? (
                        <MenuItem value="" disabled>
                          Applicable state
                        </MenuItem>
                      ) : null}
                      {APPLICATION_WORKFLOW_STATUSES.map((status) => (
                        <MenuItem key={status.value} value={status.value}>
                          {status.label}
                        </MenuItem>
                      ))}
                      <MenuItem value="interviewing">Interviewing</MenuItem>
                      <MenuItem value="won">Won</MenuItem>
                      <MenuItem value="lost">Lost</MenuItem>
                    </Select>
                  </FormControl>
                ) : null}
                {showReviewControl ? (
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Review</InputLabel>
                    <Select
                      label="Review"
                      value={reviewStatusValue(draft.status)}
                      onChange={handleReviewChange}
                      disabled={isSaving}
                    >
                      <MenuItem value="" disabled={activeTab !== BID_TABS.tailored}>
                        {activeTab === BID_TABS.tailored ? 'None' : 'Review status'}
                      </MenuItem>
                      <MenuItem value="mismatching_bid">Mismatching</MenuItem>
                      <MenuItem value="spam_job">Spam work</MenuItem>
                    </Select>
                  </FormControl>
                ) : null}
                {canMoveDoneJobToInterview ? (
                  <Button
                    disabled={draft.status === 'interviewing' || isSaving}
                    onClick={handleMoveToInterview}
                    size="small"
                    startIcon={<CheckCircleIcon />}
                    variant="contained"
                    sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
                  >
                    Move to interview
                  </Button>
                ) : null}
                {showAppliedAction ? (
                  <Button
                    disabled={isInvalidReviewJob || draft.status === 'submitted'}
                    onClick={handleApplied}
                    size="small"
                    startIcon={<CheckCircleIcon />}
                    variant="contained"
                    sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
                  >
                    Mark as applied
                  </Button>
                ) : null}
                {showReadyToApplyAction ? (
                  <Button
                    disabled={isInvalidReviewJob || draft.status === 'ready'}
                    onClick={() => onTailorResume(job)}
                    size="small"
                    startIcon={<CheckCircleIcon />}
                    variant="contained"
                    sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
                  >
                    Ready to apply
                  </Button>
                ) : null}
                {hasDownloadableResume ? (
                  <Tooltip title={isInvalidReviewJob ? 'Marked as not applicable' : isResumeDownloaded ? 'Download again' : 'Download resume'}>
                    <Box component="span" sx={{ display: 'inline-flex' }}>
                      <IconButton
                        disabled={isInvalidReviewJob}
                        aria-label={isResumeDownloaded ? 'Download resume again' : 'Download resume'}
                        color={isResumeDownloaded ? 'success' : 'primary'}
                        onClick={downloadResume}
                        sx={{
                          ...iconButtonSx,
                          bgcolor: isResumeDownloaded ? '#dcfce7' : 'background.paper',
                          borderColor: isResumeDownloaded ? '#86efac' : 'divider',
                          color: isResumeDownloaded ? '#15803d' : 'primary.main',
                          '&:hover': {
                            bgcolor: isResumeDownloaded ? '#bbf7d0' : 'action.hover',
                            borderColor: isResumeDownloaded ? '#22c55e' : 'primary.main',
                          },
                        }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                  </Tooltip>
                ) : null}
                {showStopTailoringAction ? (
                  <Button
                    disabled={isStoppingTailoring}
                    onClick={() => onStopTailoring(job)}
                    size="small"
                    startIcon={isStoppingTailoring ? <CircularProgress color="inherit" size={14} /> : <CancelIcon />}
                    variant="outlined"
                    sx={{
                      minHeight: 32,
                      whiteSpace: 'nowrap',
                      borderColor: '#fecaca',
                      color: '#991b1b',
                      bgcolor: '#fef2f2',
                      fontWeight: 800,
                      '&:hover': {
                        borderColor: '#ef4444',
                        bgcolor: '#fee2e2',
                      },
                    }}
                  >
                    Stop tailoring
                  </Button>
                ) : null}
                <Tooltip title={job.isHidden ? 'Unhide job' : 'Hide job'}>
                  <IconButton
                    onClick={() => onHiddenChange(job, !job.isHidden)}
                    aria-label={job.isHidden ? 'Unhide job' : 'Hide job'}
                    sx={iconButtonSx}
                  >
                    {job.isHidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
                  </IconButton>
                </Tooltip>
                {showTailorAction ? (
                  <Tooltip title={tailorActionLabel}>
                    <Box component="span" sx={{ display: 'inline-flex' }}>
                      <IconButton
                        aria-label={tailorActionLabel}
                        disabled={isInvalidReviewJob || isTailoring || hasTailoringRequest}
                        onClick={() => onTailorResume(job)}
                        sx={tailorButtonSx}
                      >
                        {isTailoring ? <CircularProgress color="inherit" size={16} /> : <AutoAwesomeIcon />}
                      </IconButton>
                    </Box>
                  </Tooltip>
                ) : null}
                {showRetailorAction ? (
                  <Tooltip title={retailorActionLabel}>
                    <Box component="span" sx={{ display: 'inline-flex' }}>
                      <IconButton
                        aria-label={retailorActionLabel}
                        disabled={isInvalidReviewJob || isTailoring}
                        onClick={() => onTailorResume(job)}
                        sx={tailorButtonSx}
                      >
                        {isTailoring ? <CircularProgress color="inherit" size={16} /> : <AutoAwesomeIcon />}
                      </IconButton>
                    </Box>
                  </Tooltip>
                ) : null}
              </Stack>
            </Box>
          </CardContent>
          {job.bid || sameCompanyNotice ? (
            <CardActions sx={{ px: 1, py: 0.5, pt: 0, color: hasSameCompanyWarning ? '#991b1b' : 'text.secondary' }}>
              <Typography variant="caption">
                {sameCompanyNotice || 'This profile has already bid on this job. Updates edit the existing bid.'}
              </Typography>
            </CardActions>
          ) : null}
        </Card>
    </Box>
  );
}

const iconButtonSx = {
  width: 30,
  height: 30,
  border: 1,
  borderColor: 'divider',
  '& .MuiSvgIcon-root': {
    fontSize: 18,
  },
};

const tailorButtonSx = {
  ...iconButtonSx,
  borderColor: '#38bdf8',
  bgcolor: '#eff6ff',
  color: '#1d4ed8',
  '&:hover': {
    borderColor: '#2563eb',
    bgcolor: '#dbeafe',
  },
  '&.Mui-disabled': {
    borderColor: '#bfdbfe',
    bgcolor: '#eff6ff',
    color: '#60a5fa',
  },
};

function statusLabel(status) {
  if (status === 'mismatching_bid') return 'Mismatching bid';
  if (status === 'spam_job') return 'Spam job';
  const workflowStatus = APPLICATION_WORKFLOW_STATUSES.find((option) => option.value === status);
  if (workflowStatus) return workflowStatus.label;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function reviewStatusLabel(status) {
  if (status === 'mismatching_bid') return 'Mismatching bid';
  if (status === 'spam_job') return 'Spam job';
  return '';
}

function reviewStatusValue(status) {
  if (status === 'mismatching_bid' || status === 'spam_job') return status;
  return '';
}

function reviewStatusSx(status) {
  if (status === 'spam_job') return { bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 900 };
  return { bgcolor: '#ffedd5', color: '#9a3412', fontWeight: 900 };
}

function hasActiveTailoredResumeStatus(status) {
  return ['requested', 'processing', 'ready', 'dead_letter'].includes(status);
}

function tailoredStatusLabel(status) {
  if (status === 'ready') return 'Ready';
  if (status === 'processing') return 'Tailoring';
  if (status === 'dead_letter') return 'Failed';
  return 'Queued';
}

function tailoredStatusSx(status) {
  if (status === 'ready') return { bgcolor: '#e6f4ee', color: '#14583f', fontWeight: 800 };
  if (status === 'dead_letter') return { bgcolor: '#fde9e5', color: '#8a2f1d', fontWeight: 800 };
  if (status === 'processing') return { bgcolor: '#fff1d6', color: '#70400d', fontWeight: 800 };
  return { bgcolor: '#edf0ff', color: '#343f91', fontWeight: 800 };
}

function sameCompanyNoticeText(value) {
  if (!value) return '';
  const days = Number(value.daysSincePrior || 0);
  const age = `${days} day${days === 1 ? '' : 's'} ago`;
  const title = value.priorTitle || 'another role';
  if (value.requiresConfirmation) {
    return `Different role at same company: ${title} was tailored ${age}. Tailoring this job requires confirmation.`;
  }
  const postingDays = Number(value.daysSincePriorPosting ?? value.daysSincePrior ?? 0);
  const postingAge = `${postingDays} day${postingDays === 1 ? '' : 's'} ago`;
  return `Prior same-company posting ${postingAge}: ${title}.`;
}

function appliedByChipLabel(bid, currentUser) {
  if (!bid?.userId) return '';
  if (String(bid.userId) === String(currentUser?.id)) return 'by me';
  return `by ${bid.user?.username || 'unknown'}`;
}

function sourceKey(source) {
  return String(source || '').trim().toLowerCase();
}

function isEasyApplyMode(applyMode) {
  return /easy\s*apply/i.test(String(applyMode || ''));
}

function isExternalLinkMode(applyMode) {
  return /external\s*link/i.test(String(applyMode || ''));
}

function isInteractiveTarget(target, cardElement) {
  const interactiveElement = target.closest(
    'a, button, input, textarea, select, [role="button"], [role="checkbox"], [role="combobox"], .MuiSelect-select',
  );
  return Boolean(interactiveElement && interactiveElement !== cardElement);
}

function SourceLogo({ job }) {
  const label = sourceLabel(job.source);

  return (
    <Tooltip title={label}>
      <Box
        component="img"
        alt={`${label} logo`}
        src={jobSourceImageUrl({ isManual: job.isManual, source: job.source, sourceUrl: job.sourceUrl, size: 128 })}
        sx={{
          width: 40,
          height: 40,
          objectFit: 'contain',
          flex: '0 0 auto',
          borderRadius: 1,
        }}
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    </Tooltip>
  );
}

function ApplyModeChip({ applyMode }) {
  return (
    <Chip
      label={applyMode}
      size="small"
      sx={{
        maxWidth: 156,
        bgcolor: '#f8e0e7',
        color: '#7c263a',
        fontWeight: 800,
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }}
    />
  );
}
