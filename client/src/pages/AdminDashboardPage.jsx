import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import TodayIcon from '@mui/icons-material/Today';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkIcon from '@mui/icons-material/Work';
import { Alert, Box, Button, FormControl, Grid, IconButton, InputLabel, MenuItem, Paper, Select, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ActivityTrendChart,
  BreakdownChart,
  FunnelConversionChart,
  InterviewOutcomeChart,
  PerformanceRateChart,
  PerformanceShareChart,
  PerformanceVolumeChart,
  ProfileInterviewTrendChart,
} from '../components/adminDashboard/DashboardCharts.jsx';
import DashboardMetric from '../components/adminDashboard/DashboardMetric.jsx';
import { GRAIN_OPTIONS, labelForGrain, number, percent } from '../components/adminDashboard/dashboardFormatters.js';
import BidderPerformanceTable from '../components/adminDashboard/BidderPerformanceTable.jsx';
import FunnelPerformanceTable from '../components/adminDashboard/FunnelPerformanceTable.jsx';
import ProfileActivityTable from '../components/adminDashboard/ProfileActivityTable.jsx';
import { ALL_WORKSPACES } from '../components/admin/SuperadminWorkspaceLens.jsx';
import { useWorkspaceFilter } from '../components/admin/WorkspaceFilterContext.jsx';
import { useAdminDashboard } from '../lib/api.js';
import { formatFirstNameLastInitial } from '../lib/formatters.js';
import { isSuperadmin } from '../lib/roles.js';
import { addDaysToDateKey, dateKeyDayOfWeek, zonedDateParts } from '../lib/timezone.js';

