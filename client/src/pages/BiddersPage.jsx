import { Alert, Box, CircularProgress, Paper, Skeleton, Stack, Typography } from '@mui/material';
import BidderCard from '../components/bidders/BidderCard.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useBidders } from '../lib/api.js';

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

      {isLoading && !bidders.length ? <BidderLoadingGrid /> : null}
      {!isLoading && !bidders.length ? (
        <EmptyState
          title="No bidder activity yet"
          detail="Bidder performance will appear here once applications and interview outcomes are recorded."
        />
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
