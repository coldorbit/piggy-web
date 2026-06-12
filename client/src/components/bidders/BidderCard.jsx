import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Card, CardContent, Paper, Stack, Typography } from '@mui/material';
import BidderMetricChip from './BidderMetricChip.jsx';
import BidderSummaryStat from './BidderSummaryStat.jsx';
import DailyApplicationsChart from './DailyApplicationsChart.jsx';
import InterviewPassThroughRow from './InterviewPassThroughRow.jsx';
import { roleLabel } from './bidderUtils.js';

export default function BidderCard({ bidder }) {
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
            <BidderMetricChip label={`${bidder.weeklyApplications || 0} this week`} />
            <BidderMetricChip label={`${bidder.monthlyApplications || 0} this month`} />
            <BidderMetricChip label={`${bidder.interviewPassThrough || 0} interviews`} />
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
          <BidderSummaryStat label="Total" value={bidder.totalApplications} />
          <BidderSummaryStat label="Won" value={bidder.won} />
          <BidderSummaryStat label="Lost" value={bidder.lost} />
          <BidderSummaryStat label="Pass-through" value={bidder.interviewPassThrough} />
        </Box>

        <Accordion variant="outlined" disableGutters sx={{ borderRadius: 1, overflow: 'hidden', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 42, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={900}>
                Interview pass-through
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(bidder.interviews || []).length.toLocaleString()}
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, display: 'grid', gap: 0.75 }}>
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
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
}
