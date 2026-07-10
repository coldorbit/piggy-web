import { Box, Paper, Stack, Typography } from '@mui/material';

export default function Metric({ icon, label, value, action }) {
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
          bgcolor: 'rgba(0, 103, 192, 0.10)',
          pointerEvents: 'none',
          zIndex: 0,
        },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0} sx={{ flex: 1 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              color: 'primary.dark',
              bgcolor: 'rgba(0, 103, 192, 0.10)',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Stack spacing={0.25} minWidth={0}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={600} noWrap>
              {value}
            </Typography>
          </Stack>
        </Stack>
        {action ? <Box sx={{ ml: 'auto', flexShrink: 0 }}>{action}</Box> : null}
      </Stack>
    </Paper>
  );
}