export default function AdminDashboardPage({ currentUser }) {
  const { section } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardSearch = searchParams.toString();
  const [grain, setGrain] = useState(() => dashboardGrainFrom(searchParams.get('grain')));
  const [anchorDate, setAnchorDate] = useState(() => dashboardAnchorFrom(searchParams.get('anchorDate')));
  const { activeWorkspaceId, workspaceError } = useWorkspaceFilter();
  const dashboardTimeZone = currentUser?.timezone || '';
  const superadminView = isSuperadmin(currentUser);
  const dashboardWorkspaceId = superadminView && activeWorkspaceId !== ALL_WORKSPACES ? activeWorkspaceId : '';
  const dashboardFilters = useMemo(
    () => ({
      grain,
      anchorDate: anchorDate.toISOString(),
      timeZone: dashboardTimeZone,
      ...(dashboardWorkspaceId ? { workspaceId: dashboardWorkspaceId } : {}),
    }),
    [anchorDate, dashboardTimeZone, dashboardWorkspaceId, grain],
  );
  const { data: dashboard, isLoading, error } = useAdminDashboard(dashboardFilters);
  const activeSection = dashboardSectionFor(section);
  const totals = dashboard?.totals || {};
  const trend = dashboard?.trend || [];
  const profileFunnels = displayProfileRows(dashboard?.funnels?.profiles || []);

  useEffect(() => {
    const nextSearchParams = new URLSearchParams(dashboardSearch);
    const nextGrain = dashboardGrainFrom(nextSearchParams.get('grain'));
    const nextAnchorDate = dashboardAnchorFrom(nextSearchParams.get('anchorDate'));
    setGrain((current) => (current === nextGrain ? current : nextGrain));
    setAnchorDate((current) => (sameDashboardDate(current, nextAnchorDate) ? current : nextAnchorDate));
  }, [dashboardSearch]);

  function changeGrain(nextGrain) {
    if (!nextGrain) return;
    updateDashboardFilters(nextGrain, anchorDate);
  }

  function movePeriod(direction) {
    updateDashboardFilters(grain, addDashboardPeriod(anchorDate, grain, direction));
  }

  function resetToToday() {
    updateDashboardFilters(grain, new Date());
  }

  function updateDashboardFilters(nextGrain, nextAnchorDate) {
    setGrain(nextGrain);
    setAnchorDate(nextAnchorDate);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextGrain === DEFAULT_DASHBOARD_GRAIN) {
        next.delete('grain');
      } else {
        next.set('grain', nextGrain);
      }
      next.set('anchorDate', nextAnchorDate.toISOString());
      next.delete('workspaceId');
      return next;
    }, { replace: true });
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <DashboardHeader
        generatedAt={dashboard?.generatedAt}
        grain={grain}
        isLoading={isLoading}
        periodLabel={labelForDashboardPeriod(grain, anchorDate, dashboardTimeZone)}
        onGrainChange={changeGrain}
        onMove={movePeriod}
        onToday={resetToToday}
      />

      {error || workspaceError ? <Alert severity="error">{error?.message || workspaceError?.message}</Alert> : null}
      {isLoading && !dashboard ? <LoadingPanel /> : null}
      {dashboard ? (
        activeSection ? (
          <DashboardSection section={activeSection} dashboard={dashboard} />
        ) : (
          <>
          <Grid container spacing={1.25}>
            <DashboardMetric icon={<WorkIcon />} label="Jobs" value={totals.totalJobs} detail={`${number(totals.manualJobs)} manual · ${number(totals.scrapedJobs)} scraped`} />
            <DashboardMetric icon={<AssignmentTurnedInIcon />} label="Applications" value={totals.totalApplications} detail={`${number(totals.submittedApplications)} submitted`} />
            <DashboardMetric icon={<TodayIcon />} label="Bids" value={totals.periodTotalBids} detail={`${number(totals.periodUserRoleBids)} user/finance/internal · ${number(totals.periodBidderBids)} bidders`} />
            <DashboardMetric icon={<EventAvailableIcon />} label="Interviews" value={totals.totalInterviews} detail={`${number(totals.activeInterviews)} active`} />
            <DashboardMetric icon={<TrendingUpIcon />} label="Technical success" value={percent(totals.technicalSuccessRate)} detail={`${number(totals.successfulTechnicalInterviews)} successful`} />
            <DashboardMetric icon={<EmojiEventsIcon />} label="Offers" value={totals.successfulOffers} detail={`${percent(totals.interviewToOfferRate)} interview-to-offer`} />
          </Grid>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.35fr 1fr' }, gap: 1.5 }}>
            <ActivityTrendChart title={`${labelForGrain(grain)} activity trend`} trend={trend} />
            <InterviewOutcomeChart trend={trend} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
            <BreakdownChart title="Applications by source" data={dashboard.breakdowns.sources} />
            <BreakdownChart title="Application statuses" data={dashboard.breakdowns.bidStatuses} />
            <BreakdownChart title="Interview stages" data={dashboard.breakdowns.interviewStages} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5 }}>
            <FunnelConversionChart title="Profile success ratios" data={profileFunnels} />
            <FunnelConversionChart title="Role family success ratios" data={dashboard.funnels?.roleFamilies || []} />
          </Box>

          <ProfileActivityTable rows={dashboard.profileActivity || []} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5 }}>
            <FunnelPerformanceTable title="Profile funnel performance" rows={profileFunnels} />
            <FunnelPerformanceTable title="Role family funnel performance" rows={dashboard.funnels?.roleFamilies || []} />
          </Box>
          </>
        )
      ) : null}
    </Box>
  );
}

function DashboardSection({ dashboard, section }) {
  if (section === 'users') return <UserPerformanceCharts users={dashboard.users || []} />;
  if (section === 'bidders') return <BidderPerformanceCharts bidders={dashboard.bidders || []} />;
  if (section === 'callers') return <CallerPerformanceCharts callers={dashboard.callers || []} />;
  if (section === 'profiles') return <ProfilePerformanceCharts profiles={dashboard.funnels?.profiles || []} profileInterviewTrend={dashboard.profileInterviewTrend || []} />;
  return null;
}

function UserPerformanceCharts({ users }) {
  const rows = namedPerformanceRows(users);
  return (
    <PerformanceChartGrid>
      <PerformanceVolumeChart title="User volume" data={rows} bars={USER_VOLUME_BARS} />
      <PerformanceShareChart title="Application share by user" data={rows} dataKey="applications" />
      <PerformanceRateChart title="User conversion rates" data={rows} bars={FUNNEL_RATE_BARS} />
      <PerformanceVolumeChart title="User interview outcomes" data={rows} bars={USER_OUTCOME_BARS} />
    </PerformanceChartGrid>
  );
}

