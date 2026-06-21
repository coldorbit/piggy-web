import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import TodayIcon from '@mui/icons-material/Today';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { DEFAULT_TIME_ZONE_LABEL } from '../../lib/timezone.js';

export const CALENDAR_VIEWS = {
  month: 'month',
  week: 'week',
};

export default function CalendarToolbar({ conflictCount = 0, isLoading, onExportIcs, rangeLabel, scheduledCount, view, onMove, onToday, onViewChange }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: { xs: 1.25, md: 1.75 },
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        flexWrap: 'wrap',
        boxShadow: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Tooltip title="Previous">
          <IconButton aria-label="Previous calendar range" onClick={() => onMove(-1)} sx={calendarIconButtonSx}>
            <ChevronLeftIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Next">
          <IconButton aria-label="Next calendar range" onClick={() => onMove(1)} sx={calendarIconButtonSx}>
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
        <Button startIcon={<TodayIcon />} onClick={onToday} variant="outlined" sx={{ whiteSpace: 'nowrap' }}>
          Today
        </Button>
        <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', sm: 'block' } }} />
        <Box minWidth={0}>
          <Typography variant="h6" fontWeight={900} noWrap>
            {rangeLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {scheduledCount.toLocaleString()} scheduled interviews · {DEFAULT_TIME_ZONE_LABEL}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {isLoading ? <CircularProgress size={22} /> : null}
        {conflictCount ? (
          <Typography variant="caption" color="error" fontWeight={900}>
            {conflictCount.toLocaleString()} conflict{conflictCount === 1 ? '' : 's'}
          </Typography>
        ) : null}
        <Button startIcon={<DownloadIcon />} onClick={onExportIcs} variant="outlined" sx={{ whiteSpace: 'nowrap' }}>
          ICS
        </Button>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_event, nextView) => {
            if (nextView) onViewChange(nextView);
          }}
          sx={{
            '& .MuiToggleButton-root': {
              px: 1.5,
              minWidth: 72,
              fontWeight: 800,
            },
          }}
        >
          <ToggleButton value={CALENDAR_VIEWS.week}>Week</ToggleButton>
          <ToggleButton value={CALENDAR_VIEWS.month}>Month</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Paper>
  );
}

const calendarIconButtonSx = {
  width: 36,
  height: 36,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
};
