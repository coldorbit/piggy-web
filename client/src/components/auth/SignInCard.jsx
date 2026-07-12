import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import LockIcon from '@mui/icons-material/Lock';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useLogin } from '../../lib/authApi.js';
import { signinCardSx } from './landingStyles.js';

export default function SignInCard() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const { mutate: login, isPending } = useLogin();

  function handleSubmit(event) {
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
    <Paper id="signin" component="form" variant="outlined" onSubmit={handleSubmit} sx={signinCardSx}>
      <Stack spacing={2.25}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box
            component="img"
            src="/assets/applypilot-wordmark.png"
            alt="ApplyPilot"
            sx={{ width: 150, height: 54, objectFit: 'contain', objectPosition: 'left center', flexShrink: 0 }}
          />
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Client portal
            </Typography>
            <Typography color="text.secondary">Sign in to continue your build.</Typography>
          </Box>
        </Stack>
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
        <Button type="submit" variant="contained" disabled={isPending} size="large" startIcon={<LockIcon />}>
          {isPending ? 'Signing in...' : 'Sign in securely'}
        </Button>
      </Stack>
    </Paper>
  );
}
