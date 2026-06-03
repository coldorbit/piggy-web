import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shortDayLabel } from './bidderUtils.js';

const SOURCE_BAR_COLORS = {
  builtin: '#2563EB',
  'built in': '#2563EB',
  diversityjobs: '#E11D48',
  hiringcafe: '#D97706',
  jobright: '#059669',
  linkedin: '#0284C7',
  remotehunter: '#4F46E5',
  remoteyeah: '#0D9488',
  simplify: '#7C3AED',
  unknown: '#64748B',
};

const SOURCE_FALLBACK_COLORS = ['#475569', '#BE123C', '#9333EA', '#EA580C', '#15803D', '#0891B2'];

export default function DailyApplicationsChart({ data }) {
  const sources = buildSources(data);
  const chartData = data.map((item) => ({
    ...item,
    day: shortDayLabel(item.date),
    applications: Number(item.applications || 0),
    ...sourceApplicationValues(item.sources, sources),
  }));

  return (
    <Paper variant="outlined" sx={{ p: 1, bgcolor: '#F8FAFC' }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}>
          <CalendarMonthIcon fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={900}>
            Daily applications
          </Typography>
        </Stack>
        {sources.length ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="flex-end" useFlexGap>
            {sources.map((source) => (
              <Stack key={source.key} direction="row" spacing={0.35} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: source.color, flex: '0 0 auto' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, maxWidth: 88 }} noWrap>
                  {source.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}
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
              formatter={(value, name) => {
                if (!Number(value)) return null;
                return [Number(value).toLocaleString(), name];
              }}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.date || ''}
            />
            {sources.length ? (
              sources.map((source) => (
                <Bar
                  key={source.key}
                  dataKey={source.key}
                  name={source.label}
                  stackId="applications"
                  fill={source.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              ))
            ) : (
              <Bar dataKey="applications" name="Applications" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={24} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}

function buildSources(data) {
  const sourceTotals = new Map();
  for (const item of data) {
    for (const sourceItem of item.sources || []) {
      const label = sourceLabel(sourceItem.source);
      sourceTotals.set(label, (sourceTotals.get(label) || 0) + Number(sourceItem.applications || 0));
    }
  }

  return [...sourceTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label], index) => ({
      key: `source_${index}`,
      label,
      color: sourceColor(label),
    }));
}

function sourceApplicationValues(sourceItems = [], sources) {
  const values = Object.fromEntries(sources.map((source) => [source.key, 0]));
  for (const sourceItem of sourceItems || []) {
    const source = sources.find((item) => item.label === sourceLabel(sourceItem.source));
    if (source) values[source.key] += Number(sourceItem.applications || 0);
  }
  return values;
}

function sourceColor(source) {
  const sourceKey = String(source || '').trim().toLowerCase();
  if (SOURCE_BAR_COLORS[sourceKey]) return SOURCE_BAR_COLORS[sourceKey];
  const fallbackIndex = [...sourceKey].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SOURCE_FALLBACK_COLORS.length;
  return SOURCE_FALLBACK_COLORS[fallbackIndex];
}

function sourceLabel(source) {
  return String(source || 'Unknown').trim() || 'Unknown';
}
