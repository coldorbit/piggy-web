import { Avatar, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { authPageSx } from './landingStyles.js';

export default function ShellLoading() {
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
