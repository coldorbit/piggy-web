import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import EmptyState from '../common/EmptyState.jsx';
import { labelize, number, percent } from './dashboardFormatters.js';

export default function BidderPerformanceTable({ bidders }) {
  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={900}>Bidder performance</Typography>
        <Typography variant="caption" color="text.secondary">
          Application, interview, and offer conversion by bidder.
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 420 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Bidder</TableCell>
              <TableCell align="right">Apps</TableCell>
              <TableCell align="right">Interviews</TableCell>
              <TableCell align="right">Offers</TableCell>
              <TableCell align="right">Lost</TableCell>
              <TableCell align="right">Profiles</TableCell>
              <TableCell align="right">Role families</TableCell>
              <TableCell align="right">App {'->'} Interview</TableCell>
              <TableCell align="right">Interview {'->'} Offer</TableCell>
              <TableCell align="right">App {'->'} Offer</TableCell>
              <TableCell align="right">Loss rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bidders.map((bidder) => (
              <TableRow key={bidder.id} hover>
                <TableCell>
                  <Typography fontWeight={900}>{bidder.username}</Typography>
                  <Typography variant="caption" color="text.secondary">{labelize(bidder.role)}</Typography>
                </TableCell>
                <TableCell align="right">{number(bidder.applications)}</TableCell>
                <TableCell align="right">{number(bidder.interviews)}</TableCell>
                <TableCell align="right">{number(bidder.offers)}</TableCell>
                <TableCell align="right">{number(bidder.lost)}</TableCell>
                <TableCell align="right">{number(bidder.profilesUsed)}</TableCell>
                <TableCell align="right">{number(bidder.roleFamilies)}</TableCell>
                <TableCell align="right">{percent(bidder.applicationToInterviewRate)}</TableCell>
                <TableCell align="right">{percent(bidder.interviewToOfferRate)}</TableCell>
                <TableCell align="right">{percent(bidder.applicationToOfferRate)}</TableCell>
                <TableCell align="right">{percent(bidder.lossRate)}</TableCell>
              </TableRow>
            ))}
            {!bidders.length ? (
              <TableRow>
                <TableCell colSpan={11}>
                  <EmptyState
                    title="No bidder performance data"
                    detail="Bidder metrics will appear once applications are linked to bidder activity."
                    variant="plain"
                    sx={{ py: 3 }}
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