function BidderPerformanceCharts({ bidders }) {
  const rows = namedPerformanceRows(bidders);
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <PerformanceChartGrid>
        <PerformanceVolumeChart title="Tailoring to interview volume" data={rows} bars={BIDDER_VOLUME_BARS} />
        <PerformanceShareChart title="Tailoring request share" data={rows} dataKey="tailoredResumeRequests" />
        <PerformanceRateChart title="Tailoring efficiency rates" data={rows} bars={BIDDER_RATE_BARS} />
        <PerformanceVolumeChart title="Interview outcomes" data={rows} bars={BIDDER_OUTCOME_BARS} />
      </PerformanceChartGrid>
      <BidderPerformanceTable bidders={bidders} />
    </Box>
  );
}

function CallerPerformanceCharts({ callers }) {
  const rows = namedPerformanceRows(callers);
  return (
    <PerformanceChartGrid>
      <PerformanceVolumeChart title="Caller workload" data={rows} bars={CALLER_WORKLOAD_BARS} />
      <PerformanceShareChart title="Assigned interview share" data={rows} dataKey="assignedInterviews" />
      <PerformanceRateChart title="Caller coverage and outcomes" data={rows} bars={CALLER_RATE_BARS} />
      <PerformanceVolumeChart title="Caller interview outcomes" data={rows} bars={CALLER_OUTCOME_BARS} />
    </PerformanceChartGrid>
  );
}

function ProfilePerformanceCharts({ profileInterviewTrend = [], profiles }) {
  const rows = namedPerformanceRows(displayProfileRows(profiles));
  return (
    <PerformanceChartGrid>
      <Box sx={{ gridColumn: { xs: 'auto', xl: 'span 2' } }}>
        <ProfileInterviewTrendChart title="Profile interviews over time" data={displayProfileTrendRows(profileInterviewTrend)} />
      </Box>
      <PerformanceVolumeChart title="Profile volume" data={rows} bars={PROFILE_VOLUME_BARS} />
      <PerformanceShareChart title="Application share by profile" data={rows} dataKey="applications" />
      <PerformanceRateChart title="Profile conversion rates" data={rows} bars={BIDDER_RATE_BARS} />
      <PerformanceVolumeChart title="Profile outcomes" data={rows} bars={BIDDER_OUTCOME_BARS} />
    </PerformanceChartGrid>
  );
}

function PerformanceChartGrid({ children }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5 }}>
      {children}
    </Box>
  );
}

function namedPerformanceRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    name: row.username || row.name || 'Unknown',
  }));
}

function displayProfileRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    name: formatFirstNameLastInitial(row.name, 'Unknown'),
  }));
}

function displayProfileTrendRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    profileName: formatFirstNameLastInitial(row.profileName, 'Unknown'),
  }));
}

const FUNNEL_RATE_BARS = [
  { key: 'applicationToInterviewRate', label: 'App to interview', color: '#0067C0' },
  { key: 'interviewToOfferRate', label: 'Interview to offer', color: '#486860' },
  { key: 'applicationToOfferRate', label: 'App to offer', color: '#7C3AED' },
];

const USER_VOLUME_BARS = [
  { key: 'applications', label: 'Applications', color: '#0067C0' },
  { key: 'submitted', label: 'Submitted', color: '#486860' },
  { key: 'interviews', label: 'Interviews', color: '#7C3AED' },
  { key: 'offers', label: 'Offers', color: '#C77700' },
];

const USER_OUTCOME_BARS = [
  { key: 'successfulTechnicalInterviews', label: 'Tech success', color: '#486860' },
  { key: 'successfulFinalInterviews', label: 'Final success', color: '#0067C0' },
  { key: 'offers', label: 'Offers', color: '#7C3AED' },
  { key: 'lostInterviews', label: 'Lost', color: '#C42B1C' },
];

const BIDDER_VOLUME_BARS = [
  { key: 'tailoredResumeRequests', label: 'Tailor requests', color: '#C77700' },
  { key: 'applications', label: 'Applications', color: '#0067C0' },
  { key: 'interviews', label: 'Interviews', color: '#486860' },
];

const BIDDER_OUTCOME_BARS = [
  { key: 'interviews', label: 'Interviews', color: '#486860' },
  { key: 'offers', label: 'Offers', color: '#7C3AED' },
  { key: 'lost', label: 'Lost', color: '#C42B1C' },
];

const BIDDER_RATE_BARS = [
  { key: 'tailoringToApplicationRate', label: 'Tailor to app', color: '#C77700' },
  { key: 'tailoringToInterviewRate', label: 'Tailor to interview', color: '#486860' },
  { key: 'applicationToInterviewRate', label: 'App to interview', color: '#0067C0' },
];

