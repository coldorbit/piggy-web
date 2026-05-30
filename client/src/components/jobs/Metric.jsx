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
          bgcolor: '#EFF6FF',
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
              borderRadius: 2,
              color: 'primary.dark',
              bgcolor: '#EFF6FF',
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
        {action ? <Box sx={{ ml: 'auto', flexShrink: 0 }}>{action}</Box> : null}
      </Stack>
    </Paper>
  );
}
