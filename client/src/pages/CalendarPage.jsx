import { Alert, Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import SuperadminWorkspaceLens, { ALL_WORKSPACES, filterRowsByWorkspace, workspaceLabel } from '../components/admin/SuperadminWorkspaceLens.jsx';
import CalendarGrid from '../components/calendar/CalendarGrid.jsx';
import CalendarProfileLegend from '../components/calendar/CalendarProfileLegend.jsx';
import CalendarToolbar, { CALENDAR_VIEWS } from '../components/calendar/CalendarToolbar.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { api, downloadAuthenticatedFile, useAdminWorkspaces, useUpdateInterviewCall, useUpdateJobBid } from '../lib/api.js';
import { formatDateInDefaultTimezone } from '../lib/formatters.js';
import { isSuperadmin } from '../lib/roles.js';
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
  const [view, setView] = useState(CALENDAR_VIEWS.week);
  const [cursorDate, setCursorDate] = useState(() => defaultTimezoneTodayKey());
  const [search, setSearch] = useState('');
  const [checkedProfileIds, setCheckedProfileIds] = useState([]);
  const [calendarActionError, setCalendarActionError] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(ALL_WORKSPACES);
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const superadminView = isSuperadmin(currentUser);
  const updateBid = useUpdateJobBid();
  const updateInterviewCall = useUpdateInterviewCall();
  const { data: workspaces = [], isLoading: workspacesLoading } = useAdminWorkspaces({ enabled: superadminView });
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
  const callerUsers = calendarData?.callerUsers || [];
  const calendarMeta = calendarData?.calendar || {};
  const calendarCurrentUser = calendarData?.currentUser || {};
  const allCalendarProfiles = useMemo(
    () =>
      profiles.map((profile) => ({
        ...profile,
        calendarColor: PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green,
        workspaceName: superadminView ? workspaceLabel(workspaces, profile.workspaceId) : '',
      })),
    [profiles, superadminView, workspaces],
  );
  const calendarProfiles = useMemo(
    () => (superadminView ? filterRowsByWorkspace(allCalendarProfiles, activeWorkspaceId) : allCalendarProfiles),
    [activeWorkspaceId, allCalendarProfiles, superadminView],
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
  const pageError = calendarActionError || calendarError?.message || '';
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
  const visibleConflictCount = useMemo(
    () => events.filter((event) => event.hasConflict).length,
    [events],
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

  function moveCalendarEvent(event, startsAt) {
    if (!event || !startsAt || Number.isNaN(startsAt.getTime()) || event.occurrenceLogId) return;
    setCalendarActionError('');
    const scheduledAt = startsAt.toISOString();
    const durationMinutes = event.durationMinutes || event.job?.bid?.interviewDurationMinutes || 60;
    if (event.interviewCallId) {
      updateInterviewCall.mutate(
        {
          interviewCallId: event.interviewCallId,
          callData: { scheduledAt, durationMinutes },
        },
        { onError: (error) => setCalendarActionError(error.message) },
      );
      return;
    }

    if (!event.interviewId || !event.job?.bid) return;
    updateBid.mutate(
      {
        bidId: event.interviewId,
        jobId: event.job.id,
        bidData: {
          ...event.job.bid,
          id: event.interviewId,
          isInterview: true,
          status: event.job.bid.status || 'interviewing',
          interviewNextAt: scheduledAt,
          interviewDurationMinutes: durationMinutes,
        },
      },
      { onError: (error) => setCalendarActionError(error.message) },
    );
  }

  function assignCalendarEvent(event, callerUserId) {
    if (!event?.interviewId || !event.job?.bid) return;
    setCalendarActionError('');
    updateBid.mutate(
      {
        bidId: event.interviewId,
        jobId: event.job.id,
        bidData: {
          ...event.job.bid,
          id: event.interviewId,
          isInterview: true,
          status: event.job.bid.status || 'interviewing',
          callerUserId,
        },
      },
      { onError: (error) => setCalendarActionError(error.message) },
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gap: 1.5,
        gridTemplateRows: [
          pageError ? 'auto' : '',
          superadminView ? 'auto' : '',
          'auto',
          'minmax(0, 1fr)',
        ].filter(Boolean).join(' '),
        overflow: 'hidden',
      }}
    >
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

      {superadminView ? (
        <SuperadminWorkspaceLens
          activeWorkspaceId={activeWorkspaceId}
          isLoading={workspacesLoading}
          rows={allCalendarProfiles}
          subtitle={`${events.length.toLocaleString()} scheduled events in view`}
          title="Calendar workspaces"
          workspaces={workspaces}
          metrics={[
            { label: 'Profiles', value: calendarProfiles.length },
            { label: 'Conflicts', value: visibleConflictCount },
          ]}
          onWorkspaceChange={(value) => {
            setActiveWorkspaceId(value);
            setCalendarActionError('');
          }}
        />
      ) : null}

      <CalendarToolbar
        isLoading={loading}
        conflictCount={visibleConflictCount}
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

        <CalendarGrid
          currentUser={calendarCurrentUser}
          callerUsers={callerUsers}
          cursorDate={cursorDate}
          eventsByDay={eventsByDay}
          isAssigningCaller={updateBid.isPending}
          visibleDays={visibleDays}
          view={view}
          onCallerChange={assignCalendarEvent}
          onEventDrop={moveCalendarEvent}
        />
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
        interviewId: job.interviewId || job.bid?.parentInterviewId || null,
        occurrenceLogId: job.occurrenceLogId || job.bid?.occurrenceLogId || null,
        title: job.title || 'Untitled role',
        company: job.company || 'Unknown company',
        location: job.location || '',
        startsAt,
        durationMinutes: job.bid?.interviewDurationMinutes || 60,
        profile,
        job,
        canDrag: !job.occurrenceLogId && !job.bid?.occurrenceLogId,
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
