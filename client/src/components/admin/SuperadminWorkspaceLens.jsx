import ApartmentIcon from '@mui/icons-material/Apartment';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { Box, FormControl, InputLabel, MenuItem, Paper, Select, Typography } from '@mui/material';
import { useMemo } from 'react';

export const ALL_WORKSPACES = 'all';
export const UNASSIGNED_WORKSPACE = 'unassigned';

export default function SuperadminWorkspaceLens({
  activeWorkspaceId = ALL_WORKSPACES,
  getWorkspaceId = defaultWorkspaceId,
  isLoading = false,
  metrics = [],
  onWorkspaceChange,
  rows = [],
  subtitle,
  title = 'Workspace command',
  workspaces = [],
}) {
  const workspaceOptions = useMemo(
    () => workspaceOptionsForRows(rows, workspaces, getWorkspaceId),
    [getWorkspaceId, rows, workspaces],
  );
  const activeLabel = activeWorkspaceId === ALL_WORKSPACES
    ? 'All workspaces'
    : workspaceLabel(workspaces, activeWorkspaceId);
  const visibleRows = filterRowsByWorkspace(rows, activeWorkspaceId, getWorkspaceId);
  const preparedMetrics = [
    { label: 'Visible', value: visibleRows.length },
    { label: 'Total', value: rows.length },
    ...metrics,
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        display: 'grid',
        gap: 1,
        overflow: 'hidden',
        boxShadow: 2,
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(240,253,250,0.9) 46%, rgba(239,246,255,0.92))',
        borderColor: 'rgba(37, 99, 235, 0.18)',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          gap: 1.25,
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              bgcolor: '#0f172a',
              color: '#fff',
              boxShadow: '0 10px 22px rgba(15, 23, 42, 0.18)',
              flexShrink: 0,
            }}
          >
            <ApartmentIcon fontSize="small" />
          </Box>
          <Box minWidth={0}>
            <Typography fontWeight={600} noWrap>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {subtitle || activeLabel}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          {preparedMetrics.map((metric) => (
            <MetricChip key={metric.label} metric={metric} />
          ))}
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 300, lg: 340 }, flexShrink: 0 }}>
            <InputLabel>Workspace</InputLabel>
            <Select
              disabled={isLoading}
              label="Workspace"
              value={String(activeWorkspaceId)}
              onChange={(event) => onWorkspaceChange?.(event.target.value)}
              startAdornment={<FilterAltIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.75 }} />}
            >
              <MenuItem value={ALL_WORKSPACES}>All workspaces</MenuItem>
              {workspaceOptions.map((workspace) => (
                <MenuItem key={workspace.id} value={String(workspace.id)}>
                  {workspace.name} · {workspace.count.toLocaleString()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

    </Paper>
  );
}

export function filterRowsByWorkspace(rows = [], activeWorkspaceId = ALL_WORKSPACES, getWorkspaceId = defaultWorkspaceId) {
  if (activeWorkspaceId === ALL_WORKSPACES) return rows;
  return rows.filter((row) => String(getWorkspaceId(row) || UNASSIGNED_WORKSPACE) === String(activeWorkspaceId));
}

export function workspaceLabel(workspaces = [], workspaceId) {
  if (!workspaceId || workspaceId === UNASSIGNED_WORKSPACE) return 'Unassigned workspace';
  const workspace = workspaces.find((item) => String(item.id) === String(workspaceId));
  return workspace?.name || `Workspace ${workspaceId}`;
}

export function defaultWorkspaceId(row) {
  return row?.workspaceId ?? row?.workspace?.id ?? UNASSIGNED_WORKSPACE;
}

function MetricChip({ metric }) {
  return (
    <Box
      sx={{
        minWidth: 86,
        px: 1,
        py: 0.55,
        border: 1,
        borderColor: 'rgba(15, 23, 42, 0.08)',
        borderRadius: 1,
        bgcolor: 'rgba(255,255,255,0.76)',
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', textTransform: 'uppercase' }}>
        {metric.label}
      </Typography>
      <Typography fontWeight={600} lineHeight={1.1}>
        {formatMetricValue(metric.value)}
      </Typography>
    </Box>
  );
}

function workspaceOptionsForRows(rows, workspaces, getWorkspaceId) {
  const counts = new Map();
  for (const row of rows) {
    const workspaceId = String(getWorkspaceId(row) || UNASSIGNED_WORKSPACE);
    counts.set(workspaceId, (counts.get(workspaceId) || 0) + 1);
  }

  const knownOptions = workspaces.map((workspace) => ({
    id: String(workspace.id),
    name: workspace.name,
    count: counts.get(String(workspace.id)) || 0,
  }));
  const knownIds = new Set(knownOptions.map((workspace) => workspace.id));
  const unknownOptions = [...counts.entries()]
    .filter(([workspaceId]) => !knownIds.has(workspaceId))
    .map(([workspaceId, count]) => ({
      id: workspaceId,
      name: workspaceLabel(workspaces, workspaceId),
      count,
    }));

  return [...knownOptions, ...unknownOptions]
    .filter((workspace) => workspace.count > 0 || workspace.id !== UNASSIGNED_WORKSPACE)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name);
    });
}

function formatMetricValue(value) {
  if (typeof value === 'number') return value.toLocaleString();
  return value ?? '-';
}
