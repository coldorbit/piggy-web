import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
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
import { copyJobDescription, jobDescriptionText } from '../../lib/jobDescription.js';
import { authUrl } from '../../lib/api.js';

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

export default function BidJobCard({
  accent,
  draft,
  isSaving,
  isTailoring,
  job,
  statusDefault,
  showStatusControl = true,
  showAppliedAction = false,
  showTailorAction = false,
  onDraftChange,
  onHiddenChange,
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
  const tailoringInFlight = tailoredStatus === 'requested' || tailoredStatus === 'processing';
  const hasTailoringRequest = tailoringInFlight || tailoredStatus === 'ready';
  const downloadUrl =
    tailoredStatus === 'ready' && job.tailoredResume?.filePath
      ? authUrl(`/api/bid/tailored-resumes/${encodeURIComponent(job.tailoredResume.id)}/download`)
      : '';

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

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: job.bid ? `4px solid ${accent.main}` : '4px solid transparent',
        boxShadow: 1,
        transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
        '&:hover': {
          boxShadow: 2,
          transform: 'translateY(-1px)',
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
                maxWidth: '100%',
                textDecoration: 'none',
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
            <Chip label={job.source} size="small" sx={sourceChipSx} />
            <Chip
              label={formatDate(job.postedAt || job.scrapedAt)}
              size="small"
              sx={{ bgcolor: '#f7ead1', color: '#70400d', fontWeight: 700 }}
            />
            <Chip
              label={bidChipLabel}
              size="small"
              sx={
                job.bid || draft.status !== 'planned'
                  ? { bgcolor: accent.soft, color: accent.dark, fontWeight: 800 }
                  : { bgcolor: '#e7ecf0', color: '#303942', fontWeight: 700 }
              }
            />
            {tailoredStatus ? (
              <Chip
                label={tailoredStatusLabel(tailoredStatus)}
                size="small"
                sx={tailoredStatusSx(tailoredStatus)}
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
                Applied
              </Button>
            ) : null}
            {downloadUrl ? (
              <Button
                component="a"
                href={downloadUrl}
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
            <Tooltip title="Copy description">
              <span>
                <IconButton
                  disabled={!jobDescriptionText(job)}
                  onClick={() => copyJobDescription(job)}
                  aria-label="Copy job description"
                  sx={iconButtonSx}
                >
                <ContentCopyIcon />
              </IconButton>
            </span>
          </Tooltip>
            {showTailorAction ? (
              <Button
                disabled={isTailoring || hasTailoringRequest}
                onClick={() => onTailorResume(job)}
                size="small"
                startIcon={<AutoAwesomeIcon />}
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
  if (status === 'ready') return 'Tailored ready';
  if (status === 'processing') return 'Tailoring now';
  if (status === 'dead_letter') return 'Tailoring failed';
  return 'Tailoring requested';
}

function tailoredStatusSx(status) {
  if (status === 'ready') return { bgcolor: '#e6f4ee', color: '#14583f', fontWeight: 800 };
  if (status === 'dead_letter') return { bgcolor: '#fde9e5', color: '#8a2f1d', fontWeight: 800 };
  if (status === 'processing') return { bgcolor: '#fff1d6', color: '#70400d', fontWeight: 800 };
  return { bgcolor: '#edf0ff', color: '#343f91', fontWeight: 800 };
}

function sourceChipStyles(source) {
  const sourceKey = String(source || '').trim().toLowerCase();
  const fallbackIndex = [...sourceKey].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SOURCE_CHIP_FALLBACKS.length;

  return {
    ...(SOURCE_CHIP_STYLES[sourceKey] || SOURCE_CHIP_FALLBACKS[fallbackIndex]),
    fontWeight: 800,
  };
}
