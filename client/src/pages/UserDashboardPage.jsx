import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import BadgeIcon from '@mui/icons-material/Badge';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import StyleIcon from '@mui/icons-material/Style';
import TodayIcon from '@mui/icons-material/Today';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
  Alert,
  Box,
  Chip,
  Grid,
  LinearProgress,
  Link,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
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
import DashboardMetric from '../components/adminDashboard/DashboardMetric.jsx';
import { labelize, number, percent } from '../components/adminDashboard/dashboardFormatters.js';
import EmptyState from '../components/common/EmptyState.jsx';
import { usePersonalDashboard } from '../lib/api.js';
import { formatFirstNameLastInitial } from '../lib/formatters.js';

export default function UserDashboardPage() {
  const { data: dashboard, isLoading, error } = usePersonalDashboard();
  const totals = dashboard?.totals || {};
  const trend = dashboard?.trend || [];

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <DashboardHeader dashboard={dashboard} />

      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {isLoading && !dashboard ? <LoadingPanel /> : null}
      {dashboard ? (
        <>
          <Grid container spacing={1.25}>
            <DashboardMetric icon={<AssignmentTurnedInIcon />} label="Applications" value={totals.totalApplications} detail={`${number(totals.weekApplications)} in the last 7 days`} />
            <DashboardMetric icon={<TodayIcon />} label="Today" value={totals.todayApplications} detail={dailyGoalDetail(totals)} />
            <DashboardMetric icon={<EventAvailableIcon />} label="Interviews" value={totals.activeInterviews} detail={`${number(totals.upcomingInterviews)} upcoming`} />
            <DashboardMetric icon={<EmojiEventsIcon />} label="Offers" value={totals.offers} detail={`${number(totals.lostInterviews)} closed as lost`} />
            <DashboardMetric icon={<BadgeIcon />} label="Profiles" value={totals.activeProfiles} detail={`${number(totals.totalProfiles)} total profiles`} />
            <DashboardMetric icon={<StyleIcon />} label="Tailoring" value={totals.readyTailoredResumes} detail={`${number(totals.tailoredResumeRequests)} active requests`} />
          </Grid>

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

function DashboardHeader({ dashboard }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.35 }}>
      <Typography color="text.secondary">
        Your profile activity, application movement, interviews, and resume tailoring queue.
      </Typography>
      {dashboard?.generatedAt ? (
        <Typography variant="caption" color="text.secondary">
          Updated {formatDateTime(dashboard.generatedAt)}
        </Typography>
      ) : null}
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
            <Typography fontWeight={900}>Daily application pace</Typography>
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
          sx={{ height: 9, borderRadius: 1, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { borderRadius: 1 } }}
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
    <Box sx={{ p: 1, border: 1, borderColor: '#E2E8F0', borderRadius: 1, bgcolor: '#F8FAFC', minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">
        {label}
      </Typography>
      <Typography fontWeight={900}>{number(value)}</Typography>
    </Box>
  );
}

function PersonalActivityTrend({ trend }) {
  return (
    <ChartPanel title="14-day activity">
      {trend.length ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trend} margin={{ top: 10, right: 24, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value, name) => [number(value), labelize(name)]} />
            <Legend formatter={(value) => labelize(value)} />
            <Line type="monotone" dataKey="applications" stroke="#2563EB" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="interviews" stroke="#0F766E" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="offers" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="tailoredResumes" name="Tailored resumes" stroke="#D97706" strokeWidth={2} dot={false} />
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
                  <Typography fontWeight={800}>{row.title}</Typography>
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
                  <Link href={row.url} target="_blank" rel="noreferrer" underline="hover" fontWeight={800} color="inherit">
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
                  <Typography fontWeight={900}>{formatFirstNameLastInitial(row.name, 'Unknown profile')}</Typography>
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
      <Typography fontWeight={900} sx={{ mb: 1 }}>
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
  return <Chip size="small" label={labelize(value)} sx={{ borderRadius: 1, fontWeight: 800 }} />;
}

function LoadingPanel() {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Grid container spacing={1.25}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Grid key={`personal-dashboard-metric-loading-${index}`} size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, boxShadow: 1 }}>
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
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, boxShadow: 1 }}>
      <Skeleton width="38%" sx={{ mb: 1 }} />
      <Skeleton variant="rounded" height={height} />
    </Paper>
  );
}

function dailyGoalDetail(totals) {
  if (!totals.dailyBidGoal) return 'No daily goal set';
  return `${percent(totals.dailyGoalProgress)} of ${number(totals.dailyBidGoal)} goal`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
