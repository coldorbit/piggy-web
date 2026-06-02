import { CircularProgress, Paper, Typography } from '@mui/material';

export default function InterviewLoadingState() {
  return (
    <Paper variant="outlined" sx={{ m: 1.5, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
      <CircularProgress size={22} />
      <Typography color="text.secondary">Loading interviews...</Typography>
    </Paper>
  );
}
