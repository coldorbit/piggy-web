import { useState } from 'react';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { formatDate } from '../../lib/formatters.js';
import { authUrl } from '../../lib/api.js';
import { jobSourceImageUrl, sourceLabel } from '../../lib/jobSourceImage.js';
import { BIDDER_ROLES, PRIVILEGED_USER_ROLES, isAdminRole } from '../../lib/roles.js';
import { BID_TABS } from './bidConstants.js';
import { isTodoTailoringLocked } from './bidJobState.js';
import { useBidWorkspace } from './BidWorkspaceContext.jsx';

export default function BidJobCard({
  isSelected = false,
  isSelectionDisabled = false,
  job,
  onResumeDownload = () => {},
  onSelectedChange,
}) {
  const {
    activeColor: accent,
    activeTab,
    currentUser,
    draftsForJob,
    isSaving,
    isStoppingTailoring,
    isUpdatingLinkedInJob,
    tailoringByJobId = {},
    onDraftChange,
    onHiddenChange,
    onLinkedInExternalUrlChange,
    onStatusChange,
    onStopTailoring,
    onTailorResume,
  } = useBidWorkspace();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalUrlError, setExternalUrlError] = useState('');
  const draft = draftsForJob(job);
  const isTailoring = Boolean(tailoringByJobId[job.id]);
  const statusDefault = activeTab === BID_TABS.interviews ? 'interviewing' : activeTab === BID_TABS.done ? 'submitted' : undefined;
  const isAdmin = isAdminRole(currentUser);
  const isBidder = BIDDER_ROLES.includes(currentUser?.role);
  const bidStatus = job.bid?.status || draft.status || 'planned';
  const reviewStatus = reviewStatusValue(bidStatus);
  const isInvalidReviewJob = Boolean(reviewStatus);
  const canMoveDoneJobToInterview = activeTab === BID_TABS.done && PRIVILEGED_USER_ROLES.includes(currentUser?.role) && !isBidder;
  const canReviewDoneJob = activeTab === BID_TABS.done && isAdmin;
  const canReviewTailoredJob = activeTab === BID_TABS.tailored && isAdmin && hasActiveTailoredResumeStatus(job.tailoredResume?.status);
  const showReviewControl = canReviewDoneJob || canReviewTailoredJob;
  const showBidStatusChip = activeTab !== BID_TABS.tailored || isInvalidReviewJob;
  const showStatusControl = activeTab === BID_TABS.interviews;
  const showAppliedAction = activeTab === BID_TABS.tailored && job.tailoredResume?.status === 'ready';
  const bidChipLabel = reviewStatusLabel(bidStatus) || (job.bid
    ? `Bid ${formatDate(job.bid.bidAt)}`
    : draft.status === 'planned'
      ? 'Not bid yet'
      : `Bid ${statusLabel(draft.status)}`);
  const tailoredStatus = job.tailoredResume?.status || '';
  const showTailorAction = activeTab === BID_TABS.todo || tailoredStatus === 'dead_letter';
  const showRetailorAction = activeTab === BID_TABS.tailored && tailoredStatus === 'ready';
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
  const showLinkedInTodoActions = activeTab === BID_TABS.todo && isLinkedInJob;
  const showUpdateExternalLinkAction = showLinkedInTodoActions;
  const hasDownloadableResume = tailoredStatus === 'ready' && job.tailoredResume?.filePath;
  const downloadUrl =
    hasDownloadableResume && !isInvalidReviewJob
      ? authUrl(`/api/bid/tailored-resumes/${encodeURIComponent(job.tailoredResume.id)}/download`)
      : '';
  const downloadFilename = job.tailoredResume?.filePath ? String(job.tailoredResume.filePath).split('/').pop() : 'tailored-resume.docx';

  function handleStatusChange(event) {
    const status = event.target.value;
    onDraftChange(job.id, 'status', status);
    onStatusChange(job, { ...draft, status });
  }

  function handleApplied() {
    const status = 'submitted';
    onDraftChange(job.id, 'status', status);
    onStatusChange(job, { ...draft, status });
  }

  function handleMoveToInterview() {
    const status = 'interviewing';
    onDraftChange(job.id, 'status', status);
    onStatusChange(job, { ...draft, status });
  }

  function handleCardClick(event) {
    if (isSelectionDisabled) return;
    if (isInteractiveTarget(event.target, event.currentTarget)) return;
    onSelectedChange(job.id);
  }

  function handleCardKeyDown(event) {
    if (isSelectionDisabled) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (isInteractiveTarget(event.target, event.currentTarget)) return;
    event.preventDefault();
    onSelectedChange(job.id);
  }

  function openLinkDialog(event) {
    event.stopPropagation();
    setExternalUrl(isLinkedInUrl(job.url) ? '' : job.url || '');
    setExternalUrlError('');
    setIsLinkDialogOpen(true);
  }

  function closeLinkDialog() {
    if (isUpdatingLinkedInJob) return;
    setIsLinkDialogOpen(false);
  }

  function submitExternalUrl(event) {
    event.preventDefault();
    const nextUrl = externalUrl.trim();
    const validationError = externalUrlValidationError(nextUrl);
    if (validationError) {
      setExternalUrlError(validationError);
      return;
    }
    setExternalUrlError('');
    onLinkedInExternalUrlChange(job, nextUrl, {
      onSuccess: () => setIsLinkDialogOpen(false),
      onError: (error) => setExternalUrlError(error.message),
    });
  }

  return (
    <>
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
          onChange={() => onSelectedChange(job.id)}
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
              : hasSameCompanyWarning
                ? '#fef2f2'
                : isSelected
                  ? accent.soft
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
                {job.isManual ? (
                  <Chip
                    label="Manual"
                    size="small"
                    sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 900 }}
                  />
                ) : null}
                {job.locationOptions?.length > 1 ? (
                  <Chip
                    label={`${job.locationOptions.length} locations`}
                    size="small"
                    sx={{ bgcolor: '#F0FDFA', color: '#115E59', fontWeight: 900 }}
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
                {(activeTab === BID_TABS.done || activeTab === BID_TABS.interviews) && appliedByLabel ? (
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
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={draft.status || statusDefault || 'planned'}
                      onChange={handleStatusChange}
                      disabled={isSaving}
                    >
                      {statusDefault !== 'submitted' && statusDefault !== 'interviewing' ? <MenuItem value="planned">Planned</MenuItem> : null}
                      <MenuItem value="submitted">Submitted</MenuItem>
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
                      onChange={handleStatusChange}
                      disabled={isSaving}
                    >
                      <MenuItem value="" disabled>Review status</MenuItem>
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
                {hasDownloadableResume ? (
                  <Tooltip title={isInvalidReviewJob ? 'Marked as not applicable' : isResumeDownloaded ? 'Download again' : 'Download resume'}>
                    <Box component="span" sx={{ display: 'inline-flex' }}>
                      <IconButton
                        component={isInvalidReviewJob ? 'button' : 'a'}
                        href={downloadUrl || undefined}
                        download={downloadUrl ? downloadFilename : undefined}
                        target={downloadUrl ? '_blank' : undefined}
                        rel={downloadUrl ? 'noopener noreferrer' : undefined}
                        disabled={isInvalidReviewJob}
                        aria-label={isResumeDownloaded ? 'Download resume again' : 'Download resume'}
                        color={isResumeDownloaded ? 'success' : 'primary'}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isInvalidReviewJob) return;
                          onResumeDownload(job.tailoredResume.id);
                        }}
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
                {showUpdateExternalLinkAction ? (
                  <Button
                    disabled={isUpdatingLinkedInJob}
                    onClick={openLinkDialog}
                    size="small"
                    startIcon={<LinkIcon />}
                    variant="outlined"
                    sx={{
                      minHeight: 32,
                      whiteSpace: 'nowrap',
                      borderColor: '#38bdf8',
                      color: '#075985',
                      bgcolor: '#f0f9ff',
                      fontWeight: 800,
                      '&:hover': {
                        borderColor: '#0284c7',
                        bgcolor: '#e0f2fe',
                      },
                    }}
                  >
                    Update job link
                  </Button>
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
      <Dialog open={isLinkDialogOpen} onClose={closeLinkDialog} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={submitExternalUrl}>
          <DialogTitle>Update job link</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.25, pt: 1 }}>
            <TextField
              autoFocus
              disabled={isUpdatingLinkedInJob}
              error={Boolean(externalUrlError)}
              fullWidth
              helperText={externalUrlError || 'Paste the external application URL.'}
              label="External URL"
              onChange={(event) => {
                setExternalUrl(event.target.value);
                if (externalUrlError) setExternalUrlError('');
              }}
              placeholder="https://company.com/careers/job"
              value={externalUrl}
            />
          </DialogContent>
          <DialogActions>
            <Button disabled={isUpdatingLinkedInJob} onClick={closeLinkDialog}>Cancel</Button>
            <Button disabled={isUpdatingLinkedInJob} type="submit" variant="contained">Update</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
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
  if (status === 'processing') return 'Tailoring now';
  if (status === 'dead_letter') return 'Failed';
  return 'Requested';
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

function externalUrlValidationError(value) {
  if (!value) return 'Enter an external application URL.';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'URL must start with http or https.';
    if (isLinkedInUrl(value)) return 'External link must not be a LinkedIn URL.';
    return '';
  } catch {
    return 'Enter a valid URL.';
  }
}

function isLinkedInUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().endsWith('linkedin.com');
  } catch {
    return false;
  }
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
