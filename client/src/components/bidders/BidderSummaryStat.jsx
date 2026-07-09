import { Paper, Typography } from '@mui/material';

export default function BidderSummaryStat({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 1, bgcolor: 'rgba(246, 248, 251, 0.86)' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        {label}
      </Typography>
      <Typography fontWeight={900}>{Number(value || 0).toLocaleString()}</Typography>
    </Paper>
  );
}
