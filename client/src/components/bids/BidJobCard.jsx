import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Box,
  Avatar,
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
import { authUrl } from '../../lib/api.js';
import { BID_TABS } from './bidConstants.js';

const SOURCE_CHIP_STYLES = {
  builtin: { bgcolor: '#e8f2ff', color: '#174379' },
  'built in': { bgcolor: '#e8f2ff', color: '#174379' },
  diversityjobs: { bgcolor: '#fde9e5', color: '#8a2f1d' },
  hiringcafe: { bgcolor: '#fff1d6', color: '#70400d' },
  jobright: { bgcolor: '#e6f4ee', color: '#14583f' },
  linkedin: { bgcolor: '#e5f1fb', color: '#075b8f' },
  remotehunter: { bgcolor: '#edf0ff', color: '#343f91' },
  remoteyeah: { bgcolor: '#e2f6f5', color: '#17615e' },
  simplify: { bgcolor: '#f1eafb', color: '#4f357e' },
};

const SOURCE_CHIP_FALLBACKS = [
  { bgcolor: '#f3f5f7', color: '#303942' },
  { bgcolor: '#f8e0e7', color: '#7c263a' },
  { bgcolor: '#e7ecf0', color: '#52606d' },
  { bgcolor: '#f7ead1', color: '#70400d' },
];

const SOURCE_DOMAINS = {
  builtin: 'builtin.com',
  'built in': 'builtin.com',
  diversityjobs: 'diversityjobs.com',
  hiringcafe: 'hiring.cafe',
  jobright: 'jobright.ai',
  linkedin: 'linkedin.com',
  remotehunter: 'remotehunter.io',
  remoteyeah: 'remoteyeah.com',
  simplify: 'simplify.jobs',
};

