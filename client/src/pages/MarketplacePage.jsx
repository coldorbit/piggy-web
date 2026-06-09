import HandshakeIcon from '@mui/icons-material/Handshake';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { formatDateTime } from '../lib/formatters.js';
import { useMarketplace } from '../lib/api.js';

export default function MarketplacePage() {
  const [tab, setTab] = useState('matches');
  const [search, setSearch] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { data, isLoading, error } = useMarketplace();
  const participants = data?.participants || [];
  const interviews = data?.interviews || [];
  const callers = data?.callers || [];
  const matches = data?.matches || [];

  const filtered = useMemo(() => {
    const pattern = search.trim().toLowerCase();
    const contains = (values) => !pattern || values.filter(Boolean).some((value) => String(value).toLowerCase().includes(pattern));
    return {
      participants: participants.filter((row) => contains([row.displayName, row.username, row.participantRole, row.reviewStatus])),
      interviews: interviews.filter((row) => contains([row.title, row.company, row.ownerUsername, row.reviewStatus, row.matchStatus])),
      callers: callers.filter((row) => contains([row.callerName, row.skills, row.ownerUsername, row.reviewStatus, row.availabilityStatus])),
      matches: matches.filter((row) =>
        contains([row.status, row.outcomeStatus, row.offerStatus, row.interviewOpportunity?.title, row.interviewOpportunity?.company, row.callerProfile?.callerName]),
      ),
    };
  }, [callers, interviews, matches, participants, search]);

  useEffect(() => {
    setHeaderSearch({
      isVisible: true,
      placeholder: 'Search marketplace',
      value: search,
      onChange: setSearch,
    });
  }, [search, setHeaderSearch]);

  useEffect(() => () => setHeaderSearch(EMPTY_HEADER_SEARCH), [setHeaderSearch]);

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      <Paper variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 1, boxShadow: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={900}>Managed Interview Marketplace</Typography>
          <Typography color="text.secondary" variant="body2">
            Mock data for reviewing participants, interview opportunities, caller profiles, and controlled matches.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Metric icon={<PendingActionsIcon />} label="Pending review" value={[...participants, ...interviews, ...callers].filter((row) => row.reviewStatus === 'pending').length} />
          <Metric icon={<HandshakeIcon />} label="Matches" value={matches.length} />
          <Metric icon={<ScheduleIcon />} label="Scheduled" value={matches.filter((match) => match.status === 'scheduled').length} />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ boxShadow: 1 }}>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable">
          <Tab label="Matches" value="matches" />
          <Tab label="Interviews" value="interviews" />
          <Tab label="Callers" value="callers" />
          {data?.canManage ? <Tab label="Participants" value="participants" /> : null}
        </Tabs>
      </Paper>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && tab === 'matches' ? <ResponsiveGrid>{filtered.matches.map((match) => <MatchCard key={match.id} match={match} />)}</ResponsiveGrid> : null}
      {!isLoading && tab === 'interviews' ? <ResponsiveGrid>{filtered.interviews.map((interview) => <InterviewCard key={interview.id} interview={interview} />)}</ResponsiveGrid> : null}
      {!isLoading && tab === 'callers' ? <ResponsiveGrid>{filtered.callers.map((caller) => <CallerCard key={caller.id} caller={caller} />)}</ResponsiveGrid> : null}
      {!isLoading && tab === 'participants' ? <ResponsiveGrid>{filtered.participants.map((participant) => <ParticipantCard key={participant.id} participant={participant} />)}</ResponsiveGrid> : null}
    </Box>
  );
}

function ParticipantCard({ participant }) {
  return (
    <RecordCard title={participant.displayName} subtitle={[participant.username, labelize(participant.participantRole)].filter(Boolean).join(' · ')} chips={[statusChip(participant.reviewStatus), statusChip(participant.riskStatus)]}>
      <Typography variant="body2" color="text.secondary">{participant.publicNotes || 'No notes.'}</Typography>
    </RecordCard>
  );
}

