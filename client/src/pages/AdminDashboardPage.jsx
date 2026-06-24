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
} from '../components/adminDashboard/DashboardCharts.jsx';
import DashboardMetric from '../components/adminDashboard/DashboardMetric.jsx';
import { GRAIN_OPTIONS, labelForGrain, number, percent } from '../components/adminDashboard/dashboardFormatters.js';
import FunnelPerformanceTable from '../components/adminDashboard/FunnelPerformanceTable.jsx';
import ProfileActivityTable from '../components/adminDashboard/ProfileActivityTable.jsx';
import { useAdminDashboard } from '../lib/api.js';
import { formatFirstNameLastInitial } from '../lib/formatters.js';

export default function AdminDashboardPage() {
  const { section } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardSearch = searchParams.toString();
  const [grain, setGrain] = useState(() => dashboardGrainFrom(searchParams.get('grain')));
  const [anchorDate, setAnchorDate] = useState(() => dashboardAnchorFrom(searchParams.get('anchorDate')));
  const dashboardFilters = useMemo(() => ({ grain, anchorDate: anchorDate.toISOString() }), [anchorDate, grain]);
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
      return next;
    }, { replace: true });
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <DashboardHeader
        generatedAt={dashboard?.generatedAt}
        grain={grain}
        isLoading={isLoading}
        periodLabel={labelForDashboardPeriod(grain, anchorDate)}
        onGrainChange={changeGrain}
        onMove={movePeriod}
        onToday={resetToToday}
      />

      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {isLoading && !dashboard ? <LoadingPanel /> : null}
      {dashboard ? (
        activeSection ? (
          <DashboardSection section={activeSection} dashboard={dashboard} />
        ) : (
          <>
          <Grid container spacing={1.25}>
            <DashboardMetric icon={<WorkIcon />} label="Jobs" value={totals.totalJobs} detail={`${number(totals.manualJobs)} manual · ${number(totals.scrapedJobs)} scraped`} />
            <DashboardMetric icon={<AssignmentTurnedInIcon />} label="Applications" value={totals.totalApplications} detail={`${number(totals.submittedApplications)} submitted`} />
            <DashboardMetric icon={<TodayIcon />} label="Bids" value={totals.periodTotalBids} detail={`${number(totals.periodUserRoleBids)} user/admin/finance · ${number(totals.periodBidderBids)} bidders`} />
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
  if (section === 'profiles') return <ProfilePerformanceCharts profiles={dashboard.funnels?.profiles || []} />;
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
    <PerformanceChartGrid>
      <PerformanceVolumeChart title="Bidder volume" data={rows} bars={BIDDER_VOLUME_BARS} />
      <PerformanceShareChart title="Application share by bidder" data={rows} dataKey="applications" />
      <PerformanceRateChart title="Bidder conversion rates" data={rows} bars={BIDDER_RATE_BARS} />
      <PerformanceVolumeChart title="Bidder outcomes" data={rows} bars={BIDDER_OUTCOME_BARS} />
    </PerformanceChartGrid>
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

function ProfilePerformanceCharts({ profiles }) {
  const rows = namedPerformanceRows(displayProfileRows(profiles));
  return (
    <PerformanceChartGrid>
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

const FUNNEL_RATE_BARS = [
  { key: 'applicationToInterviewRate', label: 'App to interview', color: '#2563EB' },
  { key: 'interviewToOfferRate', label: 'Interview to offer', color: '#0F766E' },
  { key: 'applicationToOfferRate', label: 'App to offer', color: '#7C3AED' },
];

const USER_VOLUME_BARS = [
  { key: 'applications', label: 'Applications', color: '#2563EB' },
  { key: 'submitted', label: 'Submitted', color: '#0F766E' },
  { key: 'interviews', label: 'Interviews', color: '#7C3AED' },
  { key: 'offers', label: 'Offers', color: '#D97706' },
];

const USER_OUTCOME_BARS = [
  { key: 'successfulTechnicalInterviews', label: 'Tech success', color: '#0F766E' },
  { key: 'successfulFinalInterviews', label: 'Final success', color: '#2563EB' },
  { key: 'offers', label: 'Offers', color: '#7C3AED' },
  { key: 'lostInterviews', label: 'Lost', color: '#DC2626' },
];

const BIDDER_VOLUME_BARS = [
  { key: 'applications', label: 'Applications', color: '#2563EB' },
  { key: 'interviews', label: 'Interviews', color: '#0F766E' },
  { key: 'offers', label: 'Offers', color: '#7C3AED' },
];

const BIDDER_OUTCOME_BARS = [
  { key: 'interviews', label: 'Interviews', color: '#0F766E' },
  { key: 'offers', label: 'Offers', color: '#7C3AED' },
  { key: 'lost', label: 'Lost', color: '#DC2626' },
];

const BIDDER_RATE_BARS = [
  ...FUNNEL_RATE_BARS,
  { key: 'lossRate', label: 'Loss rate', color: '#DC2626' },
];

const CALLER_WORKLOAD_BARS = [
  { key: 'assignedInterviews', label: 'Assigned', color: '#2563EB' },
  { key: 'activeInterviews', label: 'Active', color: '#0F766E' },
  { key: 'upcomingInterviews', label: 'Upcoming', color: '#7C3AED' },
  { key: 'unscheduledActiveInterviews', label: 'Unscheduled', color: '#D97706' },
];

const CALLER_OUTCOME_BARS = [
  { key: 'completedInterviews', label: 'Completed', color: '#2563EB' },
  { key: 'wonInterviews', label: 'Won', color: '#0F766E' },
  { key: 'lostInterviews', label: 'Lost', color: '#DC2626' },
  { key: 'technicalInterviews', label: 'Technical', color: '#0891B2' },
  { key: 'finalInterviews', label: 'Final', color: '#7C3AED' },
];

const CALLER_RATE_BARS = [
  { key: 'meetingLinkCoverageRate', label: 'Meeting links', color: '#2563EB' },
  { key: 'callerOfferRate', label: 'Win rate', color: '#0F766E' },
  { key: 'callerLossRate', label: 'Loss rate', color: '#DC2626' },
];

const PROFILE_VOLUME_BARS = [
  { key: 'applications', label: 'Applications', color: '#2563EB' },
  { key: 'interviews', label: 'Interviews', color: '#0F766E' },
  { key: 'offers', label: 'Offers', color: '#7C3AED' },
  { key: 'lost', label: 'Lost', color: '#DC2626' },
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

function DashboardHeader({ generatedAt, grain, isLoading, onGrainChange, onMove, onToday, periodLabel }) {
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
          <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ textTransform: 'uppercase' }}>
            {isLoading ? 'Loading period' : 'Showing'}
          </Typography>
          <Typography variant="body2" fontWeight={950} noWrap>{periodLabel}</Typography>
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
        {Array.from({ length: 7 }).map((_, index) => (
          <Grid key={`dashboard-metric-loading-${index}`} size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
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
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, boxShadow: 1 }}>
      <Skeleton width="38%" sx={{ mb: 1 }} />
      <Skeleton variant="rounded" height={height} />
    </Paper>
  );
}

function DashboardTableSkeleton() {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, boxShadow: 1 }}>
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

function labelForDashboardPeriod(grain, anchor) {
  const start = startForDashboardPeriod(grain, anchor);
  if (grain === 'annually') return String(start.getFullYear());
  if (grain === 'quarterly') return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
  if (grain === 'monthly') return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (grain === 'weekly') return `${shortDate(start)} - ${shortDate(addDays(start, 6))}`;
  return start.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function startForDashboardPeriod(grain, anchor) {
  const date = new Date(anchor);
  if (grain === 'weekly') return addDays(startOfDay(date), -date.getDay());
  if (grain === 'monthly') return new Date(date.getFullYear(), date.getMonth(), 1);
  if (grain === 'quarterly') return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
  if (grain === 'annually') return new Date(date.getFullYear(), 0, 1);
  return startOfDay(date);
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function shortDate(value) {
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const periodIconButtonSx = {
  width: 36,
  height: 36,
  border: 1,
  borderColor: 'divider',
  bgcolor: '#ffffff',
  '&:hover': { bgcolor: '#EFF6FF', borderColor: '#BFDBFE' },
};

const toolbarButtonSx = {
  minHeight: 36,
  fontWeight: 900,
  textTransform: 'none',
  whiteSpace: 'nowrap',
};
