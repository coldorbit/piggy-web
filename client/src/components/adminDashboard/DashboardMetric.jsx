import { Box, Grid, Paper, Stack, Typography } from '@mui/material';
import { number } from './dashboardFormatters.js';

export default function DashboardMetric({ detail, icon, label, value }) {
  return (
    <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
      <Paper variant="outlined" sx={{ p: 1.25, minHeight: 104, boxShadow: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 1, bgcolor: 'rgba(0, 103, 192, 0.10)', color: 'primary.main' }}>
            {icon}
          </Box>
          <Box minWidth={0}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={600} lineHeight={1.15}>
              {typeof value === 'string' ? value : number(value)}
            </Typography>
          </Box>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }} noWrap>
          {detail}
        </Typography>
      </Paper>
    </Grid>
  );
}
