import { Alert, Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import CalendarGrid from '../components/calendar/CalendarGrid.jsx';
import CalendarProfileLegend from '../components/calendar/CalendarProfileLegend.jsx';
import CalendarToolbar, { CALENDAR_VIEWS } from '../components/calendar/CalendarToolbar.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { CALENDAR_PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { api, downloadAuthenticatedFile } from '../lib/api.js';
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

export default function CalendarPage() {
  const [view, setView] = useState(CALENDAR_VIEWS.week);
  const [cursorDate, setCursorDate] = useState(() => defaultTimezoneTodayKey());
  const [search, setSearch] = useState('');
  const [checkedProfileIds, setCheckedProfileIds] = useState([]);
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const {
    data: calendarData,
    isLoading: calendarLoading,
    error: calendarError,
  } = useQuery({
    queryKey: ['calendar', 'interviews'],
    queryFn: fetchCalendarInterviews,
    staleTime: 30_000,
  });
  const profiles = calendarData?.profiles || [];
  const jobs = calendarData?.jobs || [];
  const calendarMeta = calendarData?.calendar || {};
  const currentUser = calendarData?.currentUser || {};
  const calendarProfiles = useMemo(
    () =>
      profiles.map((profile, index) => ({
        ...profile,
        calendarColor: CALENDAR_PROFILE_COLORS[index % CALENDAR_PROFILE_COLORS.length],
      })),
    [profiles],
  );
  const profileById = useMemo(
    () => new Map(calendarProfiles.map((profile) => [String(profile.id), profile])),
    [calendarProfiles],
  );

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

  useEffect(() => {
    setCheckedProfileIds((currentIds) => {
      const activeIds = calendarProfiles.map((profile) => String(profile.id));
      const activeIdSet = new Set(activeIds);
      const keptIds = currentIds.map(String).filter((id) => activeIdSet.has(id));
      const addedIds = activeIds.filter((id) => !keptIds.includes(id));
      return [...keptIds, ...addedIds];
    });
  }, [calendarProfiles]);

  const events = useMemo(
    () => calendarEvents(jobs, profileById, checkedProfileIds, search, calendarMeta.conflicts || []),
    [jobs, profileById, checkedProfileIds, search, calendarMeta.conflicts],
  );
  const loading = calendarLoading;
  const pageError = calendarError?.message || '';
  const visibleDays = useMemo(
    () => (view === CALENDAR_VIEWS.week ? weekDays(cursorDate) : monthDays(cursorDate)),
    [cursorDate, view],
  );
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const rangeLabel = view === CALENDAR_VIEWS.week ? weekRangeLabel(cursorDate) : monthLabel(cursorDate);
  const scheduledCount = useMemo(
    () => scheduledInterviewCount(events, view, cursorDate, visibleDays),
    [cursorDate, events, view, visibleDays],
  );

  function moveCursor(direction) {
    setCursorDate((current) => (view === CALENDAR_VIEWS.week ? addDaysToDateKey(current, direction * 7) : addMonthsToDateKey(current, direction)));
  }

  function toggleProfile(profileId, checked) {
    setCheckedProfileIds((currentIds) => {
      const id = String(profileId);
      const currentSet = new Set(currentIds.map(String));
      if (checked) currentSet.add(id);
      else currentSet.delete(id);
      return calendarProfiles.map((profile) => String(profile.id)).filter((activeId) => currentSet.has(activeId));
    });
  }

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gap: 1.5,
        gridTemplateRows: pageError ? 'auto auto minmax(0, 1fr)' : 'auto minmax(0, 1fr)',
        overflow: 'hidden',
      }}
    >
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

      <CalendarToolbar
        isLoading={loading}
        conflictCount={calendarMeta.conflicts?.length || 0}
        onExportIcs={() => downloadAuthenticatedFile(calendarMeta.icsUrl || '/api/bid/calendar.ics', 'applypilot-interviews.ics')}
        rangeLabel={rangeLabel}
        scheduledCount={scheduledCount}
        view={view}
        onMove={moveCursor}
        onToday={() => setCursorDate(defaultTimezoneTodayKey())}
        onViewChange={setView}
      />

      <Box
        sx={{
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '260px minmax(0, 1fr)' },
          gridTemplateRows: { xs: 'auto minmax(0, 1fr)', md: 'minmax(0, 1fr)' },
          gap: 1.5,
          overflow: 'hidden',
        }}
      >
        <CalendarProfileLegend
          checkedProfileIds={checkedProfileIds}
          profiles={calendarProfiles}
          onChange={toggleProfile}
          onSelectAll={() => setCheckedProfileIds(calendarProfiles.map((profile) => String(profile.id)))}
          onSelectNone={() => setCheckedProfileIds([])}
        />

        <CalendarGrid currentUser={currentUser} cursorDate={cursorDate} eventsByDay={eventsByDay} visibleDays={visibleDays} view={view} />
      </Box>
    </Box>
  );
}

function calendarEvents(jobs, profileById, checkedProfileIds, search, conflicts = []) {
  const pattern = String(search || '').trim().toLowerCase();
  const checkedProfileIdSet = new Set(checkedProfileIds.map(String));
  const conflictIdsByEventId = conflictEventIds(conflicts);
  return jobs
    .map((job) => {
      const startsAt = job.bid?.interviewNextAt ? new Date(job.bid.interviewNextAt) : null;
      const profile = profileById.get(String(job.bid?.profileId || ''));
      const eventId = `${job.bid?.id || job.id}:${job.bid?.interviewNextAt || ''}`;
      return {
        id: eventId,
        sourceId: String(job.bid?.id || job.id || ''),
        interviewCallId: job.interviewCallId || job.bid?.interviewCallId || null,
        title: job.title || 'Untitled role',
        company: job.company || 'Unknown company',
        location: job.location || '',
        startsAt,
        durationMinutes: job.bid?.interviewDurationMinutes || 60,
        profile,
        job,
        hasConflict: conflictIdsByEventId.has(String(job.bid?.id || job.id || '')),
      };
    })
    .filter((event) => event.startsAt && !Number.isNaN(event.startsAt.getTime()))
    .filter((event) => checkedProfileIdSet.has(String(event.profile?.id || '')))
    .filter((event) => {
      if (!pattern) return true;
      return [event.title, event.company, event.location, event.profile?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(pattern));
    })
    .sort((left, right) => left.startsAt - right.startsAt);
}

function conflictEventIds(conflicts) {
  const ids = new Set();
  for (const conflict of conflicts || []) {
    for (const event of conflict.events || []) {
      if (event.id) ids.add(String(event.id));
    }
  }
  return ids;
}

function fetchCalendarInterviews() {
  return api('/api/bid/calendar');
}

function groupEventsByDay(events) {
  const grouped = new Map();
  events.forEach((event) => {
    const key = defaultTimezoneDateKey(event.startsAt);
    grouped.set(key, [...(grouped.get(key) || []), event]);
  });
  return grouped;
}

function scheduledInterviewCount(events, view, cursorDate, visibleDays) {
  if (view === CALENDAR_VIEWS.week) {
    const visibleDaySet = new Set(visibleDays);
    return events.filter((event) => visibleDaySet.has(defaultTimezoneDateKey(event.startsAt))).length;
  }

  const monthKey = dateKeyMonth(cursorDate);
  return events.filter((event) => dateKeyMonth(defaultTimezoneDateKey(event.startsAt)) === monthKey).length;
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
