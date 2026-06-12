import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { decimal, labelize, number, percent } from './dashboardFormatters.js';

export default function UserPerformanceTable({ users }) {
  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={900}>User performance</Typography>
        <Typography variant="caption" color="text.secondary">
          Ranked by offers, interviews, applications, then username.
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 480 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell align="right">Apps</TableCell>
              <TableCell align="right">Planned</TableCell>
              <TableCell align="right">Submitted</TableCell>
              <TableCell align="right">Interviews</TableCell>
              <TableCell align="right">Upcoming</TableCell>
              <TableCell align="right">Tech success</TableCell>
              <TableCell align="right">Final success</TableCell>
              <TableCell align="right">Offers</TableCell>
              <TableCell align="right">Lost</TableCell>
              <TableCell align="right">Profiles</TableCell>
              <TableCell align="right">Tailored</TableCell>
              <TableCell align="right">Avg apps</TableCell>
              <TableCell align="right">App {'->'} Interview</TableCell>
              <TableCell align="right">App {'->'} Offer</TableCell>
              <TableCell align="right">Interview {'->'} Offer</TableCell>
              <TableCell align="right">Tailoring ready</TableCell>
              <TableCell align="right">Days to interview</TableCell>
              <TableCell>Top mixes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Typography fontWeight={900}>{user.username}</Typography>
                  <Typography variant="caption" color="text.secondary">{labelize(user.role)}</Typography>
                </TableCell>
                <TableCell align="right">{number(user.applications)}</TableCell>
                <TableCell align="right">{number(user.planned)}</TableCell>
                <TableCell align="right">{number(user.submitted)}</TableCell>
                <TableCell align="right">{number(user.interviews)}</TableCell>
                <TableCell align="right">{number(user.upcomingInterviews)}</TableCell>
                <TableCell align="right">{number(user.successfulTechnicalInterviews)}</TableCell>
                <TableCell align="right">{number(user.successfulFinalInterviews)}</TableCell>
                <TableCell align="right">{number(user.offers)}</TableCell>
                <TableCell align="right">{number(user.lostInterviews)}</TableCell>
                <TableCell align="right">{number(user.activeProfiles)} / {number(user.profiles)}</TableCell>
                <TableCell align="right">{number(user.readyTailoredResumes)} / {number(user.tailoredResumeRequests)}</TableCell>
                <TableCell align="right">{decimal(user.averageApplicationsPerPeriod)}</TableCell>
                <TableCell align="right">{percent(user.applicationToInterviewRate)}</TableCell>
                <TableCell align="right">{percent(user.applicationToOfferRate)}</TableCell>
                <TableCell align="right">{percent(user.interviewToOfferRate)}</TableCell>
                <TableCell align="right">{percent(user.tailoringReadyRate)}</TableCell>
                <TableCell align="right">{decimal(user.avgDaysFromApplicationToInterview)}</TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  <MixSummary label="Sources" items={user.sourceMix} />
                  <MixSummary label="Categories" items={user.categoryMix} />
                  <MixSummary label="Profiles" items={user.profileMix} />
                </TableCell>
              </TableRow>
            ))}
            {!users.length ? (
              <TableRow>
                <TableCell colSpan={19}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>No user performance data for this period.</Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function MixSummary({ items = [], label }) {
  if (!items.length) return null;
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
      <Box component="span" sx={{ color: 'text.primary', fontWeight: 900 }}>{label}:</Box>{' '}
      {items.map((item) => `${labelize(item.name)} ${number(item.count)}`).join(', ')}
    </Typography>
  );
}