export default function BidJobCard({
  accent,
  activeTab,
  currentUser,
  draft,
  isSaving,
  isTailoring,
  isSelected = false,
  job,
  statusDefault,
  showBidStatusChip = true,
  showStatusControl = true,
  showAppliedAction = false,
  showTailorAction = false,
  onDraftChange,
  onHiddenChange,
  onSelectedChange,
  onStatusChange,
  onTailorResume,
}) {
  const bidChipLabel = job.bid
    ? `Bid ${formatDate(job.bid.bidAt)}`
    : draft.status === 'planned'
      ? 'Not bid yet'
      : `Bid ${statusLabel(draft.status)}`;
  const sourceChipSx = sourceChipStyles(job.source);
  const tailoredStatus = job.tailoredResume?.status || '';
  const appliedByLabel = appliedByChipLabel(job.bid, currentUser);
  const tailoringInFlight = tailoredStatus === 'requested' || tailoredStatus === 'processing';
  const hasTailoringRequest = tailoringInFlight || tailoredStatus === 'ready';
  const downloadUrl =
    tailoredStatus === 'ready' && job.tailoredResume?.filePath
      ? authUrl(`/api/bid/tailored-resumes/${encodeURIComponent(job.tailoredResume.id)}/download`)
      : '';
  const downloadFilename = job.tailoredResume?.filePath ? String(job.tailoredResume.filePath).split('/').pop() : 'tailored-resume.pdf';

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

  function handleCardClick(event) {
    if (isInteractiveTarget(event.target, event.currentTarget)) return;
    onSelectedChange(job.id);
  }

  function handleCardKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (isInteractiveTarget(event.target, event.currentTarget)) return;
    event.preventDefault();
    onSelectedChange(job.id);
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
        tabIndex={0}
        aria-pressed={isSelected}
        sx={{
          borderColor: isSelected ? accent.main : 'divider',
          borderLeft: job.bid || isSelected ? `4px solid ${accent.main}` : '4px solid transparent',
          bgcolor: isSelected ? accent.soft : 'background.paper',
          boxShadow: isSelected ? 2 : 1,
          cursor: 'pointer',
          transition: 'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
          '&:hover': {
            boxShadow: 2,
            transform: 'translateY(-1px)',
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
              <SourceChip source={job.source} sourceUrl={job.sourceUrl} sx={sourceChipSx} />
              <Chip
                label={formatDate(job.postedAt || job.scrapedAt)}
                size="small"
                sx={{ bgcolor: '#f7ead1', color: '#70400d', fontWeight: 700 }}
              />
              {showBidStatusChip && (job.bid || draft.status !== 'planned') ? (
                <Chip
                  label={bidChipLabel}
                  size="small"
                  sx={{ bgcolor: accent.soft, color: accent.dark, fontWeight: 800 }}
                />
              ) : null}
              {activeTab !== BID_TABS.done && tailoredStatus ? (
                <Chip
                  label={tailoredStatusLabel(tailoredStatus)}
                  size="small"
                  sx={tailoredStatusSx(tailoredStatus)}
                />
              ) : null}
              {activeTab === BID_TABS.done && appliedByLabel ? (
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
                    {statusDefault !== 'submitted' ? <MenuItem value="planned">Planned</MenuItem> : null}
                    <MenuItem value="submitted">Submitted</MenuItem>
                    <MenuItem value="interviewing">Interviewing</MenuItem>
                    <MenuItem value="won">Won</MenuItem>
                    <MenuItem value="lost">Lost</MenuItem>
                  </Select>
                </FormControl>
              ) : null}
              {showAppliedAction ? (
                <Button
                  disabled={draft.status === 'submitted'}
                  onClick={handleApplied}
                  size="small"
                  startIcon={<CheckCircleIcon />}
                  variant="contained"
                  sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
                >
                  Mark as applied
                </Button>
              ) : null}
              {downloadUrl ? (
                <Button
                  component="a"
                  href={downloadUrl}
                  download={downloadFilename}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  startIcon={<DownloadIcon />}
                  variant="outlined"
                  sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
                >
                  Download
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
                <Button
                  disabled={isTailoring || hasTailoringRequest}
                  onClick={() => onTailorResume(job)}
                  size="small"
                  startIcon={isTailoring ? <CircularProgress color="inherit" size={16} /> : <AutoAwesomeIcon />}
                  variant="outlined"
                  sx={{ minHeight: 32, whiteSpace: 'nowrap' }}
                >
                  {tailoredStatus === 'dead_letter' ? 'Retry' : hasTailoringRequest ? 'Requested' : 'Tailor'}
                </Button>
              ) : null}
            </Stack>
          </Box>
        </CardContent>
        {job.bid ? (
          <CardActions sx={{ px: 1, py: 0.5, pt: 0, color: 'text.secondary' }}>
            <Typography variant="caption">This profile has already bid on this job. Updates edit the existing bid.</Typography>
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

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
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

function appliedByChipLabel(bid, currentUser) {
  if (!bid?.userId) return '';
  if (String(bid.userId) === String(currentUser?.id)) return 'by me';
  return `by ${bid.user?.username || 'unknown'}`;
}

function isInteractiveTarget(target, cardElement) {
  const interactiveElement = target.closest(
    'a, button, input, textarea, select, [role="button"], [role="checkbox"], [role="combobox"], .MuiSelect-select',
  );
  return Boolean(interactiveElement && interactiveElement !== cardElement);
}

function SourceChip({ source, sourceUrl, sx }) {
  return (
    <Chip
      avatar={<Avatar alt={`${source} logo`} src={sourceLogoUrl(source, sourceUrl)}>{sourceInitial(source)}</Avatar>}
      label={source}
      size="small"
      sx={{
        ...sx,
        maxWidth: 132,
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        '& .MuiChip-avatar': {
          width: 18,
          height: 18,
          ml: 0.6,
          mr: -0.35,
          bgcolor: 'background.paper',
          color: 'inherit',
          fontSize: 10,
          fontWeight: 900,
        },
      }}
    />
  );
}

function sourceChipStyles(source) {
  const sourceKey = String(source || '').trim().toLowerCase();
  const fallbackIndex = [...sourceKey].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SOURCE_CHIP_FALLBACKS.length;

  return {
    ...(SOURCE_CHIP_STYLES[sourceKey] || SOURCE_CHIP_FALLBACKS[fallbackIndex]),
    fontWeight: 800,
  };
}

function sourceLogoUrl(source, sourceUrl) {
  const domain = domainFromUrl(sourceUrl) || SOURCE_DOMAINS[String(source || '').toLowerCase()];
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function domainFromUrl(value) {
  if (!value) return '';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function sourceInitial(source) {
  return String(source || '?').trim().charAt(0).toUpperCase();
}
