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
import EmptyState from '../common/EmptyState.jsx';
import { CHART_COLORS, labelize, number, percent } from './dashboardFormatters.js';

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
        <LineChart data={trend} margin={{ top: 10, right: 24, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(0, 0, 0, 0.09)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="volume" allowDecimals={false} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="outcomes" orientation="right" allowDecimals={false} tick={{ fill: '#486860', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value, name) => [number(value), name]} />
          <Legend />
          <Line yAxisId="volume" type="monotone" dataKey="jobs" name="Jobs" stroke="#5F5F5F" strokeWidth={2} dot={false} />
          <Line yAxisId="volume" type="monotone" dataKey="applications" name="Applications" stroke="#0067C0" strokeWidth={2} dot={false} />
          <Line yAxisId="outcomes" type="monotone" dataKey="interviews" name="Interviews" stroke="#486860" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line yAxisId="outcomes" type="monotone" dataKey="offers" name="Offers" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
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
          <CartesianGrid stroke="rgba(0, 0, 0, 0.09)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => number(value)} />
          <Legend />
          <Bar dataKey="successfulTechnicalInterviews" name="Successful technical" fill="#486860" maxBarSize={28} />
          <Bar dataKey="successfulFinalInterviews" name="Successful final" fill="#0067C0" maxBarSize={28} />
          <Bar dataKey="offers" name="Offers" fill="#7C3AED" maxBarSize={28} />
          <Bar dataKey="lostInterviews" name="Lost / failed" fill="#C42B1C" maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

export function BreakdownChart({ data = [], title }) {
  const total = data.reduce((sum, item) => sum + Number(item.count || 0), 0);

  return (
    <ChartPanel title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius={46}
              outerRadius={76}
              paddingAngle={2}
              labelLine
              label={(entry) => `${labelize(entry.name)} ${percent(Number(entry.count || 0) / Math.max(total, 1))}`}
            >
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
          <EmptyState
            title="No data for this period"
            detail="Try another period or wait for more activity to be recorded."
            variant="plain"
            sx={{ p: 2 }}
          />
        </Box>
      )}
    </ChartPanel>
  );
}

export function FunnelConversionChart({ data = [], title }) {
  return (
    <ChartPanel title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.slice(0, 10)} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(0, 0, 0, 0.09)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={72} />
            <YAxis tickFormatter={(value) => percent(value)} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => percent(value)} />
            <Legend />
            <Bar dataKey="applicationToInterviewRate" name="App to interview" fill="#0067C0" maxBarSize={26} minPointSize={3} />
            <Bar dataKey="interviewToOfferRate" name="Interview to offer" fill="#486860" maxBarSize={26} minPointSize={3} />
            <Bar dataKey="applicationToOfferRate" name="App to offer" fill="#7C3AED" maxBarSize={26} minPointSize={3} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ height: 300, display: 'grid', placeItems: 'center' }}>
          <EmptyState
            title="No funnel data for this period"
            detail="Conversion ratios will appear after applications move into interviews or offers."
            variant="plain"
            sx={{ p: 2 }}
          />
        </Box>
      )}
    </ChartPanel>
  );
}

export function PerformanceVolumeChart({ bars = [], data = [], title, xKey = 'name' }) {
  return (
    <ChartPanel title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data.slice(0, 12)} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(0, 0, 0, 0.09)" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={76} />
            <YAxis allowDecimals={false} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => number(value)} />
            <Legend />
            {bars.map((bar, index) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label}
                fill={bar.color || CHART_COLORS[index % CHART_COLORS.length]}
                maxBarSize={26}
                minPointSize={bar.minPointSize}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmptyState title="No performance data" detail="Metrics will appear once matching activity is recorded." height={320} />
      )}
    </ChartPanel>
  );
}

export function PerformanceRateChart({ bars = [], data = [], title, xKey = 'name' }) {
  return (
    <ChartPanel title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.slice(0, 12)} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(0, 0, 0, 0.09)" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={76} />
            <YAxis tickFormatter={(value) => percent(value)} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => percent(value)} />
            <Legend />
            {bars.map((bar, index) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label}
                fill={bar.color || CHART_COLORS[index % CHART_COLORS.length]}
                maxBarSize={26}
                minPointSize={3}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmptyState title="No conversion data" detail="Rates will appear once records move through the funnel." height={300} />
      )}
    </ChartPanel>
  );
}

export function PerformanceShareChart({ data = [], dataKey, title, nameKey = 'name' }) {
  const pieData = data.filter((item) => Number(item[dataKey] || 0) > 0).slice(0, 8);
  const total = pieData.reduce((sum, item) => sum + Number(item[dataKey] || 0), 0);

  return (
    <ChartPanel title={title}>
      {pieData.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey={dataKey}
              nameKey={nameKey}
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              labelLine
              label={(entry) => `${labelize(entry[nameKey])} ${percent(Number(entry[dataKey] || 0) / Math.max(total, 1))}`}
            >
              {pieData.map((entry, index) => (
                <Cell key={`${entry[nameKey]}-${dataKey}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => number(value)} />
            <Legend formatter={(value) => labelize(value)} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmptyState title="No share data" detail="The split will appear once records have measurable volume." height={300} />
      )}
    </ChartPanel>
  );
}

export function ProfileInterviewTrendChart({ data = [], title }) {
  const { rows, profiles } = profileInterviewTrendSeries(data);

  return (
    <ChartPanel title={title}>
      {rows.length && profiles.length ? (
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={rows} margin={{ top: 10, right: 24, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(0, 0, 0, 0.09)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#5F5F5F', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value, name) => [number(value), name]} />
            <Legend />
            {profiles.map((profile, index) => (
              <Line
                key={profile.key}
                type="monotone"
                dataKey={profile.key}
                name={profile.name}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2.4}
                dot={{ r: 2.5 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmptyState title="No profile interviews" detail="Interview trends will appear once profiles receive interviews in this period." height={340} />
      )}
    </ChartPanel>
  );
}

function profileInterviewTrendSeries(data = []) {
  const profiles = [];
  const profileById = new Map();
  const rowsByBucket = new Map();

  for (const item of data) {
    const profileId = String(item.profileId || item.profileName || 'unknown');
    const key = `profile_${profileId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    if (!profileById.has(profileId)) {
      const profile = {
        id: profileId,
        key,
        name: item.profileName || 'Unknown profile',
        totalInterviews: Number(item.totalInterviews || 0),
      };
      profileById.set(profileId, profile);
      profiles.push(profile);
    }

    const bucketKey = String(item.bucketStart || item.label || '');
    const row = rowsByBucket.get(bucketKey) || { label: item.label || '', bucketStart: item.bucketStart || bucketKey };
    row[key] = Number(item.interviews || 0);
    rowsByBucket.set(bucketKey, row);
  }

  const sortedProfiles = profiles
    .filter((profile) => Number(profile.totalInterviews || 0) > 0)
    .sort((left, right) => right.totalInterviews - left.totalInterviews || left.name.localeCompare(right.name));
  const rows = [...rowsByBucket.values()]
    .sort((left, right) => String(left.bucketStart || '').localeCompare(String(right.bucketStart || '')))
    .map((row) => {
      const filled = { ...row };
      sortedProfiles.forEach((profile) => {
        if (filled[profile.key] === undefined) filled[profile.key] = 0;
      });
      return filled;
    });

  return { profiles: sortedProfiles, rows };
}

function ChartEmptyState({ detail, height, title }) {
  return (
    <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
      <EmptyState title={title} detail={detail} variant="plain" sx={{ p: 2 }} />
    </Box>
  );
}
