import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { INTERVIEW_STAGES } from '../components/bids/bidConstants.js';
import { useCallers, useCreateCaller } from '../lib/api.js';
import { formatDateTime } from '../lib/formatters.js';

const EMPTY_CALLER = { username: '', password: '' };

export default function CallersPage() {
  const { data: callers = [], isLoading, error } = useCallers();
  const { mutate: createCaller, isPending: creatingCaller } = useCreateCaller();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [callerForm, setCallerForm] = useState(EMPTY_CALLER);
  const [registerError, setRegisterError] = useState('');

  function closeRegisterDialog() {
    setIsRegisterOpen(false);
    setCallerForm(EMPTY_CALLER);
    setRegisterError('');
  }

  function submitCaller(event) {
    event.preventDefault();
    setRegisterError('');
    createCaller(callerForm, {
      onSuccess: closeRegisterDialog,
      onError: (callerError) => setRegisterError(callerError.message),
    });
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {registerError ? <Alert severity="error">{registerError}</Alert> : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Typography color="text.secondary">
          {callers.length.toLocaleString()} caller{callers.length === 1 ? '' : 's'}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {isLoading ? <CircularProgress size={22} /> : null}
          <Button startIcon={<PersonAddIcon />} variant="contained" onClick={() => setIsRegisterOpen(true)}>
            Register caller
          </Button>
        </Stack>
      </Stack>

      {isLoading && !callers.length ? (
        <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading callers...</Typography>
        </Paper>
      ) : null}
      {!isLoading && !callers.length ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">No caller accounts are available yet.</Typography>
        </Paper>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {callers.map((caller) => (
          <CallerCard key={caller.id} caller={caller} />
        ))}
      </Box>

      <Dialog open={isRegisterOpen} onClose={closeRegisterDialog} fullWidth maxWidth="xs">
        <form onSubmit={submitCaller}>
          <DialogTitle>Register caller</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
            <TextField
              autoFocus
              label="Email"
              required
              type="email"
              value={callerForm.username}
              onChange={(event) => setCallerForm((current) => ({ ...current, username: event.target.value }))}
            />
            <TextField
              label="Password"
              required
              type="password"
              value={callerForm.password}
              onChange={(event) => setCallerForm((current) => ({ ...current, password: event.target.value }))}
              helperText="Use at least 8 characters."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeRegisterDialog}>Cancel</Button>
            <Button disabled={creatingCaller} type="submit" variant="contained">
              Register
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

function CallerCard({ caller }) {
  const assignments = caller.assignments || [];

  return (
    <Card variant="outlined" sx={{ boxShadow: 1 }}>
      <CardContent sx={{ display: 'grid', gap: 1.25 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'start' }}>
          <Box minWidth={0}>
            <Typography fontWeight={900} noWrap>
              {caller.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active caller
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end" useFlexGap>
            <Chip
              icon={<AssignmentTurnedInIcon />}
              label={`${caller.activeInterviews || 0} active`}
              size="small"
              sx={{ bgcolor: '#edf0ff', color: '#343f91', fontWeight: 900, '& .MuiChip-icon': { color: '#343f91' } }}
            />
            <Chip
              icon={<CalendarMonthIcon />}
              label={`${caller.upcomingInterviews || 0} scheduled`}
              size="small"
              sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 900, '& .MuiChip-icon': { color: '#0F766E' } }}
            />
          </Stack>
        </Box>

        <Stack spacing={0.75}>
          {!assignments.length ? (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#F8FAFC' }}>
              <Typography variant="body2" color="text.secondary">
                No assigned interviews.
              </Typography>
            </Paper>
          ) : null}
          {assignments.map((assignment) => (
            <CallerAssignment key={assignment.id} assignment={assignment} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function CallerAssignment({ assignment }) {
  const stage = INTERVIEW_STAGES.find((item) => item.value === assignment.interviewStage);
  const job = assignment.job || {};
  const profile = assignment.profile || {};

  return (
    <Paper variant="outlined" sx={{ p: 1, display: 'grid', gap: 0.75, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) max-content', gap: 1, alignItems: 'start' }}>
        <Box minWidth={0}>
          <Typography fontWeight={900} variant="body2" noWrap>
            {job.title || 'Untitled role'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {job.company || 'Unknown company'}{profile.name ? ` · ${profile.name}` : ''}
          </Typography>
        </Box>
        {job.url ? (
          <Button
            component="a"
            href={job.url}
            target="_blank"
            rel="noreferrer"
            size="small"
            startIcon={<OpenInNewIcon />}
            variant="outlined"
            sx={{ minHeight: 30, whiteSpace: 'nowrap' }}
          >
            Job
          </Button>
        ) : null}
      </Box>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <Chip label={stage?.label || 'Screening'} size="small" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 900 }} />
        <Chip
          label={assignment.interviewNextAt ? formatDateTime(assignment.interviewNextAt) : 'No date'}
          size="small"
          sx={{ bgcolor: '#ECFDF5', color: '#0F766E', fontWeight: 800 }}
        />
      </Stack>
    </Paper>
  );
}
