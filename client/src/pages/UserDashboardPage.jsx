import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import BadgeIcon from '@mui/icons-material/Badge';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import StyleIcon from '@mui/icons-material/Style';
import TodayIcon from '@mui/icons-material/Today';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Skeleton,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip as MuiTooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartPanel } from '../components/adminDashboard/DashboardCharts.jsx';
import DashboardConsumptionPanel from '../components/adminDashboard/DashboardConsumptionPanel.jsx';
import DashboardMetric from '../components/adminDashboard/DashboardMetric.jsx';
import { GRAIN_OPTIONS, labelize, number, percent } from '../components/adminDashboard/dashboardFormatters.js';
import EmptyState from '../components/common/EmptyState.jsx';
import { useActionQueue, usePersonalDashboard } from '../lib/api.js';
import { formatFirstNameLastInitial } from '../lib/formatters.js';
import { canAccessConsumption } from '../lib/roles.js';
import { addDaysToDateKey, dateKeyDayOfWeek, zonedDateParts } from '../lib/timezone.js';

export default function UserDashboardPage({ currentUser }) {
  const [grain, setGrain] = useState(DEFAULT_DASHBOARD_GRAIN);
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const dashboardTimeZone = currentUser?.timezone || '';
  const dashboardFilters = useMemo(() => ({ grain, anchorDate: anchorDate.toISOString() }), [anchorDate, grain]);
  const { data: dashboard, isLoading, error } = usePersonalDashboard(dashboardFilters);
  const { data: actionQueue } = useActionQueue();
  const totals = dashboard?.totals || {};
  const activityTotals = dashboard?.activityTotals || {};
  const trend = dashboard?.trend || [];
  const periodLabel = labelForDashboardPeriod(grain, anchorDate, dashboardTimeZone);

  function movePeriod(direction) {
    setAnchorDate((current) => addDashboardPeriod(current, grain, direction));
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <DashboardHeader
        dashboard={dashboard}
        grain={grain}
        isLoading={isLoading}
        onGrainChange={setGrain}
        onMove={movePeriod}
        onToday={() => setAnchorDate(new Date())}
        periodLabel={periodLabel}
      />

      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {isLoading && !dashboard ? <LoadingPanel /> : null}
      {dashboard ? (
        <>
          <Grid container spacing={1.25}>
            <DashboardMetric icon={<AssignmentTurnedInIcon />} label="Bids" value={activityTotals.totalBids} detail={periodLabel} />
            <DashboardMetric icon={<EventAvailableIcon />} label="Interviews" value={activityTotals.interviews} detail={`Scheduled for ${periodLabel}`} />
            <DashboardMetric icon={<TodayIcon />} label="Newly scheduled" value={activityTotals.newlyScheduledInterviews} detail={`First scheduled during ${periodLabel}`} />
            <DashboardMetric icon={<EmojiEventsIcon />} label="Offers" value={totals.offers} detail={`${number(totals.lostInterviews)} closed as lost`} />
            <DashboardMetric icon={<BadgeIcon />} label="Profiles" value={totals.activeProfiles} detail={`${number(totals.totalProfiles)} total profiles`} />
            <DashboardMetric icon={<StyleIcon />} label="Tailoring" value={totals.readyTailoredResumes} detail={`${number(totals.tailoredResumeRequests)} active requests`} />
          </Grid>

          {canAccessConsumption(currentUser) ? <DashboardConsumptionPanel consumption={dashboard.consumption} /> : null}

          <ActionQueuePanel queue={actionQueue} />
          <CommandCenterPanel commandCenter={dashboard.commandCenter || {}} />

          <JourneyTimeline rows={dashboard.journeys || []} />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.35fr 0.65fr' }, gap: 1.5 }}>
            <PersonalActivityTrend trend={trend} />
            <GoalProgressPanel totals={totals} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5 }}>
            <UpcomingInterviewsTable rows={dashboard.upcomingInterviews || []} />
            <RecentApplicationsTable rows={dashboard.recentApplications || []} />
          </Box>

          <ProfilesTable rows={dashboard.profiles || []} />
        </>
      ) : null}
    </Box>
  );
}

