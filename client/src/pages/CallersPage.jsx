import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import CallerCard from '../components/callers/CallerCard.jsx';
import CallerRegisterDialog from '../components/callers/CallerRegisterDialog.jsx';
import CallersHeader from '../components/callers/CallersHeader.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useCallers, useCreateCaller } from '../lib/api.js';

const EMPTY_CALLER = { email: '', username: '', password: '' };

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
      <CallersHeader callerCount={callers.length} isLoading={isLoading} onRegister={() => setIsRegisterOpen(true)} />

      {isLoading && !callers.length ? (
        <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading callers...</Typography>
        </Paper>
      ) : null}
      {!isLoading && !callers.length ? (
        <EmptyState
          title="No caller accounts yet"
          detail="Register a caller account to start tracking caller-assigned interview work."
        />
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

      <CallerRegisterDialog
        callerForm={callerForm}
        isOpen={isRegisterOpen}
        isSaving={creatingCaller}
        onChange={setCallerForm}
        onClose={closeRegisterDialog}
        onSubmit={submitCaller}
      />
    </Box>
  );
}
