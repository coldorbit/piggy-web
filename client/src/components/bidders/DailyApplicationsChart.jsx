import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shortDayLabel } from './bidderUtils.js';

export default function DailyApplicationsChart({ data }) {
  const chartData = data.map((item) => ({
    ...item,
    day: shortDayLabel(item.date),
    applications: Number(item.applications || 0),
  }));

  return (
    <Paper variant="outlined" sx={{ p: 1, bgcolor: '#F8FAFC' }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
        <CalendarMonthIcon fontSize="small" color="action" />
        <Typography variant="body2" fontWeight={900}>
          Daily applications
        </Typography>
      </Stack>
      <Box sx={{ height: 160, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
            <CartesianGrid stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: 'rgba(37, 99, 235, 0.08)' }}
              formatter={(value) => [Number(value).toLocaleString(), 'Applications']}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.date || ''}
            />
            <Bar dataKey="applications" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}
