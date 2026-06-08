import { Alert, Box } from '@mui/material';
import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import CalendarGrid from '../components/calendar/CalendarGrid.jsx';
import CalendarProfileLegend from '../components/calendar/CalendarProfileLegend.jsx';
import CalendarToolbar, { CALENDAR_VIEWS } from '../components/calendar/CalendarToolbar.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { INTERVIEW_FILTERS } from '../components/interviews/interviewUtils.js';
import { api, useBidProfiles } from '../lib/api.js';
import { formatDateInDefaultTimezone } from '../lib/formatters.js';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  dateKeyDayOfWeek,
  dateKeyMonth,
  defaultTimezoneDateKey,
  defaultTimezoneTodayKey,
  monthLabelForDateKey,
} from '../lib/timezone.js';

export default function CalendarPage({ currentUser }) {
  const [view, setView] = useState(CALENDAR_VIEWS.month);
  const [cursorDate, setCursorDate] = useState(() => defaultTimezoneTodayKey());
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
    setCursorDate((current) => (view === CALENDAR_VIEWS.week ? addDaysToDateKey(current, direction * 7) : addMonthsToDateKey(current, direction)));
  }

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'grid', gap: 1.5, gridTemplateRows: 'auto auto minmax(0, 1fr)', overflow: 'hidden' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

      <CalendarToolbar
        isLoading={loading}
        rangeLabel={rangeLabel}
        scheduledCount={scheduledCount}
        view={view}
        onMove={moveCursor}
        onToday={() => setCursorDate(defaultTimezoneTodayKey())}
        onViewChange={setView}
      />

      <CalendarProfileLegend profiles={activeProfiles} />

      <CalendarGrid cursorDate={cursorDate} eventsByDay={eventsByDay} visibleDays={visibleDays} view={view} />
    </Box>
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
        durationMinutes: job.bid?.interviewDurationMinutes || 60,
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
    const key = defaultTimezoneDateKey(event.startsAt);
    grouped.set(key, [...(grouped.get(key) || []), event]);
  });
  return grouped;
}

function monthDays(dateKey) {
  const start = startOfWeek(`${dateKeyMonth(dateKey)}-01`);
  return Array.from({ length: 42 }, (_item, index) => addDays(start, index));
}

function weekDays(dateKey) {
  const start = startOfWeek(dateKey);
  return Array.from({ length: 7 }, (_item, index) => addDays(start, index));
}

function startOfWeek(dateKey) {
  return addDays(dateKey, -dateKeyDayOfWeek(dateKey));
}

function addDays(dateKey, days) {
  return addDaysToDateKey(dateKey, days);
}

function monthLabel(dateKey) {
  return monthLabelForDateKey(dateKey);
}

function weekRangeLabel(date) {
  const days = weekDays(date);
  return `${formatDateInDefaultTimezone(days[0])} - ${formatDateInDefaultTimezone(days[6])}`;
}
