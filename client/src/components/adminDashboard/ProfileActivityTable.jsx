import { Box, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import EmptyState from '../common/EmptyState.jsx';
import { labelize } from './dashboardFormatters.js';

export default function ProfileActivityTable({ rows = [] }) {
  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={900}>Profile application activity</Typography>
        <Typography variant="caption" color="text.secondary">
          Who applied on which profile and job for the selected period.
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 460 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Profile</TableCell>
              <TableCell>Job</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Bid at</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography fontWeight={900}>{row.username}</Typography>
                  <Typography variant="caption" color="text.secondary">{labelize(row.role)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={800}>{row.profileName}</Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 240 }}>
                  <Typography fontWeight={900}>{row.jobTitle}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[row.company, row.publicJobId].filter(Boolean).join(' - ')}
                  </Typography>
                </TableCell>
                <TableCell>{row.source}</TableCell>
                <TableCell>
                  <Chip label={labelize(row.status)} size="small" variant="outlined" sx={{ fontWeight: 800 }} />
                </TableCell>
                <TableCell align="right">{formatDateTime(row.bidAt)}</TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    title="No profile application activity"
                    detail="Application activity will appear once users submit or update bids in this period."
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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
