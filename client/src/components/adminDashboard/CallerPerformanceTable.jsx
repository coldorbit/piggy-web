import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import EmptyState from '../common/EmptyState.jsx';
import { decimal, labelize, number, percent } from './dashboardFormatters.js';

export default function CallerPerformanceTable({ callers }) {
  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={600}>Caller performance</Typography>
        <Typography variant="caption" color="text.secondary">
          Workload, scheduling coverage, and outcomes for caller-assigned interviews.
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 420 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Caller</TableCell>
              <TableCell align="right">Assigned</TableCell>
              <TableCell align="right">Active</TableCell>
              <TableCell align="right">Upcoming</TableCell>
              <TableCell align="right">Avg assigned</TableCell>
              <TableCell align="right">Unscheduled</TableCell>
              <TableCell align="right">Completed</TableCell>
              <TableCell align="right">Won</TableCell>
              <TableCell align="right">Lost</TableCell>
              <TableCell align="right">Technical</TableCell>
              <TableCell align="right">Final</TableCell>
              <TableCell align="right">Meeting links</TableCell>
              <TableCell align="right">Win rate</TableCell>
              <TableCell align="right">Loss rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {callers.map((caller) => (
              <TableRow key={caller.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{caller.username}</Typography>
                  <Typography variant="caption" color="text.secondary">{labelize(caller.role)}</Typography>
                </TableCell>
                <TableCell align="right">{number(caller.assignedInterviews)}</TableCell>
                <TableCell align="right">{number(caller.activeInterviews)}</TableCell>
                <TableCell align="right">{number(caller.upcomingInterviews)}</TableCell>
                <TableCell align="right">{decimal(caller.averageAssignmentsPerPeriod)}</TableCell>
                <TableCell align="right">{number(caller.unscheduledActiveInterviews)}</TableCell>
                <TableCell align="right">{number(caller.completedInterviews)}</TableCell>
                <TableCell align="right">{number(caller.wonInterviews)}</TableCell>
                <TableCell align="right">{number(caller.lostInterviews)}</TableCell>
                <TableCell align="right">{number(caller.technicalInterviews)}</TableCell>
                <TableCell align="right">{number(caller.finalInterviews)}</TableCell>
                <TableCell align="right">{percent(caller.meetingLinkCoverageRate)}</TableCell>
                <TableCell align="right">{percent(caller.callerOfferRate)}</TableCell>
                <TableCell align="right">{percent(caller.callerLossRate)}</TableCell>
              </TableRow>
            ))}
            {!callers.length ? (
              <TableRow>
                <TableCell colSpan={14}>
                  <EmptyState
                    title="No caller activity"
                    detail="Caller metrics will appear once interviews are assigned or completed."
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
