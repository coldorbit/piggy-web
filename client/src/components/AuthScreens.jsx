import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useLogin } from '../lib/api.js';

export function ShellLoading() {
  return (
    <Box sx={authPageSx}>
      <Paper variant="outlined" sx={{ p: 3, width: 'min(420px, 100%)', boxShadow: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Avatar
            src="/assets/applypilot-logo.png"
            alt="ApplyPilot logo"
            variant="rounded"
            sx={{ bgcolor: 'background.paper', fontWeight: 800 }}
          />
          <CircularProgress size={24} color="secondary" />
          <Typography color="text.secondary">Preparing your ApplyPilot workspace...</Typography>
        </Stack>
      </Paper>
    </Box>
  );
}

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const { mutate: login, isPending } = useLogin();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    login(
      { username, password },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['me'] });
        },
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  }

  return (
    <Box sx={authPageSx}>
      <Paper
        component="form"
        variant="outlined"
        onSubmit={handleSubmit}
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          width: 'min(440px, 100%)',
          boxShadow: 4,
          backdropFilter: 'blur(18px)',
          bgcolor: 'rgba(255, 255, 255, 0.9)',
        }}
      >
        <Stack spacing={2.25}>
          <Avatar
            src="/assets/applypilot-logo.png"
            alt="ApplyPilot logo"
            variant="rounded"
            sx={{
              width: 50,
              height: 50,
              bgcolor: 'background.paper',
              boxShadow: '0 12px 28px rgba(37, 99, 235, 0.22)',
            }}
          />
          <Typography variant="h4" fontWeight={900}>
            ApplyPilot
          </Typography>
          <Typography color="text.secondary">
            Sign in to curate roles, tailor resumes, and move applications with confidence.
          </Typography>
          <TextField
            autoComplete="username"
            label="Email or username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextField
            autoComplete="current-password"
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button type="submit" variant="contained" disabled={isPending} size="large">
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

const authPageSx = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  p: 3,
  background:
    'radial-gradient(circle at 20% 10%, rgba(37, 99, 235, 0.12), transparent 24rem), radial-gradient(circle at 80% 80%, rgba(15, 118, 110, 0.12), transparent 22rem), #F8FAFC',
};
