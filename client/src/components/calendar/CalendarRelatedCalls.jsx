import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Alert, Box, Button, Chip, LinearProgress, Paper, Typography } from '@mui/material';
import { formatDateTimeInDefaultTimezone } from '../../lib/formatters.js';
import { useRelatedCalendarCalls } from '../../lib/api.js';

export default function CalendarRelatedCalls({ event }) {
  const { data, error, isLoading } = useRelatedCalendarCalls(event?.interviewId);
  const calls = data?.calls || [];
  const now = Date.now();
  const upcoming = calls
    .filter((call) => new Date(call.startsAt).getTime() >= now)
    .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
  const previous = calls
    .filter((call) => new Date(call.startsAt).getTime() < now)
    .sort((left, right) => new Date(right.startsAt) - new Date(left.startsAt));
  const otherCallCount = calls.filter((call) => !isSelectedCall(call, event)).length;

  return (
    <Paper variant="outlined" sx={{ bgcolor: 'action.hover', mt: { xs: 1, md: 0 }, overflow: 'hidden' }}>
      <Box sx={{ alignItems: 'flex-start', display: 'flex', gap: 1, justifyContent: 'space-between', p: 1.5, pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} variant="subtitle2">
            Same-company calls
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {data ? `${data.profile?.name || 'Profile'} at ${data.company}` : 'Loading call history...'}
          </Typography>
        </Box>
        {data ? <Chip label={`${otherCallCount} related`} size="small" variant="outlined" /> : null}
      </Box>

      {isLoading ? <LinearProgress aria-label="Loading related calls" /> : null}
      {error ? <Alert severity="error" sx={{ m: 1.5, mt: 0 }}>{error.message}</Alert> : null}
      {!isLoading && !error && calls.length <= 1 ? (
        <Typography color="text.secondary" sx={{ px: 1.5, pb: 1.5 }} variant="body2">
          No other calls for this profile at this company yet.
        </Typography>
      ) : null}
      {!error && calls.length > 1 ? (
        <Box sx={{ display: 'grid', gap: 1.5, px: 1.5, pb: 1.5 }}>
          <CallGroup calls={upcoming} event={event} label="Upcoming" />
          <CallGroup calls={previous} event={event} label="Previous" />
        </Box>
      ) : null}
    </Paper>
  );
}

function CallGroup({ calls, event, label }) {
  if (!calls.length) return null;
  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <Typography color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5, textTransform: 'uppercase' }} variant="caption">
        {label}
      </Typography>
      {calls.map((call, index) => (
        <TimelineCallCard
          call={call}
          isLast={index === calls.length - 1}
          key={call.id}
          selected={isSelectedCall(call, event)}
        />
      ))}
    </Box>
  );
}

function TimelineCallCard({ call, isLast, selected }) {
  const meetingUrl = externalUrl(call.meetingLink);
  const jobUrl = externalUrl(call.jobUrl);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr)', gap: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 1 }} aria-hidden="true">
        <Box sx={{ bgcolor: selected ? 'primary.main' : 'text.disabled', borderRadius: '50%', height: 8, width: 8 }} />
        {!isLast ? <Box sx={{ bgcolor: 'divider', flex: 1, minHeight: 20, mt: 0.5, width: 2 }} /> : null}
      </Box>
      <Paper
        variant="outlined"
        sx={{
          bgcolor: selected ? 'action.selected' : 'background.paper',
          borderColor: selected ? 'primary.main' : 'divider',
          p: 1.25,
        }}
      >
        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'space-between' }}>
          <Typography fontWeight={700} variant="body2">
            {formatDateTimeInDefaultTimezone(call.startsAt)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected ? <Chip color="primary" label="Selected" size="small" /> : null}
            {call.stage ? <Chip label={stageLabel(call.stage)} size="small" variant="outlined" /> : null}
          </Box>
        </Box>
        <Typography sx={{ mt: 0.4 }} variant="body2">
          {call.title}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {durationLabel(call.durationMinutes)}{call.location ? ` · ${call.location}` : ''}
        </Typography>
        {meetingUrl || jobUrl ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
            {meetingUrl ? (
              <Button component="a" href={meetingUrl} size="small" startIcon={<OpenInNewIcon />} target="_blank" rel="noreferrer">
                Join
              </Button>
            ) : null}
            {jobUrl ? (
              <Button component="a" href={jobUrl} size="small" startIcon={<OpenInNewIcon />} target="_blank" rel="noreferrer">
                Job
              </Button>
            ) : null}
          </Box>
        ) : null}
      </Paper>
    </Box>
  );
}

function isSelectedCall(call, event) {
  if (call.interviewCallId && event?.interviewCallId) return String(call.interviewCallId) === String(event.interviewCallId);
  if (call.occurrenceLogId && event?.occurrenceLogId) return String(call.occurrenceLogId) === String(event.occurrenceLogId);
  return String(call.id) === String(event?.sourceId || '');
}

function stageLabel(value) {
  return String(value || '').split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function durationLabel(value) {
  const minutes = Number(value || 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

function externalUrl(value) {
  return /^https?:\/\//i.test(String(value || '')) ? String(value) : '';
}
