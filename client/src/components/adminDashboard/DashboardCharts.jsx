import { Box, Paper, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, labelize, number } from './dashboardFormatters.js';

export function ChartPanel({ children, title }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0, boxShadow: 1 }}>
      <Typography fontWeight={900} sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Paper>
  );
}

export function ActivityTrendChart({ title, trend }) {
  return (
    <ChartPanel title={title}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={trend} margin={{ top: 10, right: 18, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => number(value)} />
          <Legend />
          <Line type="monotone" dataKey="jobs" name="Jobs" stroke="#64748B" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="applications" name="Applications" stroke="#2563EB" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="interviews" name="Interviews" stroke="#0F766E" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="offers" name="Offers" stroke="#7C3AED" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

export function InterviewOutcomeChart({ trend }) {
  return (
    <ChartPanel title="Interview outcomes">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={trend} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => number(value)} />
          <Legend />
          <Bar dataKey="successfulTechnicalInterviews" name="Successful technical" fill="#0F766E" maxBarSize={28} />
          <Bar dataKey="successfulFinalInterviews" name="Successful final" fill="#2563EB" maxBarSize={28} />
          <Bar dataKey="offers" name="Offers" fill="#7C3AED" maxBarSize={28} />
          <Bar dataKey="lostInterviews" name="Lost / failed" fill="#DC2626" maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

export function BreakdownChart({ data = [], title }) {
  return (
    <ChartPanel title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => number(value)} />
            <Legend formatter={(value) => labelize(value)} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ height: 240, display: 'grid', placeItems: 'center' }}>
          <Typography color="text.secondary">No data for this period.</Typography>
        </Box>
      )}
    </ChartPanel>
  );
}
