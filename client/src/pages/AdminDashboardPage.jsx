import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkIcon from '@mui/icons-material/Work';
import { Alert, Box, CircularProgress, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import CallerPerformanceTable from '../components/adminDashboard/CallerPerformanceTable.jsx';
import { ActivityTrendChart, BreakdownChart, InterviewOutcomeChart } from '../components/adminDashboard/DashboardCharts.jsx';
import DashboardMetric from '../components/adminDashboard/DashboardMetric.jsx';
import { GRAIN_OPTIONS, labelForGrain, number, percent } from '../components/adminDashboard/dashboardFormatters.js';
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

          <UserPerformanceTable users={dashboard.users || []} />
          <CallerPerformanceTable callers={dashboard.callers || []} />
        </>
      ) : null}
    </Box>
  );
}

function DashboardHeader({ generatedAt, grain, onGrainChange }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
      <Box>
        <Typography color="text.secondary">
          User and bidder performance across jobs, applications, interviews, and offers.
        </Typography>
        {generatedAt ? (
          <Typography variant="caption" color="text.secondary">
            Updated {new Date(generatedAt).toLocaleString()}
          </Typography>
        ) : null}
      </Box>
      <FormControl size="small" sx={{ minWidth: 180 }}>
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
  );
}

function LoadingPanel() {
  return (
    <Paper variant="outlined" sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
      <CircularProgress size={22} />
      <Typography color="text.secondary">Loading dashboard...</Typography>
    </Paper>
  );
}
