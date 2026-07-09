import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import EmptyState from '../common/EmptyState.jsx';
import { labelize, number, percent } from './dashboardFormatters.js';

export default function BidderPerformanceTable({ bidders }) {
  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={900}>Tailoring efficiency</Typography>
        <Typography variant="caption" color="text.secondary">
          Tailor requests compared with applications and interviews by user or bidder.
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 420 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>User / bidder</TableCell>
              <TableCell align="right">Tailor requests</TableCell>
              <TableCell align="right">Apps</TableCell>
              <TableCell align="right">Interviews</TableCell>
              <TableCell align="right">Ready</TableCell>
              <TableCell align="right">Offers</TableCell>
              <TableCell align="right">Lost</TableCell>
              <TableCell align="right">Profiles</TableCell>
              <TableCell align="right">Role families</TableCell>
              <TableCell align="right">Tailor {'->'} App</TableCell>
              <TableCell align="right">Tailor {'->'} Interview</TableCell>
              <TableCell align="right">App {'->'} Interview</TableCell>
              <TableCell align="right">App {'->'} Offer</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bidders.map((bidder) => (
              <TableRow key={bidder.id} hover>
                <TableCell>
                  <Typography fontWeight={900}>{bidder.username}</Typography>
                  <Typography variant="caption" color="text.secondary">{performanceRoleLabel(bidder.role)}</Typography>
                </TableCell>
                <TableCell align="right">{number(bidder.tailoredResumeRequests)}</TableCell>
                <TableCell align="right">{number(bidder.applications)}</TableCell>
                <TableCell align="right">{number(bidder.interviews)}</TableCell>
                <TableCell align="right">{number(bidder.readyTailoredResumes)}</TableCell>
                <TableCell align="right">{number(bidder.offers)}</TableCell>
                <TableCell align="right">{number(bidder.lost)}</TableCell>
                <TableCell align="right">{number(bidder.profilesUsed)}</TableCell>
                <TableCell align="right">{number(bidder.roleFamilies)}</TableCell>
                <TableCell align="right">{percent(bidder.tailoringToApplicationRate)}</TableCell>
                <TableCell align="right">{percent(bidder.tailoringToInterviewRate)}</TableCell>
                <TableCell align="right">{percent(bidder.applicationToInterviewRate)}</TableCell>
                <TableCell align="right">{percent(bidder.applicationToOfferRate)}</TableCell>
              </TableRow>
            ))}
            {!bidders.length ? (
              <TableRow>
                <TableCell colSpan={13}>
                  <EmptyState
                    title="No tailoring efficiency data"
                    detail="Metrics will appear once users or bidders request tailoring, apply, or schedule interviews in this period."
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

function performanceRoleLabel(role) {
  if (['user', 'finance_manager', 'internal'].includes(role)) return 'User';
  if (['bidder', 'readonly_bidder', 'editable_bidder'].includes(role)) return 'Bidder';
  return labelize(role);
}
