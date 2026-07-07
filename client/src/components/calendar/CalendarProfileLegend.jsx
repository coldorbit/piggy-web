import { Box, Button, Checkbox, Paper, Typography } from '@mui/material';

export default function CalendarProfileLegend({ checkedProfileIds, profiles, onChange, onSelectAll, onSelectNone }) {
  const checkedSet = new Set(checkedProfileIds.map(String));
  const checkedCount = profiles.filter((profile) => checkedSet.has(String(profile.id))).length;
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
          Profiles
        </Typography>
        <Typography variant="body2" fontWeight={900}>
          {checkedCount.toLocaleString()} of {profiles.length.toLocaleString()}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Button size="small" variant="outlined" onClick={onSelectAll}>
          All
        </Button>
        <Button size="small" variant="outlined" onClick={onSelectNone}>
          None
        </Button>
      </Box>

      <Box sx={{ minHeight: 0, overflow: 'auto', display: 'grid', alignContent: 'start', gap: 0.75, p: 1 }}>
        {profiles.length ? (
          profiles.map((profile) => {
            const color = profile.calendarColor;
            const checked = checkedSet.has(String(profile.id));
            return (
              <Box
                key={profile.id}
                component="label"
                sx={{
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: 0.75,
                  border: 1,
                  borderColor: checked ? color.main : 'divider',
                  bgcolor: checked ? color.soft : '#F8FAFC',
                  color: checked ? color.dark : 'text.secondary',
                  borderRadius: 1,
                  px: 0.75,
                  py: 0.5,
                  cursor: 'pointer',
                }}
              >
                <Checkbox
                  checked={checked}
                  size="small"
                  onChange={(event) => onChange(profile.id, event.target.checked)}
                  sx={{
                    p: 0,
                    color: color.main,
                    '&.Mui-checked': {
                      color: color.main,
                    },
                  }}
                />
                <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color.main, flexShrink: 0 }} />
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={900} noWrap>
                      {profile.name}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })
        ) : (
          <Typography color="text.secondary" sx={{ px: 0.25, py: 0.5 }}>
            No scheduled profiles.
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
