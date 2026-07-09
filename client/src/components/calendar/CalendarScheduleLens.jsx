import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import PersonIcon from '@mui/icons-material/Person';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import {
  Box,
  Button,
  Checkbox,
  LinearProgress,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { formatDateInDefaultTimezone } from '../../lib/formatters.js';

const SECTIONS = {
  users: {
    label: 'Users',
    empty: 'No user meetings in this view.',
    icon: <PersonIcon fontSize="small" />,
    color: { main: '#2563EB', dark: '#1E40AF', soft: '#DBEAFE' },
  },
  callers: {
    label: 'Callers',
    empty: 'No caller meetings in this view.',
    icon: <HeadsetMicIcon fontSize="small" />,
    color: { main: '#D97706', dark: '#92400E', soft: '#FEF3C7' },
  },
  profiles: {
    label: 'Profiles',
    empty: 'No scheduled profiles.',
    icon: <WorkspacesIcon fontSize="small" />,
    color: { main: '#64748B', dark: '#334155', soft: '#F1F5F9' },
  },
};

export default function CalendarScheduleLens({
  callerGroups = [],
  checkedCallerIds = [],
  checkedProfileIds = [],
  checkedUserIds = [],
  profileGroups = [],
  userGroups = [],
  onCallerChange,
  onCallerSelectAll,
  onCallerSelectNone,
  onProfileChange,
  onProfileSelectAll,
  onProfileSelectNone,
  onUserChange,
  onUserSelectAll,
  onUserSelectNone,
}) {
  const [activeSection, setActiveSection] = useState('users');
  const sectionData = useMemo(
    () => ({
      users: {
        rows: userGroups,
        checkedIds: checkedUserIds,
        onChange: onUserChange,
        onSelectAll: onUserSelectAll,
        onSelectNone: onUserSelectNone,
      },
      callers: {
        rows: callerGroups,
        checkedIds: checkedCallerIds,
        onChange: onCallerChange,
        onSelectAll: onCallerSelectAll,
        onSelectNone: onCallerSelectNone,
      },
      profiles: {
        rows: profileGroups,
        checkedIds: checkedProfileIds,
        onChange: onProfileChange,
        onSelectAll: onProfileSelectAll,
        onSelectNone: onProfileSelectNone,
      },
    }),
    [
      callerGroups,
      checkedCallerIds,
      checkedProfileIds,
      checkedUserIds,
      onCallerChange,
      onCallerSelectAll,
      onCallerSelectNone,
      onProfileChange,
      onProfileSelectAll,
      onProfileSelectNone,
      onUserChange,
      onUserSelectAll,
      onUserSelectNone,
      profileGroups,
      userGroups,
    ],
  );
  const activeConfig = SECTIONS[activeSection];
  const activeData = sectionData[activeSection];
  const checkedSet = new Set(activeData.checkedIds.map(String));
  const selectedCount = activeData.rows.filter((row) => checkedSet.has(String(row.id))).length;
  const scheduledCount = activeData.rows.reduce((sum, row) => sum + row.count, 0);
  const maxCount = Math.max(...activeData.rows.map((row) => row.count), 1);

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: 1,
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
      }}
    >
      <Box sx={{ px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
          Schedule lens
        </Typography>
        <Typography variant="body2" fontWeight={900} noWrap>
          {scheduledCount.toLocaleString()} meetings by {activeConfig.label.toLowerCase()}
        </Typography>
      </Box>

      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'grid', gap: 1 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={activeSection}
          onChange={(_event, nextSection) => {
            if (nextSection) setActiveSection(nextSection);
          }}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 0.5,
            '& .MuiToggleButtonGroup-grouped': {
              m: 0,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            },
            '& .MuiToggleButton-root': {
              minWidth: 0,
              justifyContent: 'flex-start',
              gap: 0.5,
              px: 0.75,
              py: 0.45,
              fontWeight: 900,
            },
          }}
        >
          {Object.entries(SECTIONS).map(([key, section]) => (
            <ToggleButton key={key} value={key}>
              {section.icon}
              <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {section.label}
              </Box>
              <Box component="span" sx={{ ml: 'auto', color: 'text.secondary', fontWeight: 900 }}>
                {sectionData[key].rows.length}
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: 0.75 }}>
          <Box minWidth={0} sx={{ display: 'flex', alignItems: 'center', minHeight: 30 }}>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {selectedCount.toLocaleString()} of {activeData.rows.length.toLocaleString()} visible
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={activeData.onSelectAll}>
            All
          </Button>
          <Button size="small" variant="outlined" onClick={activeData.onSelectNone}>
            None
          </Button>
        </Box>
      </Box>

      <Box sx={{ minHeight: 0, overflow: 'auto', display: 'grid', alignContent: 'start', gap: 0.75, p: 1 }}>
        {activeData.rows.length ? (
          activeData.rows.map((row) => (
            <ScheduleLensRow
              key={row.id}
              checked={checkedSet.has(String(row.id))}
              maxCount={maxCount}
              row={row}
              sectionColor={activeConfig.color}
              onChange={activeData.onChange}
            />
          ))
        ) : (
          <Typography color="text.secondary" sx={{ px: 0.25, py: 0.5 }}>
            {activeConfig.empty}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

function ScheduleLensRow({ checked, maxCount, row, sectionColor, onChange }) {
  const color = row.color || sectionColor;
  const nextLabel = row.nextAt ? formatDateInDefaultTimezone(row.nextAt) : 'No upcoming';
  return (
    <Tooltip title={`${row.label}: ${row.count.toLocaleString()} scheduled meeting${row.count === 1 ? '' : 's'} · next ${nextLabel}`}>
      <Box
        component="label"
        sx={{
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 0.75,
          border: 1,
          borderColor: checked ? color.main : 'divider',
          bgcolor: checked ? color.soft : '#F8FAFC',
          color: checked ? color.dark : 'text.secondary',
          borderRadius: 1,
          px: 0.75,
          py: 0.55,
          cursor: 'pointer',
        }}
      >
        <Checkbox
          checked={checked}
          size="small"
          onChange={(event) => onChange(row.id, event.target.checked)}
          sx={{
            p: 0,
            color: color.main,
            '&.Mui-checked': {
              color: color.main,
            },
          }}
        />
        <Box minWidth={0} sx={{ display: 'grid', gap: 0.35 }}>
          <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color.main, flexShrink: 0 }} />
            <Typography variant="body2" fontWeight={900} noWrap>
              {row.label}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 0.75 }}>
            <LinearProgress
              variant="determinate"
              value={(row.count / maxCount) * 100}
              sx={{
                height: 5,
                borderRadius: 1,
                bgcolor: '#E2E8F0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 1,
                  bgcolor: color.main,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" fontWeight={800} noWrap>
              {nextLabel}
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" fontWeight={900} color={checked ? color.dark : 'text.secondary'}>
          {row.count.toLocaleString()}
        </Typography>
      </Box>
    </Tooltip>
  );
}