function ActionQueuePanel({ queue }) {
  const items = queue?.items || [];
  const counts = queue?.counts || {};
  return (
    <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0, boxShadow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Box minWidth={0}>
          <Typography fontWeight={600}>Action queue</Typography>
          <Typography variant="body2" color="text.secondary">
            {number(counts.total || items.length)} deadline, follow-up, calendar, mailbox, and assignment item{Number(counts.total || items.length) === 1 ? '' : 's'}.
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Chip label={`${number(counts.byPriority?.critical || 0)} critical`} size="small" sx={{ borderRadius: 1, fontWeight: 600, bgcolor: '#FEF2F2', color: '#B91C1C' }} />
          <Chip label={`${number(counts.byPriority?.high || 0)} high`} size="small" sx={{ borderRadius: 1, fontWeight: 600, bgcolor: '#FFF7ED', color: '#C2410C' }} />
        </Stack>
      </Box>
      {items.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 0.85 }}>
          {items.slice(0, 8).map((item) => (
            <ActionQueueItem key={item.id} item={item} />
          ))}
        </Box>
      ) : (
        <EmptyState title="No open actions" detail="Deadlines, stale applications, missing links, and mailbox next steps will appear here." variant="plain" sx={{ p: 2 }} />
      )}
    </Paper>
  );
}

