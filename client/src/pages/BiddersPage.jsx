import { Alert, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import BidderCard from '../components/bidders/BidderCard.jsx';
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
