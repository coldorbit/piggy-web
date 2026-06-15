import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import TodayIcon from '@mui/icons-material/Today';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkIcon from '@mui/icons-material/Work';
import { Alert, Box, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Skeleton, Stack, Typography } from '@mui/material';
import { useState } from 'react';
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
  const [grain, setGrain] = useState('daily');
  const { data: dashboard, isLoading, error } = useAdminDashboard({ grain });
  const totals = dashboard?.totals || {};
  const trend = dashboard?.trend || [];

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <DashboardHeader
        generatedAt={dashboard?.generatedAt}
        grain={grain}
        onGrainChange={setGrain}
      />

      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {isLoading && !dashboard ? <LoadingPanel /> : null}
      {dashboard ? (
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

          <BidderPerformanceTable bidders={dashboard.bidders || []} />
          <UserPerformanceTable users={dashboard.users || []} />
          <ProfileActivityTable rows={dashboard.profileActivity || []} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.5 }}>
            <FunnelPerformanceTable title="Profile funnel performance" rows={dashboard.funnels?.profiles || []} />
            <FunnelPerformanceTable title="Role family funnel performance" rows={dashboard.funnels?.roleFamilies || []} />
          </Box>
          <CallerPerformanceTable callers={dashboard.callers || []} />
        </>
      ) : null}
    </Box>
  );
}

function DashboardHeader({ generatedAt, grain, onGrainChange }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' }, gap: 1.25, alignItems: 'center' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography color="text.secondary">
          User and bidder performance across jobs, applications, interviews, and offers.
        </Typography>
        {generatedAt ? (
          <Typography variant="caption" color="text.secondary">
            Updated {new Date(generatedAt).toLocaleString()}
          </Typography>
        ) : null}
      </Box>
      <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 }, justifySelf: { xs: 'stretch', sm: 'end' } }}>
        <InputLabel>Period</InputLabel>
        <Select label="Period" value={grain} onChange={(event) => onGrainChange(event.target.value)}>
          {GRAIN_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
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
