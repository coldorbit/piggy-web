import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { INTERVIEW_FILTERS } from '../components/interviews/interviewUtils.js';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { api, useBidProfiles } from '../lib/api.js';
import { formatDate, formatDateTime } from '../lib/formatters.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CALENDAR_VIEWS = {
  month: 'month',
  week: 'week',
};

export default function CalendarPage({ currentUser }) {
  const [view, setView] = useState(CALENDAR_VIEWS.month);
  const [cursorDate, setCursorDate] = useState(() => startOfDay(new Date()));
  const [search, setSearch] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { data: profiles = [], isLoading: profilesLoading, error: profilesError } = useBidProfiles(
    currentUser?.role === 'admin' ? { scope: 'manage' } : {},
  );
  const activeProfiles = useMemo(
    () => profiles.filter((profile) => (profile.profileStatus || 'active') === 'active'),
    [profiles],
  );
  const profileById = useMemo(
    () => new Map(activeProfiles.map((profile) => [String(profile.id), profile])),
    [activeProfiles],
  );
  const interviewQueries = useQueries({
    queries: activeProfiles.map((profile) => ({
      queryKey: ['calendar', 'interviews', profile.id],
      queryFn: () => fetchProfileInterviews(profile.id),
      enabled: Boolean(profile.id),
      staleTime: 30_000,
    })),
  });

  useEffect(() => {
    setHeaderSearch({
      isVisible: true,
      placeholder: 'Search calendar',
      value: search,
      onChange: setSearch,
    });
  }, [search, setHeaderSearch]);

  useEffect(() => {
    return () => setHeaderSearch(EMPTY_HEADER_SEARCH);
  }, [setHeaderSearch]);

  const events = useMemo(
    () => calendarEvents(interviewQueries, profileById, search),
    [interviewQueries, profileById, search],
  );
  const loading = profilesLoading || interviewQueries.some((query) => query.isLoading);
  const pageError = profilesError?.message || interviewQueries.find((query) => query.error)?.error?.message || '';
  const visibleDays = view === CALENDAR_VIEWS.week ? weekDays(cursorDate) : monthDays(cursorDate);
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const rangeLabel = view === CALENDAR_VIEWS.week ? weekRangeLabel(cursorDate) : monthLabel(cursorDate);
  const scheduledCount = events.length;

  function moveCursor(direction) {
    setCursorDate((current) => (view === CALENDAR_VIEWS.week ? addDays(current, direction * 7) : addMonths(current, direction)));
  }

  return (
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.5, gridTemplateRows: 'auto auto 1fr' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

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
            <IconButton aria-label="Previous calendar range" onClick={() => moveCursor(-1)} sx={calendarIconButtonSx}>
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next">
            <IconButton aria-label="Next calendar range" onClick={() => moveCursor(1)} sx={calendarIconButtonSx}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
          <Button
            startIcon={<TodayIcon />}
            onClick={() => setCursorDate(startOfDay(new Date()))}
            variant="outlined"
            sx={{ whiteSpace: 'nowrap' }}
          >
            Today
          </Button>
          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Box minWidth={0}>
            <Typography variant="h6" fontWeight={900} noWrap>
              {rangeLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {scheduledCount.toLocaleString()} scheduled interviews
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {loading ? <CircularProgress size={22} /> : null}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_event, nextView) => {
              if (nextView) setView(nextView);
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

      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', minHeight: 32 }}>
        {activeProfiles.slice(0, 10).map((profile) => {
          const color = PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green;
          return (
            <Chip
              key={profile.id}
              label={profile.name}
              size="small"
              sx={{
                bgcolor: color.soft,
                color: color.dark,
                border: 1,
                borderColor: color.main,
                maxWidth: 180,
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          );
        })}
      </Box>

      <Paper
        variant="outlined"
        sx={{
          minHeight: 0,
          overflow: 'hidden',
          boxShadow: 1,
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: 1, borderColor: 'divider' }}>
          {WEEKDAYS.map((day) => (
            <Typography
              key={day}
              align="center"
              color="text.secondary"
              fontWeight={900}
              variant="caption"
              sx={{ py: 1, bgcolor: '#F8FAFC', borderRight: day === 'Sat' ? 0 : 1, borderColor: 'divider' }}
            >
              {day}
            </Typography>
          ))}
        </Box>

        <Box
          sx={{
            minHeight: 0,
            overflow: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(128px, 1fr))',
            gridAutoRows: view === CALENDAR_VIEWS.week ? { xs: 420, md: 'minmax(0, 1fr)' } : 148,
            bgcolor: 'divider',
            gap: '1px',
          }}
        >
          {visibleDays.map((day) => (
            <CalendarDay
              key={day.toISOString()}
              day={day}
              events={eventsByDay.get(dayKey(day)) || []}
              isCurrentMonth={day.getMonth() === cursorDate.getMonth()}
              isMonthView={view === CALENDAR_VIEWS.month}
            />
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

function CalendarDay({ day, events, isCurrentMonth, isMonthView }) {
  const isToday = sameDay(day, new Date());
  const displayedEvents = isMonthView ? events.slice(0, 4) : events;
  const hiddenCount = events.length - displayedEvents.length;

  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 0,
        bgcolor: isCurrentMonth || !isMonthView ? 'background.paper' : '#F8FAFC',
        p: 0.75,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 0.75,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75 }}>
        <Typography
          align="center"
          variant="body2"
          sx={{
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            bgcolor: isToday ? 'primary.main' : 'transparent',
            color: isToday ? 'primary.contrastText' : isCurrentMonth || !isMonthView ? 'text.primary' : 'text.secondary',
            fontWeight: isToday ? 900 : 700,
          }}
        >
          {day.getDate()}
        </Typography>
        {events.length ? (
          <Typography variant="caption" color="text.secondary">
            {events.length}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ minHeight: 0, overflow: 'hidden', display: 'grid', alignContent: 'start', gap: 0.5 }}>
        {displayedEvents.map((event) => (
          <CalendarEvent key={event.id} event={event} />
        ))}
        {hiddenCount > 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.25 }}>
            +{hiddenCount} more
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function CalendarEvent({ event }) {
  const color = PROFILE_COLORS[event.profile?.colorScheme] || PROFILE_COLORS.green;
  return (
    <Tooltip title={`${formatDateTime(event.startsAt)} · ${event.title} · ${event.profile?.name || 'Profile'}`}>
      <Box
        sx={{
          minWidth: 0,
          borderLeft: 3,
          borderColor: color.main,
          bgcolor: color.soft,
          color: color.dark,
          borderRadius: 1,
          px: 0.75,
          py: 0.5,
          display: 'grid',
          gap: 0.1,
        }}
      >
        <Typography variant="caption" fontWeight={900} noWrap>
          {timeLabel(event.startsAt)} {event.title}
        </Typography>
        <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
          {[event.company, event.profile?.name].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function calendarEvents(queries, profileById, search) {
  const pattern = String(search || '').trim().toLowerCase();
  return queries
    .flatMap((query) => query.data?.jobs || [])
    .map((job) => {
      const startsAt = job.bid?.interviewNextAt ? new Date(job.bid.interviewNextAt) : null;
      const profile = profileById.get(String(job.bid?.profileId || ''));
      return {
        id: `${job.bid?.id || job.id}:${job.bid?.interviewNextAt || ''}`,
        title: job.title || 'Untitled role',
        company: job.company || 'Unknown company',
        location: job.location || '',
        startsAt,
        profile,
        job,
      };
    })
    .filter((event) => event.startsAt && !Number.isNaN(event.startsAt.getTime()))
    .filter((event) => {
      if (!pattern) return true;
      return [event.title, event.company, event.location, event.profile?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(pattern));
    })
    .sort((left, right) => left.startsAt - right.startsAt);
}

function fetchProfileInterviews(profileId) {
  const params = new URLSearchParams({
    ...INTERVIEW_FILTERS,
    bidTab: 'interviews',
    profileId: String(profileId),
    limit: '250',
  });
  return api(`/api/bid/jobs?${params}`);
}

function groupEventsByDay(events) {
  const grouped = new Map();
  events.forEach((event) => {
    const key = dayKey(event.startsAt);
    grouped.set(key, [...(grouped.get(key) || []), event]);
  });
  return grouped;
}

function monthDays(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_item, index) => addDays(start, index));
}

function weekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_item, index) => addDays(start, index));
}

function startOfWeek(date) {
  const day = startOfDay(date);
  return addDays(day, -day.getDay());
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function dayKey(date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function sameDay(left, right) {
  return dayKey(left) === dayKey(right);
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function weekRangeLabel(date) {
  const days = weekDays(date);
  return `${formatDate(days[0])} - ${formatDate(days[6])}`;
}

function timeLabel(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const calendarIconButtonSx = {
  width: 36,
  height: 36,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
};
