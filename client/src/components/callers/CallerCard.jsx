import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, CardContent, Chip, Paper, Stack, Typography } from '@mui/material';
import { INTERVIEW_STAGES } from '../bids/bidConstants.js';
import BidderSummaryStat from '../bidders/BidderSummaryStat.jsx';
import { formatDateTime } from '../../lib/formatters.js';

export default function CallerCard({ caller }) {
  const assignments = caller.assignments || [];
  const upcomingCount = Number(caller.upcomingInterviews || 0);
  const activeCount = Number(caller.activeInterviews || assignments.length || 0);
  const unscheduledCount = Math.max(0, assignments.length - upcomingCount);
  const technicalCount = assignments.filter((assignment) => assignment.interviewStage === 'technical').length;
  const finalCount = assignments.filter((assignment) => assignment.interviewStage === 'final').length;

  return (
    <Card variant="outlined" sx={{ boxShadow: 1 }}>
      <CardContent sx={{ display: 'grid', gap: 1.25 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'start' }}>
          <Box minWidth={0}>
            <Typography fontWeight={600} noWrap>
              {caller.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active caller
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end" useFlexGap>
            <Chip
              icon={<AssignmentTurnedInIcon />}
              label={`${activeCount.toLocaleString()} active`}
              size="small"
              sx={{ bgcolor: '#edf0ff', color: '#343f91', fontWeight: 600, '& .MuiChip-icon': { color: '#343f91' } }}
            />
            <Chip
              icon={<CalendarMonthIcon />}
              label={`${upcomingCount.toLocaleString()} scheduled`}
              size="small"
              sx={{ bgcolor: '#ECFDF5', color: '#486860', fontWeight: 600, '& .MuiChip-icon': { color: '#486860' } }}
            />
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
            gap: 0.75,
          }}
        >
          <BidderSummaryStat label="Assigned" value={assignments.length} />
          <BidderSummaryStat label="Scheduled" value={upcomingCount} />
          <BidderSummaryStat label="Technical" value={technicalCount} />
          <BidderSummaryStat label="Final" value={finalCount} />
        </Box>

        <Accordion variant="outlined" disableGutters sx={{ borderRadius: 1, overflow: 'hidden', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 42, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600}>
                Assigned interviews
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {assignments.length.toLocaleString()}
              </Typography>
              {unscheduledCount ? (
                <Typography variant="caption" color="text.secondary">
                  {unscheduledCount.toLocaleString()} unscheduled
                </Typography>
              ) : null}
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, display: 'grid', gap: 0.75 }}>
            {!assignments.length ? (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(246, 248, 251, 0.86)' }}>
                <Typography variant="body2" color="text.secondary">
                  No assigned interviews.
                </Typography>
              </Paper>
            ) : null}
            <Stack spacing={0.75}>
              {assignments.slice(0, 8).map((assignment) => (
                <CallerAssignment key={assignment.id} assignment={assignment} />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
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
          <Typography fontWeight={600} variant="body2" noWrap>
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
        <Chip label={stage?.label || 'Screening'} size="small" sx={{ bgcolor: 'rgba(0, 103, 192, 0.10)', color: '#005A9E', fontWeight: 600 }} />
        <Chip
          label={assignment.interviewNextAt ? formatDateTime(assignment.interviewNextAt) : 'No date'}
          size="small"
          sx={{ bgcolor: '#ECFDF5', color: '#486860', fontWeight: 600 }}
        />
      </Stack>
    </Paper>
  );
}

function externalUrl(value) {
  return /^https?:\/\//i.test(String(value || '')) ? value : '';
}
