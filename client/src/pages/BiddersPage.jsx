import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { INTERVIEW_STAGES } from '../components/bids/bidConstants.js';
import { useBidders } from '../lib/api.js';
import { formatDateTime } from '../lib/formatters.js';

export default function BiddersPage() {
  const { data: bidders = [], isLoading, error } = useBidders();

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Typography color="text.secondary">
          {bidders.length.toLocaleString()} bidder{bidders.length === 1 ? '' : 's'}
        </Typography>
        {isLoading ? <CircularProgress size={22} /> : null}
      </Stack>

      {isLoading && !bidders.length ? (
        <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading bidder performance...</Typography>
        </Paper>
      ) : null}
      {!isLoading && !bidders.length ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">No bidder activity is available yet.</Typography>
        </Paper>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {bidders.map((bidder) => (
          <BidderCard key={bidder.id} bidder={bidder} />
        ))}
      </Box>
    </Box>
  );
}

function BidderCard({ bidder }) {
  return (
    <Card variant="outlined" sx={{ boxShadow: 1 }}>
      <CardContent sx={{ display: 'grid', gap: 1.25 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'start' }}>
          <Box minWidth={0}>
            <Typography fontWeight={900} noWrap>
              {bidder.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {roleLabel(bidder.role)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end" useFlexGap>
            <MetricChip label={`${bidder.weeklyApplications || 0} this week`} />
            <MetricChip label={`${bidder.monthlyApplications || 0} this month`} />
            <MetricChip label={`${bidder.interviewPassThrough || 0} interviews`} />
          </Stack>
        </Box>

        <DailyApplicationsChart data={bidder.dailyApplications || []} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
            gap: 0.75,
          }}
        >
          <SummaryStat label="Total" value={bidder.totalApplications} />
          <SummaryStat label="Won" value={bidder.won} />
          <SummaryStat label="Lost" value={bidder.lost} />
          <SummaryStat label="Pass-through" value={bidder.interviewPassThrough} />
        </Box>

        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <Typography variant="body2" fontWeight={900}>
            Interview pass-through
          </Typography>
          {!bidder.interviews?.length ? (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#F8FAFC' }}>
              <Typography variant="body2" color="text.secondary">
                No interviews have passed through from this bidder's applications.
              </Typography>
            </Paper>
          ) : null}
          <Stack spacing={0.75}>
            {(bidder.interviews || []).slice(0, 8).map((interview) => (
              <InterviewPassThroughRow key={interview.id} interview={interview} />
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

function MetricChip({ label }) {
  return (
    <Chip
      icon={<TrendingUpIcon />}
      label={label}
      size="small"
      sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 900, '& .MuiChip-icon': { color: '#1D4ED8' } }}
    />
  );
}

function SummaryStat({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 1, bgcolor: '#F8FAFC' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        {label}
      </Typography>
      <Typography fontWeight={900}>{Number(value || 0).toLocaleString()}</Typography>
    </Paper>
  );
}

function DailyApplicationsChart({ data }) {
  const max = Math.max(...data.map((item) => Number(item.applications || 0)), 1);

  return (
    <Paper variant="outlined" sx={{ p: 1, bgcolor: '#F8FAFC' }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
        <CalendarMonthIcon fontSize="small" color="action" />
        <Typography variant="body2" fontWeight={900}>
          Daily applications
        </Typography>
      </Stack>
      <Box sx={{ display: 'flex', alignItems: 'end', gap: 0.45, height: 112, minWidth: 0 }}>
        {data.map((item) => {
          const count = Number(item.applications || 0);
          return (
            <Box
              key={item.date}
              sx={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'grid',
                alignContent: 'end',
                justifyItems: 'center',
                gap: 0.35,
                height: '100%',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, lineHeight: 1 }}>
                {count}
              </Typography>
              <Box
                title={`${item.date}: ${count} applications`}
                sx={{
                  width: '100%',
                  maxWidth: 18,
                  height: `${Math.max((count / max) * 72, count ? 8 : 2)}px`,
                  borderRadius: 0.75,
                  bgcolor: count ? '#2563EB' : '#CBD5E1',
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

function InterviewPassThroughRow({ interview }) {
  const stage = INTERVIEW_STAGES.find((item) => item.value === interview.interviewStage);
  const job = interview.job || {};
  const profile = interview.profile || {};

  return (
    <Paper variant="outlined" sx={{ p: 1, display: 'grid', gap: 0.75 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) max-content', gap: 1, alignItems: 'start' }}>
        <Box minWidth={0}>
          <Typography fontWeight={900} variant="body2" noWrap>
            {job.title || 'Untitled role'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {job.company || 'Unknown company'}{profile.name ? ` · ${profile.name}` : ''}
          </Typography>
        </Box>
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
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <Chip label={stage?.label || interview.status} size="small" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 900 }} />
        <Chip
          label={interview.interviewNextAt ? formatDateTime(interview.interviewNextAt) : formatDateTime(interview.updatedAt)}
          size="small"
          sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 800 }}
        />
      </Stack>
    </Paper>
  );
}

function roleLabel(role) {
  if (role === 'readonly_bidder' || role === 'bidder') return 'Readonly bidder';
  if (role === 'editable_bidder') return 'Editable bidder';
  return role || 'User';
}
