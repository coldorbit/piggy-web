import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Card, CardContent, Chip, Paper, Stack, Typography } from '@mui/material';
import { INTERVIEW_STAGES } from '../bids/bidConstants.js';
import { formatDateTime } from '../../lib/formatters.js';

export default function CallerCard({ caller }) {
  const assignments = caller.assignments || [];

  return (
    <Card variant="outlined" sx={{ boxShadow: 1 }}>
      <CardContent sx={{ display: 'grid', gap: 1.25 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'start' }}>
          <Box minWidth={0}>
            <Typography fontWeight={900} noWrap>
              {caller.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active caller
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end" useFlexGap>
            <Chip
              icon={<AssignmentTurnedInIcon />}
              label={`${caller.activeInterviews || 0} active`}
              size="small"
              sx={{ bgcolor: '#edf0ff', color: '#343f91', fontWeight: 900, '& .MuiChip-icon': { color: '#343f91' } }}
            />
            <Chip
              icon={<CalendarMonthIcon />}
              label={`${caller.upcomingInterviews || 0} scheduled`}
              size="small"
              sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 900, '& .MuiChip-icon': { color: '#0F766E' } }}
            />
          </Stack>
        </Box>

        <Stack spacing={0.75}>
          {!assignments.length ? (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#F8FAFC' }}>
              <Typography variant="body2" color="text.secondary">
                No assigned interviews.
              </Typography>
            </Paper>
          ) : null}
          {assignments.map((assignment) => (
            <CallerAssignment key={assignment.id} assignment={assignment} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function CallerAssignment({ assignment }) {
  const stage = INTERVIEW_STAGES.find((item) => item.value === assignment.interviewStage);
  const job = assignment.job || {};
  const profile = assignment.profile || {};
  const meetingLink = externalUrl(assignment.meetingLink);

  return (
    <Paper variant="outlined" sx={{ p: 1, display: 'grid', gap: 0.75, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) max-content', gap: 1, alignItems: 'start' }}>
        <Box minWidth={0}>
          <Typography fontWeight={900} variant="body2" noWrap>
            {job.title || 'Untitled role'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {job.company || 'Unknown company'}{profile.name ? ` · ${profile.name}` : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
          {meetingLink ? (
            <Button
              component="a"
              href={meetingLink}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<OpenInNewIcon />}
              variant="contained"
              sx={{ minHeight: 30, whiteSpace: 'nowrap' }}
            >
              Join
            </Button>
          ) : null}
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
      </Box>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <Chip label={stage?.label || 'Screening'} size="small" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 900 }} />
        <Chip
          label={assignment.interviewNextAt ? formatDateTime(assignment.interviewNextAt) : 'No date'}
          size="small"
          sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 800 }}
        />
      </Stack>
    </Paper>
  );
}

function externalUrl(value) {
  return /^https?:\/\//i.test(String(value || '')) ? value : '';
}
