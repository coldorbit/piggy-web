import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import EmptyState from '../common/EmptyState.jsx';
import { labelize, number, percent } from './dashboardFormatters.js';

export default function FunnelPerformanceTable({ rows, title }) {
  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={900}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">
          Success ratio across application, interview, and offer stages.
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 420 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Apps</TableCell>
              <TableCell align="right">Interviews</TableCell>
              <TableCell align="right">Offers</TableCell>
              <TableCell align="right">Lost</TableCell>
              <TableCell align="right">App {'->'} Interview</TableCell>
              <TableCell align="right">Interview {'->'} Offer</TableCell>
              <TableCell align="right">App {'->'} Offer</TableCell>
              <TableCell align="right">Loss rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id || row.name} hover>
                <TableCell>
                  <Typography fontWeight={900}>{labelize(row.name)}</Typography>
                </TableCell>
                <TableCell align="right">{number(row.applications)}</TableCell>
                <TableCell align="right">{number(row.interviews)}</TableCell>
                <TableCell align="right">{number(row.offers)}</TableCell>
                <TableCell align="right">{number(row.lost)}</TableCell>
                <TableCell align="right">{percent(row.applicationToInterviewRate)}</TableCell>
                <TableCell align="right">{percent(row.interviewToOfferRate)}</TableCell>
                <TableCell align="right">{percent(row.applicationToOfferRate)}</TableCell>
                <TableCell align="right">{percent(row.lossRate)}</TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <EmptyState
                    title="No funnel data"
                    detail="Application, interview, and offer ratios will appear as the funnel fills."
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