function InterviewCard({ interview }) {
  return (
    <RecordCard title={interview.title} subtitle={[interview.company, interview.ownerUsername].filter(Boolean).join(' · ')} chips={[statusChip(interview.reviewStatus), statusChip(interview.matchStatus)]}>
      <DetailRows rows={[
        ['Stage', interview.stage],
        ['Format', interview.format],
        ['Timezone', interview.timezone],
        ['Budget', interview.budget],
        ['Availability', interview.availabilityWindows],
        ['Required skills', interview.requiredSkills],
      ]} />
      <Typography variant="body2" color="text.secondary">{interview.notes || 'No notes.'}</Typography>
    </RecordCard>
  );
}

function CallerCard({ caller }) {
  return (
    <RecordCard title={caller.callerName} subtitle={[caller.ownerUsername, caller.timezone].filter(Boolean).join(' · ')} chips={[statusChip(caller.reviewStatus), statusChip(caller.availabilityStatus)]}>
      <DetailRows rows={[
        ['Skills', caller.skills],
        ['Languages', caller.languages],
        ['Experience', caller.experience],
        ['Availability', caller.availabilityWindows],
        ['Rate', caller.rateExpectation],
        ['Constraints', caller.constraints],
      ]} />
    </RecordCard>
  );
}

function MatchCard({ match }) {
  return (
    <RecordCard title={match.interviewOpportunity?.title || 'Untitled interview'} subtitle={[match.interviewOpportunity?.company, match.callerProfile?.callerName].filter(Boolean).join(' · ')} chips={[statusChip(match.status), statusChip(match.outcomeStatus), statusChip(match.offerStatus)]}>
      <DetailRows rows={[
        ['Scheduled', formatDateTime(match.scheduledAt)],
        ['Caller confirmation', match.callerConfirmationStatus],
        ['Interview confirmation', match.interviewConfirmationStatus],
        ['Offer', [match.offerAmount, match.offerTerms].filter(Boolean).join(' · ')],
        ['Payment', match.paymentStatus],
        ['Payout', match.payoutStatus],
      ]} />
    </RecordCard>
  );
}

function RecordCard({ children, chips, subtitle, title }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, display: 'grid', gap: 1, boxShadow: 1, alignContent: 'start' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
        <Box minWidth={0}>
          <Typography fontWeight={900} noWrap>{title}</Typography>
          <Typography color="text.secondary" variant="caption" noWrap>{subtitle}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">{chips}</Stack>
      </Box>
      {children}
    </Paper>
  );
}

function ResponsiveGrid({ children }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>{children}</Box>;
}

function DetailRows({ rows }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.45 }}>
      {rows.filter(([, value]) => Boolean(value)).map(([label, value]) => (
        <Typography key={label} variant="caption" color="text.secondary">
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 900 }}>{label}: </Box>{value}
        </Typography>
      ))}
    </Box>
  );
}

function Metric({ icon, label, value }) {
  return <Chip icon={icon} label={`${label}: ${value}`} sx={{ bgcolor: '#f8fafc', border: 1, borderColor: 'divider', fontWeight: 800 }} />;
}

function LoadingState() {
  return (
    <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
      <CircularProgress size={22} />
      <Typography color="text.secondary">Loading marketplace...</Typography>
    </Paper>
  );
}

function statusChip(status) {
  return <Chip key={status} label={labelize(status)} size="small" sx={{ bgcolor: statusColor(status).bg, color: statusColor(status).fg, fontWeight: 800 }} />;
}

function statusColor(status) {
  if (['approved', 'confirmed', 'completed', 'offer_accepted', 'paid'].includes(status)) return { bg: '#dcfce7', fg: '#166534' };
  if (['rejected', 'suspended', 'declined', 'cancelled', 'failed', 'blocked', 'no_show'].includes(status)) return { bg: '#fee2e2', fg: '#991b1b' };
  if (['needs_info', 'pending', 'pending_confirmation', 'requested', 'offer_tracking'].includes(status)) return { bg: '#fff7ed', fg: '#9a3412' };
  return { bg: '#eff6ff', fg: '#1d4ed8' };
}

function labelize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
