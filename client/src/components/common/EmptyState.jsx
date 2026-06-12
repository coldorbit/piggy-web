import { Box, Paper, Typography } from '@mui/material';

export default function EmptyState({ action = null, detail, title, sx }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 1,
        display: 'grid',
        gap: 1,
        justifyItems: 'center',
        textAlign: 'center',
        bgcolor: '#F8FAFC',
        ...sx,
      }}
    >
      <Box>
        <Typography fontWeight={900}>{title}</Typography>
        {detail ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {detail}
          </Typography>
        ) : null}
      </Box>
      {action}
    </Paper>
  );
}
