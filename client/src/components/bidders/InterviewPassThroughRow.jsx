import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { INTERVIEW_STAGES } from '../bids/bidConstants.js';
import { formatDateTime } from '../../lib/formatters.js';

export default function InterviewPassThroughRow({ interview }) {
  const stage = INTERVIEW_STAGES.find((item) => item.value === interview.interviewStage);
  const job = interview.job || {};
  const profile = interview.profile || {};

  return (
    <Paper variant="outlined" sx={{ p: 1, display: 'grid', gap: 0.75 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) max-content', gap: 1, alignItems: 'start' }}>
        <Box minWidth={0}>
          <Typography fontWeight={600} variant="body2" noWrap>
            {job.title || 'Untitled role'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {job.company || 'Unknown company'}{profile.name ? ` · ${profile.name}` : ''}
          </Typography>
        </Box>
        {job.url ? (
          <Button
            component="a"
            href={job.url}
            target="_blank"
            rel="noreferrer"
            size="small"
            startIcon={<OpenInNewIcon />}
            variant="outlined"
            sx={{ minHeight: 30, whiteSpace: 'nowrap' }}
          >
            Job
          </Button>
        ) : null}
      </Box>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <Chip label={stage?.label || interview.status} size="small" sx={{ bgcolor: 'rgba(0, 103, 192, 0.10)', color: '#005A9E', fontWeight: 600 }} />
        <Chip
          label={interview.interviewNextAt ? formatDateTime(interview.interviewNextAt) : formatDateTime(interview.updatedAt)}
          size="small"
          sx={{ bgcolor: '#ECFDF5', color: '#486860', fontWeight: 600 }}
        />
      </Stack>
    </Paper>
  );
}
