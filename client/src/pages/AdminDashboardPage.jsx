import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import TodayIcon from '@mui/icons-material/Today';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkIcon from '@mui/icons-material/Work';
import { Alert, Box, Button, FormControl, Grid, IconButton, InputLabel, MenuItem, Paper, Select, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import BidderPerformanceTable from '../components/adminDashboard/BidderPerformanceTable.jsx';
import CallerPerformanceTable from '../components/adminDashboard/CallerPerformanceTable.jsx';
import { ActivityTrendChart, BreakdownChart, FunnelConversionChart, InterviewOutcomeChart } from '../components/adminDashboard/DashboardCharts.jsx';
import DashboardMetric from '../components/adminDashboard/DashboardMetric.jsx';
import { GRAIN_OPTIONS, labelForGrain, number, percent } from '../components/adminDashboard/dashboardFormatters.js';
import FunnelPerformanceTable from '../components/adminDashboard/FunnelPerformanceTable.jsx';
import ProfileActivityTable from '../components/adminDashboard/ProfileActivityTable.jsx';
import UserPerformanceTable from '../components/adminDashboard/UserPerformanceTable.jsx';
import { useAdminDashboard } from '../lib/api.js';

export default function AdminDashboardPage() {
  const { section } = useParams();
  const [grain, setGrain] = useState('daily');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const dashboardFilters = useMemo(() => ({ grain, anchorDate: anchorDate.toISOString() }), [anchorDate, grain]);
  const { data: dashboard, isLoading, error } = useAdminDashboard(dashboardFilters);
  const activeSection = dashboardSectionFor(section);
  const totals = dashboard?.totals || {};
  const trend = dashboard?.trend || [];

  function changeGrain(nextGrain) {
    if (!nextGrain) return;
    setGrain(nextGrain);
  }

  function movePeriod(direction) {
    setAnchorDate((current) => addDashboardPeriod(current, grain, direction));
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
        onToday={() => setAnchorDate(new Date())}
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
            <DashboardMetric icon={<TodayIcon />} label="Daily bids" value={totals.dailyTotalBids} detail={`${number(totals.dailyUserRoleBids)} user/admin/finance · ${number(totals.dailyBidderBids)} bidders`} />
            <DashboardMetric icon={<EventAvailableIcon />} label="Interviews" value={totals.totalInterviews} detail={`${number(totals.activeInterviews)} active`} />
            <DashboardMetric icon={<TrendingUpIcon />} label="Technical success" value={percent(totals.technicalSuccessRate)} detail={`${number(totals.successfulTechnicalInterviews)} successful`} />
            <DashboardMetric icon={<EmojiEventsIcon />} label="Offers" value={totals.successfulOffers} detail={`${percent(totals.interviewToOfferRate)} interview-to-offer`} />
            <DashboardMetric icon={<AnalyticsIcon />} label="Tailoring" value={totals.tailoredResumeRequests} detail={`${number(totals.readyTailoredResumes)} ready resumes`} />
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
            <FunnelConversionChart title="Profile success ratios" data={dashboard.funnels?.profiles || []} />
            <FunnelConversionChart title="Role family success ratios" data={dashboard.funnels?.roleFamilies || []} />
          </Box>

          <ProfileActivityTable rows={dashboard.profileActivity || []} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5 }}>
            <FunnelPerformanceTable title="Profile funnel performance" rows={dashboard.funnels?.profiles || []} />
            <FunnelPerformanceTable title="Role family funnel performance" rows={dashboard.funnels?.roleFamilies || []} />
          </Box>
          </>
        )
      ) : null}
    </Box>
  );
}

function DashboardSection({ dashboard, section }) {
  if (section === 'users') return <UserPerformanceTable users={dashboard.users || []} />;
  if (section === 'bidders') return <BidderPerformanceTable bidders={dashboard.bidders || []} />;
  if (section === 'callers') return <CallerPerformanceTable callers={dashboard.callers || []} />;
  if (section === 'profiles') {
    return (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <FunnelPerformanceTable title="Profile performance" rows={dashboard.funnels?.profiles || []} />
        <ProfileActivityTable rows={dashboard.profileActivity || []} />
      </Box>
    );
  }
  return null;
}

function dashboardSectionFor(value) {
  if (['users', 'bidders', 'callers', 'profiles'].includes(value)) return value;
  return '';
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