const CALLER_WORKLOAD_BARS = [
  { key: 'assignedInterviews', label: 'Assigned', color: '#0067C0' },
  { key: 'activeInterviews', label: 'Active', color: '#486860' },
  { key: 'upcomingInterviews', label: 'Upcoming', color: '#7C3AED' },
  { key: 'unscheduledActiveInterviews', label: 'Unscheduled', color: '#C77700' },
];

const CALLER_OUTCOME_BARS = [
  { key: 'completedInterviews', label: 'Completed', color: '#0067C0' },
  { key: 'wonInterviews', label: 'Won', color: '#486860' },
  { key: 'lostInterviews', label: 'Lost', color: '#C42B1C' },
  { key: 'technicalInterviews', label: 'Technical', color: '#0891B2' },
  { key: 'finalInterviews', label: 'Final', color: '#7C3AED' },
];

const CALLER_RATE_BARS = [
  { key: 'meetingLinkCoverageRate', label: 'Meeting links', color: '#0067C0' },
  { key: 'callerOfferRate', label: 'Win rate', color: '#486860' },
  { key: 'callerLossRate', label: 'Loss rate', color: '#C42B1C' },
];

const PROFILE_VOLUME_BARS = [
  { key: 'applications', label: 'Applications', color: '#0067C0' },
  { key: 'interviews', label: 'Interviews', color: '#486860' },
  { key: 'offers', label: 'Offers', color: '#7C3AED' },
  { key: 'lost', label: 'Lost', color: '#C42B1C' },
];

function dashboardSectionFor(value) {
  if (['users', 'bidders', 'callers', 'profiles'].includes(value)) return value;
  return '';
}

const DEFAULT_DASHBOARD_GRAIN = 'daily';
function dashboardGrainFrom(value) {
  return GRAIN_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_DASHBOARD_GRAIN;
}

function dashboardAnchorFrom(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function sameDashboardDate(left, right) {
  return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
}

function DashboardHeader({
  generatedAt,
  grain,
  isLoading,
  onGrainChange,
  onMove,
  onToday,
  periodLabel,
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' }, gap: 1.25, alignItems: 'center' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography color="text.secondary">
          User, bidder, caller, and profile performance across jobs, applications, interviews, and offers.
        </Typography>
        {generatedAt ? (
          <Typography variant="caption" color="text.secondary">
            Updated {new Date(generatedAt).toLocaleString()}
          </Typography>
        ) : null}
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent={{ xs: 'stretch', sm: 'flex-end' }} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Tooltip title="Previous period">
          <IconButton aria-label="Previous dashboard period" onClick={() => onMove(-1)} sx={periodIconButtonSx}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Next period">
          <IconButton aria-label="Next dashboard period" onClick={() => onMove(1)} sx={periodIconButtonSx}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            minHeight: 40,
            minWidth: { xs: '100%', sm: 190 },
            px: 1.25,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            display: 'grid',
            alignContent: 'center',
            bgcolor: '#ffffff',
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
            {isLoading ? 'Loading period' : 'Showing'}
          </Typography>
          <Typography variant="body2" fontWeight={600} noWrap>{periodLabel}</Typography>
        </Box>
        <Button onClick={onToday} startIcon={<TodayIcon fontSize="small" />} size="small" variant="outlined" sx={toolbarButtonSx}>
          Today
        </Button>
        <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
          <InputLabel>Period</InputLabel>
          <Select label="Period" value={grain} onChange={(event) => onGrainChange(event.target.value)}>
            {GRAIN_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Box>
  );
}

function LoadingPanel() {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Grid container spacing={1.25}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Grid key={`dashboard-metric-loading-${index}`} size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.35fr 1fr' }, gap: 1.5 }}>
        <DashboardPanelSkeleton height={320} />
        <DashboardPanelSkeleton height={320} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
        <DashboardPanelSkeleton height={240} />
        <DashboardPanelSkeleton height={240} />
        <DashboardPanelSkeleton height={240} />
      </Box>
      <DashboardTableSkeleton />
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

function DashboardTableSkeleton() {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, boxShadow: 1 }}>
      <Skeleton width="28%" sx={{ mb: 1.25 }} />
      <Stack spacing={0.75}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Box key={`dashboard-table-loading-${index}`} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) repeat(5, minmax(72px, 1fr))', gap: 1 }}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

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
  return { ...parts, dateKey: dateKeyForParts(parts) };
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
