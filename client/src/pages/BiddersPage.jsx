import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, CircularProgress, LinearProgress, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import BidderCard from '../components/bidders/BidderCard.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useBidders, useSourceRoi } from '../lib/api.js';

export default function BiddersPage() {
  const { data: bidders = [], isLoading, error } = useBidders();
  const { data: sourceRoi, isLoading: isLoadingSourceRoi, error: sourceRoiError } = useSourceRoi();

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {sourceRoiError ? <Alert severity="error">{sourceRoiError.message}</Alert> : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Typography color="text.secondary">
          {bidders.length.toLocaleString()} bidder{bidders.length === 1 ? '' : 's'}
        </Typography>
        {isLoading ? <CircularProgress size={22} /> : null}
      </Stack>

      {isLoading && !bidders.length ? <BidderLoadingGrid /> : null}
      {!isLoading && !bidders.length ? (
        <EmptyState
          title="No bidder activity yet"
          detail="Bidder performance will appear here once applications and interview outcomes are recorded."
        />
      ) : null}

      <SourceRoiPanel roi={sourceRoi} isLoading={isLoadingSourceRoi} />

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

function SourceRoiPanel({ roi, isLoading }) {
  const sources = roi?.sources || [];
  if (isLoading && !sources.length) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
        <Stack spacing={1}>
          <Skeleton width="24%" />
          <Skeleton variant="rounded" height={132} />
        </Stack>
      </Paper>
    );
  }
  if (!sources.length) return null;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={900}>Source ROI</Typography>
        <Typography variant="body2" color="text.secondary">
          Applications to interviews to offers, attributed by bidder and profile.
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell>Source</TableCell>
              <TableCell align="right">Applications</TableCell>
              <TableCell align="right">Interviews</TableCell>
              <TableCell align="right">Offers</TableCell>
              <TableCell align="right">Interview rate</TableCell>
              <TableCell align="right">Offer rate</TableCell>
              <TableCell align="right">Bidders</TableCell>
              <TableCell align="right">Profiles</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sources.map((source) => (
              <SourceRoiRow key={source.sourceKey || source.source} source={source} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function SourceRoiRow({ source }) {
  return (
    <TableRow hover sx={{ '& > td': { verticalAlign: 'top' } }}>
      <TableCell sx={{ minWidth: 260 }}>
        <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 34, px: 0, '& .MuiAccordionSummary-content': { my: 0 } }}>
            <Typography fontWeight={900}>{source.source}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0, display: 'grid', gap: 1 }}>
            <AttributionList title="Bidders" rows={source.bidderAttribution || []} nameKey="bidderUsername" />
            <AttributionList title="Profiles" rows={source.profileAttribution || []} nameKey="profileName" />
          </AccordionDetails>
        </Accordion>
      </TableCell>
      <MetricCell value={source.applications} />
      <MetricCell value={source.interviews} />
      <MetricCell value={source.offers} />
      <MetricCell value={source.interviewRate} percent />
      <MetricCell value={source.offerRate} percent />
      <MetricCell value={source.bidders} />
      <MetricCell value={source.profiles} />
    </TableRow>
  );
}

function AttributionList({ title, rows, nameKey }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={900}>
        {title}
      </Typography>
      {!rows.length ? (
        <Typography variant="caption" color="text.secondary">No attribution yet.</Typography>
      ) : rows.slice(0, 5).map((row) => (
        <Box key={`${title}-${row[nameKey]}-${row.applications}`} sx={{ display: 'grid', gap: 0.25 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{row[nameKey]}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.applications} / {row.interviews} / {row.offers}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min((row.interviewRate || 0) * 100, 100)}
            sx={{ height: 4, borderRadius: 1, bgcolor: 'rgba(0, 0, 0, 0.09)' }}
          />
        </Box>
      ))}
    </Box>
  );
}

function MetricCell({ value, percent = false }) {
  const displayValue = percent ? `${Math.round(Number(value || 0) * 100)}%` : Number(value || 0).toLocaleString();
  return <TableCell align="right">{displayValue}</TableCell>;
}

function BidderLoadingGrid() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
      }}
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <Paper key={`bidder-loading-${index}`} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Box sx={{ flex: 1 }}>
                <Skeleton width="45%" />
                <Skeleton width="32%" />
              </Box>
              <Skeleton variant="rounded" width={84} height={28} />
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
              <Skeleton variant="rounded" height={58} />
              <Skeleton variant="rounded" height={58} />
              <Skeleton variant="rounded" height={58} />
            </Box>
            <Skeleton variant="rounded" height={180} />
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
