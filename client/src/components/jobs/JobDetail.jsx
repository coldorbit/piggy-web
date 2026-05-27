import { useState } from 'react';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LaunchIcon from '@mui/icons-material/Launch';
import ReportIcon from '@mui/icons-material/Report';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { formatDateTime, spamStatusLabel } from '../../lib/formatters.js';
import { copyJobDescription, jobDescriptionText } from '../../lib/jobDescription.js';

export default function JobDetail({ job, onHiddenChange, onSpamReview }) {
  const [savingSpam, setSavingSpam] = useState(false);
  const [savingHidden, setSavingHidden] = useState(false);
  const [spamError, setSpamError] = useState('');
  const [hiddenError, setHiddenError] = useState('');

  if (!job) {
    return (
      <Paper
        variant="outlined"
        sx={{
          minHeight: 260,
          p: 3,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          boxShadow: 1,
        }}
      >
        <Typography color="text.secondary" fontWeight={700}>
          Select a job to inspect it.
        </Typography>
      </Paper>
    );
  }

  async function handleSpamReview(isSpam) {
    setSavingSpam(true);
    setSpamError('');
    try {
      await onSpamReview(job.id, isSpam);
    } catch (reviewError) {
      setSpamError(reviewError.message);
    } finally {
      setSavingSpam(false);
    }
  }

  async function handleHiddenChange(isHidden) {
    setSavingHidden(true);
    setHiddenError('');
    try {
      await onHiddenChange(job.id, isHidden);
    } catch (hiddenChangeError) {
      setHiddenError(hiddenChangeError.message);
    } finally {
      setSavingHidden(false);
    }
  }

  return (
    <Paper
      variant="outlined"
      component="aside"
      sx={{
        minHeight: 0,
        height: { lg: '100%' },
        maxHeight: { lg: '100%' },
        p: { xs: 1.25, sm: 1.5 },
        overflow: 'auto',
        boxShadow: 1,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 1,
          alignItems: 'flex-start',
        }}
      >
        <Box minWidth={0}>
          <Chip
            label={job.source}
            size="small"
            sx={{ mb: 0.75, height: 22, bgcolor: 'rgba(95, 91, 216, 0.1)', color: 'primary.dark' }}
          />
          <Typography variant="h6" fontWeight={900} lineHeight={1.2}>
            {job.title || 'Untitled role'}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {[job.company, job.location].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} justifyContent="flex-end" sx={{ justifySelf: 'end' }}>
          <Tooltip title="Copy description">
            <span>
              <IconButton
                disabled={!jobDescriptionText(job)}
                onClick={() => copyJobDescription(job)}
                aria-label="Copy job description"
                size="small"
                sx={detailActionButtonSx}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Open job">
            <IconButton
              href={job.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open job"
              size="small"
              sx={detailActionButtonSx}
            >
              <LaunchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Divider sx={{ my: 1.25 }} />

      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
          gap: 0.75,
          m: 0,
        }}
      >
        <DetailField label="Posted" value={formatDateTime(job.postedAt)} />
        <DetailField label="Scraped" value={formatDateTime(job.scrapedAt)} />
        <DetailField label="Category" value={job.category || 'Not set'} />
        <DetailField label="Spam Review" value={spamStatusLabel(job)} />
        <DetailField label="Visibility" value={job.isHidden ? 'Hidden' : 'Visible'} />
      </Box>

      <Box sx={{ my: 1.25, display: 'flex', flexWrap: 'wrap', columnGap: 1, rowGap: 0.75 }} aria-label="Job actions">
        <Button
          color={job.isHidden ? 'primary' : 'inherit'}
          disabled={savingHidden}
          onClick={() => handleHiddenChange(!job.isHidden)}
          startIcon={job.isHidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
          variant={job.isHidden ? 'contained' : 'outlined'}
        >
          {job.isHidden ? 'Unhide' : 'Hide'}
        </Button>
        <Button
          color="success"
          disabled={savingSpam}
          onClick={() => handleSpamReview(false)}
          startIcon={<CheckCircleIcon />}
          variant={job.isSpam === false ? 'contained' : 'outlined'}
        >
          Not spam
        </Button>
        <Button
          color="error"
          disabled={savingSpam}
          onClick={() => handleSpamReview(true)}
          startIcon={<ReportIcon />}
          variant={job.isSpam === true ? 'contained' : 'outlined'}
        >
          Spam
        </Button>
        <IconButton
          disabled={savingSpam || job.isSpam === null}
          onClick={() => handleSpamReview(null)}
          title="Clear spam review"
        >
          <CancelIcon />
        </IconButton>
      </Box>

      {spamError ? <Alert severity="error" sx={{ mb: 2 }}>{spamError}</Alert> : null}
      {hiddenError ? <Alert severity="error" sx={{ mb: 2 }}>{hiddenError}</Alert> : null}

      <Box>
        <Typography variant="subtitle2" fontWeight={900} gutterBottom>
          Listing Text
        </Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.62, color: 'text.primary' }}>
          {job.listingText || job.rawJob?.description || 'No listing text stored.'}
        </Typography>
      </Box>
    </Paper>
  );
}

const detailActionButtonSx = {
  width: 34,
  height: 34,
  flexShrink: 0,
  border: 1,
  borderColor: 'divider',
};

function DetailField({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ px: 1, py: 0.75, bgcolor: 'rgba(246, 249, 248, 0.72)' }} component="div">
      <Typography component="dt" variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" fontWeight={900} sx={{ m: 0, lineHeight: 1.25 }}>
        {value}
      </Typography>
    </Paper>
  );
}
