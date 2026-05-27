import { Box, Paper, Stack, Typography } from '@mui/material';

export default function Metric({ icon, label, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        minHeight: 82,
        p: 1.75,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 1,
        '&::after': {
          content: '""',
          position: 'absolute',
          right: -24,
          top: -32,
          width: 86,
          height: 86,
          borderRadius: '50%',
          bgcolor: 'rgba(95, 91, 216, 0.08)',
        },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 42,
            height: 42,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 2,
            color: 'primary.dark',
            bgcolor: 'rgba(95, 91, 216, 0.1)',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Stack spacing={0.25} minWidth={0}>
          <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={900} noWrap>
            {value}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