function ActionQueueItem({ item }) {
  return (
    <Box sx={{ p: 1, border: 1, borderColor: 'rgba(0, 0, 0, 0.09)', borderRadius: 1, bgcolor: '#FFFFFF', display: 'grid', gap: 0.35, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        <PriorityChip value={item.priority} />
        <Typography variant="body2" fontWeight={600} noWrap>{item.title || labelize(item.type)}</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" noWrap>
        {[formatFirstNameLastInitial(item.profileName, 'Unknown profile'), item.company, formatDateTime(item.dueAt)].filter(Boolean).join(' · ')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        {item.suggestedAction || item.reason}
      </Typography>
      {item.href ? (
        <Button href={item.href} size="small" sx={{ justifySelf: 'start', px: 0, fontWeight: 600 }}>
          Open
        </Button>
      ) : null}
    </Box>
  );
}

function PriorityChip({ value }) {
  const palette = value === 'critical'
    ? { bg: '#FEF2F2', color: '#B91C1C' }
    : value === 'high'
    ? { bg: '#FFF7ED', color: '#C2410C' }
    : value === 'medium'
    ? { bg: 'rgba(0, 103, 192, 0.10)', color: '#005A9E' }
    : { bg: 'rgba(246, 248, 251, 0.86)', color: '#475569' };
  return <Chip size="small" label={labelize(value)} sx={{ borderRadius: 1, fontWeight: 600, bgcolor: palette.bg, color: palette.color }} />;
}

const COMMAND_CENTER_SECTIONS = [
  {
    key: 'needsActionToday',
    title: 'Needs action today',
    empty: 'No same-day actions.',
    icon: <TodayIcon fontSize="small" />,
    color: '#0067C0',
  },
  {
    key: 'overdueAssessments',
    title: 'Overdue assessments',
    empty: 'No overdue assessments.',
    icon: <WarningAmberIcon fontSize="small" />,
    color: '#C42B1C',
  },
  {
    key: 'readyResumes',
    title: 'Resumes ready to download',
    empty: 'No undownloaded ready resumes.',
    icon: <DownloadIcon fontSize="small" />,
    color: '#486860',
  },
  {
    key: 'interviewsWithoutMeetingLinks',
    title: 'Interviews without links',
    empty: 'All active interviews have links.',
    icon: <LinkOffIcon fontSize="small" />,
    color: '#C77700',
  },
  {
    key: 'mailboxMessagesNeedingReview',
    title: 'Mailbox review',
    empty: 'No unread mailbox messages.',
    icon: <ContactMailIcon fontSize="small" />,
    color: '#7C3AED',
  },
];

function CommandCenterPanel({ commandCenter }) {
  const totalActions = COMMAND_CENTER_SECTIONS.reduce(
    (sum, section) => sum + (commandCenter[section.key]?.length || 0),
    0,
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0, boxShadow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Box minWidth={0}>
          <Typography fontWeight={600}>Command center</Typography>
          <Typography variant="body2" color="text.secondary">
            {number(totalActions)} role-specific action{totalActions === 1 ? '' : 's'} queued across profiles.
          </Typography>
        </Box>
        <Chip label="Today" size="small" sx={{ borderRadius: 1, fontWeight: 600, bgcolor: 'rgba(0, 103, 192, 0.10)', color: '#005A9E' }} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 1 }}>
        {COMMAND_CENTER_SECTIONS.map((section) => (
          <CommandCenterColumn key={section.key} section={section} rows={commandCenter[section.key] || []} />
        ))}
      </Box>
    </Paper>
  );
}

function CommandCenterColumn({ rows, section }) {
  return (
    <Box sx={{ border: 1, borderColor: 'rgba(0, 0, 0, 0.09)', borderRadius: 1, bgcolor: 'rgba(246, 248, 251, 0.86)', minWidth: 0, overflow: 'hidden' }}>
      <Box sx={{ px: 1, py: 0.85, display: 'flex', alignItems: 'center', gap: 0.75, borderBottom: 1, borderColor: 'rgba(0, 0, 0, 0.09)', bgcolor: '#FFFFFF' }}>
        <Box sx={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 1, color: section.color, bgcolor: 'rgba(246, 248, 251, 0.86)', flexShrink: 0 }}>
          {section.icon}
        </Box>
        <Box minWidth={0}>
          <Typography variant="body2" fontWeight={600} noWrap>{section.title}</Typography>
          <Typography variant="caption" color="text.secondary">{number(rows.length)} open</Typography>
        </Box>
      </Box>
      <Stack spacing={0.65} sx={{ p: 0.85 }}>
        {rows.length ? rows.slice(0, 3).map((row) => <CommandCenterItem key={`${section.key}-${row.id}`} row={row} />) : (
          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44, display: 'grid', alignContent: 'center' }}>
            {section.empty}
          </Typography>
        )}
        {rows.length > 3 ? (
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            +{number(rows.length - 3)} more
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

function CommandCenterItem({ row }) {
  const href = commandCenterHref(row);
  return (
    <Box sx={{ display: 'grid', gap: 0.35, p: 0.75, border: 1, borderColor: 'rgba(0, 0, 0, 0.09)', borderRadius: 1, bgcolor: '#FFFFFF' }}>
      <Typography variant="body2" fontWeight={600} noWrap>{row.title || 'Action item'}</Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {[formatFirstNameLastInitial(row.profileName, 'Unknown profile'), row.company].filter(Boolean).join(' · ')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75 }}>
        <Typography variant="caption" color="text.secondary" noWrap>{formatDateTime(row.dueAt)}</Typography>
        {href ? (
          <Button href={href} size="small" variant="text" sx={{ minWidth: 0, px: 0.5, fontWeight: 600 }}>
            Open
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}

function commandCenterHref(row) {
  if (!row?.href) return '';
  if (!row.secondaryId || !['mailbox_unread', 'mailbox_review'].includes(row.type)) return row.href;
  const separator = row.href.includes('?') ? '&' : '?';
  return `${row.href}${separator}messageId=${encodeURIComponent(row.secondaryId)}`;
}

function JourneyTimeline({ rows }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0, boxShadow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Box minWidth={0}>
          <Typography fontWeight={600}>Profile/job timeline</Typography>
          <Typography variant="body2" color="text.secondary">
            One story from job found through application, resume, assessment, interview, and outcome.
          </Typography>
        </Box>
      </Box>
      {rows.length ? (
        <Stack spacing={0.85}>
          {rows.map((row) => (
            <JourneyRow key={row.id} row={row} />
          ))}
        </Stack>
      ) : (
        <EmptyState title="No profile/job journeys yet" detail="Application journeys will appear after jobs are submitted." variant="plain" sx={{ p: 2 }} />
      )}
    </Paper>
  );
}

function JourneyRow({ row }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.75, p: 1, border: 1, borderColor: 'rgba(0, 0, 0, 0.09)', borderRadius: 1, bgcolor: '#FFFFFF' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' }, gap: 0.75, alignItems: 'center' }}>
        <Box minWidth={0}>
          <Typography component={row.url ? 'a' : 'span'} href={row.url || undefined} target={row.url ? '_blank' : undefined} rel={row.url ? 'noreferrer' : undefined} fontWeight={600} color="text.primary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main', textDecoration: 'underline' } }} noWrap>
            {row.title || 'Untitled role'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
            {[row.company, row.location, formatFirstNameLastInitial(row.profileName, 'Unknown profile')].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <StatusChip value={row.status} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${row.events.length}, minmax(0, 1fr))` }, gap: 0.65 }}>
        {row.events.map((event) => (
          <JourneyStep key={`${row.id}-${event.key}`} event={event} />
        ))}
      </Box>
    </Box>
  );
}

function JourneyStep({ event }) {
  const palette = journeyPalette(event.status);
  return (
    <Box sx={{ p: 0.75, border: 1, borderColor: palette.border, borderRadius: 1, bgcolor: palette.bg, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: palette.dot, flexShrink: 0 }} />
        <Typography variant="caption" fontWeight={600} noWrap>{event.label}</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
        {event.at ? formatDateTime(event.at) : labelize(event.detail || event.status)}
      </Typography>
    </Box>
  );
}

function journeyPalette(status) {
  if (status === 'done' || status === 'won') return { bg: '#ECFDF5', border: '#BBF7D0', dot: '#059669' };
  if (status === 'active') return { bg: 'rgba(0, 103, 192, 0.10)', border: 'rgba(0, 103, 192, 0.28)', dot: '#0067C0' };
  if (status === 'blocked' || status === 'lost') return { bg: '#FEF2F2', border: '#FECACA', dot: '#C42B1C' };
  return { bg: 'rgba(246, 248, 251, 0.86)', border: 'rgba(0, 0, 0, 0.09)', dot: '#94A3B8' };
}

function DashboardHeader({ dashboard, grain, isLoading, onGrainChange, onMove, onToday, periodLabel }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' }, gap: 1.25, alignItems: 'center' }}>
      <Box sx={{ display: 'grid', gap: 0.35, minWidth: 0 }}>
        <Typography color="text.secondary">
          Your profile activity, application movement, interviews, and resume tailoring queue.
        </Typography>
        {dashboard?.generatedAt ? (
          <Typography variant="caption" color="text.secondary">
            Updated {formatDateTime(dashboard.generatedAt)}
          </Typography>
        ) : null}
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent={{ xs: 'stretch', sm: 'flex-end' }} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <MuiTooltip title="Previous period">
          <IconButton aria-label="Previous dashboard period" onClick={() => onMove(-1)} sx={periodIconButtonSx}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </MuiTooltip>
        <MuiTooltip title="Next period">
          <IconButton aria-label="Next dashboard period" onClick={() => onMove(1)} sx={periodIconButtonSx}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </MuiTooltip>
        <Box sx={{ minHeight: 40, minWidth: { xs: '100%', sm: 190 }, px: 1.25, border: 1, borderColor: 'divider', borderRadius: 1, display: 'grid', alignContent: 'center', bgcolor: '#ffffff' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
            {isLoading ? 'Loading activity' : 'Activity window'}
          </Typography>
          <Typography variant="body2" fontWeight={600} noWrap>{periodLabel}</Typography>
        </Box>
        <Button onClick={onToday} startIcon={<TodayIcon fontSize="small" />} size="small" variant="outlined" sx={toolbarButtonSx}>
          Today
        </Button>
        <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
          <InputLabel>Activity period</InputLabel>
          <Select label="Activity period" value={grain} onChange={(event) => onGrainChange(event.target.value)}>
            {GRAIN_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
    </Box>
  );
}

function GoalProgressPanel({ totals }) {
  const hasGoal = Number(totals.dailyBidGoal || 0) > 0;
  const progress = hasGoal ? Math.min(Number(totals.dailyGoalProgress || 0), 1) : 0;

  return (
    <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0, boxShadow: 1 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Box minWidth={0}>
            <Typography fontWeight={600}>Daily application pace</Typography>
            <Typography variant="body2" color="text.secondary">
              {hasGoal ? `${number(totals.todayApplications)} of ${number(totals.dailyBidGoal)} today` : `${number(totals.todayApplications)} applications today`}
            </Typography>
          </Box>
          <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 1, bgcolor: '#ECFDF5', color: '#047857' }}>
            <TrendingUpIcon fontSize="small" />
          </Box>
        </Stack>
        <LinearProgress
          variant={hasGoal ? 'determinate' : 'indeterminate'}
          value={progress * 100}
          sx={{ height: 9, borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.09)', '& .MuiLinearProgress-bar': { borderRadius: 1 } }}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
          <MiniStat label="Planned" value={totals.plannedApplications} />
          <MiniStat label="7 days" value={totals.weekApplications} />
          <MiniStat label="Ready resumes" value={totals.readyTailoredResumes} />
        </Box>
      </Stack>
    </Paper>
  );
}

function MiniStat({ label, value }) {
  return (
    <Box sx={{ p: 1, border: 1, borderColor: 'rgba(0, 0, 0, 0.09)', borderRadius: 1, bgcolor: 'rgba(246, 248, 251, 0.86)', minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
        {label}
      </Typography>
      <Typography fontWeight={600}>{number(value)}</Typography>
    </Box>
  );
}

function PersonalActivityTrend({ trend }) {
  return (
    <ChartPanel title="14-day activity">
      {trend.length ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trend} margin={{ top: 10, right: 24, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(0, 0, 0, 0.09)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value, name) => [number(value), labelize(name)]} />
            <Legend formatter={(value) => labelize(value)} />
            <Line type="monotone" dataKey="applications" stroke="#0067C0" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="interviews" stroke="#486860" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="offers" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="tailoredResumes" name="Tailored resumes" stroke="#C77700" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ height: 320, display: 'grid', placeItems: 'center' }}>
          <EmptyState title="No activity yet" detail="Applications, interviews, and resume requests will appear here." variant="plain" sx={{ p: 2 }} />
        </Box>
      )}
    </ChartPanel>
  );
}

function UpcomingInterviewsTable({ rows }) {
  return (
    <DashboardTable title="Upcoming interviews" emptyTitle="No upcoming interviews" emptyDetail="Scheduled interviews will appear here.">
      {rows.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Interview</TableCell>
              <TableCell>Profile</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell align="right">When</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{row.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[row.company, row.location].filter(Boolean).join(' · ')}
                  </Typography>
                </TableCell>
                <TableCell>{formatFirstNameLastInitial(row.profileName, 'Unknown profile')}</TableCell>
                <TableCell><StatusChip value={row.interviewStage} /></TableCell>
                <TableCell align="right">{formatDateTime(row.interviewNextAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </DashboardTable>
  );
}

function RecentApplicationsTable({ rows }) {
  return (
    <DashboardTable title="Recent applications" emptyTitle="No recent applications" emptyDetail="Submitted applications will appear here.">
      {rows.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Role</TableCell>
              <TableCell>Profile</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Applied</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Link href={row.url} target="_blank" rel="noreferrer" underline="hover" fontWeight={600} color="inherit">
                    {row.title || 'Untitled role'}
                  </Link>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {[row.company, row.location].filter(Boolean).join(' · ')}
                  </Typography>
                </TableCell>
                <TableCell>{formatFirstNameLastInitial(row.profileName, 'Unknown profile')}</TableCell>
                <TableCell><StatusChip value={row.status} /></TableCell>
                <TableCell align="right">{formatDateTime(row.bidAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </DashboardTable>
  );
}

function ProfilesTable({ rows }) {
  return (
    <DashboardTable title="Profile activity" emptyTitle="No profiles yet" emptyDetail="Create a profile to start tracking applications and interviews.">
      {rows.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Profile</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Today</TableCell>
              <TableCell align="right">Applications</TableCell>
              <TableCell align="right">Interviews</TableCell>
              <TableCell align="right">Offers</TableCell>
              <TableCell align="right">Ready resumes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{formatFirstNameLastInitial(row.name, 'Unknown profile')}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.profileBadge}</Typography>
                </TableCell>
                <TableCell><StatusChip value={row.profileStatus} /></TableCell>
                <TableCell align="right">{number(row.todayApplications)}</TableCell>
                <TableCell align="right">{number(row.applications)}</TableCell>
                <TableCell align="right">{number(row.activeInterviews)}</TableCell>
                <TableCell align="right">{number(row.offers)}</TableCell>
                <TableCell align="right">{number(row.readyTailoredResumes)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </DashboardTable>
  );
}

function DashboardTable({ children, emptyDetail, emptyTitle, title }) {
  const hasRows = Boolean(children);
  return (
    <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0, boxShadow: 1 }}>
      <Typography fontWeight={600} sx={{ mb: 1 }}>
        {title}
      </Typography>
      {hasRows ? (
        <TableContainer sx={{ maxWidth: '100%' }}>
          {children}
        </TableContainer>
      ) : (
        <EmptyState title={emptyTitle} detail={emptyDetail} variant="plain" sx={{ p: 2 }} />
      )}
    </Paper>
  );
}

function StatusChip({ value }) {
  return <Chip size="small" label={labelize(value)} sx={{ borderRadius: 1, fontWeight: 600 }} />;
}

function LoadingPanel() {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Grid container spacing={1.25}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Grid key={`personal-dashboard-metric-loading-${index}`} size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, boxShadow: 1 }}>
              <Stack spacing={1}>
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton width="54%" />
                <Skeleton width="72%" />
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.35fr 0.65fr' }, gap: 1.5 }}>
        <DashboardPanelSkeleton height={320} />
        <DashboardPanelSkeleton height={186} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5 }}>
        <DashboardPanelSkeleton height={260} />
        <DashboardPanelSkeleton height={260} />
      </Box>
      <DashboardPanelSkeleton height={320} />
    </Box>
  );
}

function DashboardPanelSkeleton({ height }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, boxShadow: 1 }}>
      <Skeleton width="38%" sx={{ mb: 1 }} />
      <Skeleton variant="rounded" height={height} />
    </Paper>
  );
}

function dailyGoalDetail(totals) {
  if (!totals.dailyBidGoal) return 'No daily goal set';
  return `${percent(totals.dailyGoalProgress)} of ${number(totals.dailyBidGoal)} goal`;
}

const DEFAULT_DASHBOARD_GRAIN = 'daily';

function addDashboardPeriod(value, grain, amount) {
  const date = new Date(value);
  if (grain === 'weekly') return addDays(date, amount * 7);
  if (grain === 'monthly') return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  if (grain === 'quarterly') return new Date(date.getFullYear(), date.getMonth() + amount * 3, 1);
  if (grain === 'annually') return new Date(date.getFullYear() + amount, 0, 1);
  return addDays(date, amount);
}

function labelForDashboardPeriod(grain, anchor, timeZone) {
  const start = startForDashboardPeriod(grain, anchor, timeZone);
  if (grain === 'annually') return String(start.year);
  if (grain === 'quarterly') return `Q${Math.floor((start.month - 1) / 3) + 1} ${start.year}`;
  if (grain === 'monthly') return formatDateKey(start.dateKey, { month: 'long', year: 'numeric' });
  if (grain === 'weekly') return `${shortDateKey(start.dateKey)} - ${shortDateKey(addDaysToDateKey(start.dateKey, 6))}`;
  return formatDateKey(start.dateKey, { month: 'long', day: 'numeric', year: 'numeric' });
}

function startForDashboardPeriod(grain, anchor, timeZone) {
  const parts = zonedDateParts(anchor, timeZone);
  const dateKey = dateKeyForParts(parts);
  if (grain === 'weekly') return datePartsForKey(addDaysToDateKey(dateKey, -dateKeyDayOfWeek(dateKey)));
  if (grain === 'monthly') return { year: parts.year, month: parts.month, day: 1, dateKey: `${parts.year}-${pad(parts.month)}-01` };
  if (grain === 'quarterly') {
    const month = Math.floor((parts.month - 1) / 3) * 3 + 1;
    return { year: parts.year, month, day: 1, dateKey: `${parts.year}-${pad(month)}-01` };
  }
  if (grain === 'annually') return { year: parts.year, month: 1, day: 1, dateKey: `${parts.year}-01-01` };
  return { ...parts, dateKey };
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function shortDateKey(dateKey) {
  return formatDateKey(dateKey, { month: 'short', day: 'numeric' });
}

function formatDateKey(dateKey, options) {
  const { year, month, day } = datePartsForKey(dateKey);
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function dateKeyForParts(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function datePartsForKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day, dateKey };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

const periodIconButtonSx = {
  width: 36,
  height: 36,
  border: 1,
  borderColor: 'divider',
  bgcolor: '#ffffff',
  '&:hover': { bgcolor: 'rgba(0, 103, 192, 0.10)', borderColor: 'rgba(0, 103, 192, 0.28)' },
};

const toolbarButtonSx = {
  minHeight: 36,
  fontWeight: 600,
  textTransform: 'none',
  whiteSpace: 'nowrap',
};

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
