import { Alert, Box } from '@mui/material';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { filterRowsByWorkspace, workspaceLabel } from '../components/admin/SuperadminWorkspaceLens.jsx';
import { useWorkspaceFilter } from '../components/admin/WorkspaceFilterContext.jsx';
import CalendarGrid from '../components/calendar/CalendarGrid.jsx';
import CalendarScheduleLens from '../components/calendar/CalendarScheduleLens.jsx';
import CalendarToolbar, { CALENDAR_VIEWS } from '../components/calendar/CalendarToolbar.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { PROFILE_COLORS } from '../components/profiles/profileConstants.js';
import { api, downloadAuthenticatedFile, useUpdateInterviewCall, useUpdateJobBid } from '../lib/api.js';
import { formatDateInDefaultTimezone } from '../lib/formatters.js';
import { BIDDER_ROLES, canUseWorkspaceLens } from '../lib/roles.js';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  dateKeyDayOfWeek,
  dateKeyMonth,
  defaultTimezoneDateKey,
  defaultTimezoneTodayKey,
  fromDefaultTimezoneDatetimeLocal,
  monthLabelForDateKey,
} from '../lib/timezone.js';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const UNASSIGNED_CALLER_ID = '__unassigned_caller__';
const UNKNOWN_OWNER_ID = '__unknown_owner__';
const USER_COLOR = { main: '#0067C0', dark: '#004E8C', soft: 'rgba(0, 103, 192, 0.16)' };
const CALLER_COLOR = { main: '#C77700', dark: '#92400E', soft: '#FEF3C7' };
const UNASSIGNED_COLOR = { main: '#94A3B8', dark: '#475569', soft: '#F1F5F9' };
const CALENDAR_STALE_TIME = 60_000;

export default function CalendarPage({ currentUser }) {
  const [view, setView] = useState(CALENDAR_VIEWS.week);
  const [cursorDate, setCursorDate] = useState(() => defaultTimezoneTodayKey());
  const [search, setSearch] = useState('');
  const [checkedProfileIds, setCheckedProfileIds] = useState([]);
  const [checkedUserIds, setCheckedUserIds] = useState([]);
  const [checkedCallerIds, setCheckedCallerIds] = useState([]);
  const [calendarActionError, setCalendarActionError] = useState('');
  const queryClient = useQueryClient();
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { activeWorkspaceId, workspaceError, workspaces } = useWorkspaceFilter();
  const workspaceLensEnabled = canUseWorkspaceLens(currentUser);
  const visibleDays = useMemo(
    () => (view === CALENDAR_VIEWS.week ? weekDays(cursorDate) : monthDays(cursorDate)),
    [cursorDate, view],
  );
  const calendarRange = useMemo(() => calendarRangeForDays(visibleDays), [visibleDays]);
  const calendarWorkspaceId = workspaceLensEnabled ? activeWorkspaceId : 'all';
  const updateBid = useUpdateJobBid();
  const updateInterviewCall = useUpdateInterviewCall();
  const {
    data: calendarData,
    isLoading: calendarLoading,
    isFetching: calendarFetching,
    error: calendarError,
  } = useQuery({
    queryKey: calendarQueryKey(calendarRange, calendarWorkspaceId),
    queryFn: () => fetchCalendarInterviews(calendarRange, calendarWorkspaceId),
    staleTime: CALENDAR_STALE_TIME,
    placeholderData: keepPreviousData,
  });
  const profiles = calendarData?.profiles || EMPTY_ARRAY;
  const jobs = calendarData?.jobs || EMPTY_ARRAY;
  const callerUsers = calendarData?.callerUsers || EMPTY_ARRAY;
  const calendarMeta = calendarData?.calendar || EMPTY_OBJECT;
  const calendarCurrentUser = calendarData?.currentUser || EMPTY_OBJECT;
  const deferredSearch = useDeferredValue(search);
  const allCalendarProfiles = useMemo(
    () =>
      profiles.map((profile) => ({
        ...profile,
        calendarColor: PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green,
        workspaceName: workspaceLensEnabled ? workspaceLabel(workspaces, profile.workspaceId) : '',
      })),
    [profiles, workspaceLensEnabled, workspaces],
  );
  const calendarProfiles = useMemo(
    () => (workspaceLensEnabled ? filterRowsByWorkspace(allCalendarProfiles, activeWorkspaceId) : allCalendarProfiles),
    [activeWorkspaceId, allCalendarProfiles, workspaceLensEnabled],
  );
  const calendarProfileIds = useMemo(
    () => calendarProfiles.map((profile) => String(profile.id)),
    [calendarProfiles],
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
    if (!calendarData) return;
    const adjacentCursors = view === CALENDAR_VIEWS.week
      ? [addDaysToDateKey(cursorDate, -7), addDaysToDateKey(cursorDate, 7)]
      : [addMonthsToDateKey(cursorDate, -1), addMonthsToDateKey(cursorDate, 1)];
    adjacentCursors.forEach((adjacentCursor) => {
      const adjacentDays = view === CALENDAR_VIEWS.week ? weekDays(adjacentCursor) : monthDays(adjacentCursor);
      const adjacentRange = calendarRangeForDays(adjacentDays);
      void queryClient.prefetchQuery({
        queryKey: calendarQueryKey(adjacentRange, calendarWorkspaceId),
        queryFn: () => fetchCalendarInterviews(adjacentRange, calendarWorkspaceId),
        staleTime: CALENDAR_STALE_TIME,
      });
    });
  }, [calendarData, calendarWorkspaceId, cursorDate, queryClient, view]);

  const searchableEvents = useMemo(
    () => calendarEvents(jobs, profileById, calendarProfileIds, deferredSearch, calendarMeta.conflicts || EMPTY_ARRAY),
    [jobs, profileById, calendarProfileIds, deferredSearch, calendarMeta.conflicts],
  );
  const rangeFilteredSearchableEvents = useMemo(
    () => filterEventsByVisibleRange(searchableEvents, view, cursorDate, visibleDays),
    [cursorDate, searchableEvents, view, visibleDays],
  );
  const profileFilteredEvents = useMemo(
    () => filterEventsByProfiles(rangeFilteredSearchableEvents, checkedProfileIds),
    [rangeFilteredSearchableEvents, checkedProfileIds],
  );
  const profileGroups = useMemo(
    () => profileScheduleGroups(calendarProfiles, rangeFilteredSearchableEvents),
    [calendarProfiles, rangeFilteredSearchableEvents],
  );
  const profileGroupIds = useMemo(
    () => profileGroups.map((group) => group.id),
    [profileGroups],
  );
  const profileGroupIdsKey = profileGroupIds.join('\n');
  const userGroups = useMemo(
    () => ownerScheduleGroups(profileFilteredEvents),
    [profileFilteredEvents],
  );
  const callerGroups = useMemo(
    () => callerScheduleGroups(profileFilteredEvents),
    [profileFilteredEvents],
  );

  useEffect(() => {
    setCheckedProfileIds((currentIds) => syncCheckedIds(currentIds, profileGroupIds));
  }, [profileGroupIdsKey]);

  useEffect(() => {
    setCheckedUserIds((currentIds) => syncCheckedIds(currentIds, userGroups.map((group) => group.id)));
  }, [userGroups]);

  useEffect(() => {
    setCheckedCallerIds((currentIds) => syncCheckedIds(currentIds, callerGroups.map((group) => group.id)));
  }, [callerGroups]);

  const events = useMemo(
    () => filterEventsByScheduleLens(profileFilteredEvents, {
      callerGroups,
      checkedCallerIds,
      checkedUserIds,
      userGroups,
    }),
    [callerGroups, checkedCallerIds, checkedUserIds, profileFilteredEvents, userGroups],
  );
  const loading = calendarLoading || calendarFetching;
  const pageError = calendarActionError || calendarError?.message || workspaceError?.message || '';
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
      const nextIds = profileGroupIds.filter((activeId) => currentSet.has(activeId));
      return sameStringArray(currentIds, nextIds) ? currentIds : nextIds;
    });
  }

  function toggleUser(userId, checked) {
    setCheckedUserIds((currentIds) => toggleCheckedId(currentIds, userId, checked, userGroups.map((group) => group.id)));
  }

  function toggleCaller(callerId, checked) {
    setCheckedCallerIds((currentIds) => toggleCheckedId(currentIds, callerId, checked, callerGroups.map((group) => group.id)));
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
          'auto',
          'minmax(0, 1fr)',
        ].filter(Boolean).join(' '),
        overflow: 'hidden',
      }}
    >
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

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
        <CalendarScheduleLens
          callerGroups={callerGroups}
          checkedCallerIds={checkedCallerIds}
          checkedProfileIds={checkedProfileIds}
          checkedUserIds={checkedUserIds}
          profileGroups={profileGroups}
          userGroups={userGroups}
          onCallerChange={toggleCaller}
          onCallerSelectAll={() => setCheckedCallerIds(callerGroups.map((group) => group.id))}
          onCallerSelectNone={() => setCheckedCallerIds([])}
          onProfileChange={toggleProfile}
          onProfileSelectAll={() => setCheckedProfileIds(profileGroupIds)}
          onProfileSelectNone={() => setCheckedProfileIds([])}
          onUserChange={toggleUser}
          onUserSelectAll={() => setCheckedUserIds(userGroups.map((group) => group.id))}
          onUserSelectNone={() => setCheckedUserIds([])}
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

function filterEventsByProfiles(events, checkedProfileIds) {
  const checkedProfileIdSet = new Set(checkedProfileIds.map(String));
  return events.filter((event) => checkedProfileIdSet.has(String(event.profile?.id || '')));
}

function filterEventsByVisibleRange(events, view, cursorDate, visibleDays) {
  if (view === CALENDAR_VIEWS.week) {
    const visibleDaySet = new Set(visibleDays);
    return events.filter((event) => visibleDaySet.has(defaultTimezoneDateKey(event.startsAt)));
  }

  const monthKey = dateKeyMonth(cursorDate);
  return events.filter((event) => {
    const day = defaultTimezoneDateKey(event.startsAt);
    return dateKeyMonth(day) === monthKey && isWeekday(day);
  });
}

function profileScheduleGroups(profiles, events) {
  const eventsByProfileId = new Map();
  events.forEach((event) => addEventToGroup(eventsByProfileId, profileGroupBase(event.profile), event));

  return profiles
    .map((profile) => {
      const id = String(profile.id);
      const eventGroup = eventsByProfileId.get(id);
      if (!eventGroup) return null;
      return {
        ...profileGroupBase(profile),
        count: eventGroup.count,
        nextAt: eventGroup.nextAt,
      };
    })
    .filter(Boolean)
    .sort(scheduleGroupSort);
}

function ownerScheduleGroups(events) {
  const groups = new Map();
  events.forEach((event) => {
    addEventToGroup(groups, ownerGroupBase(event), event);
  });
  return [...groups.values()].sort(scheduleGroupSort);
}

function callerScheduleGroups(events) {
  const groups = new Map();
  events.forEach((event) => addEventToGroup(groups, callerGroupBase(event), event));
  return [...groups.values()].sort(scheduleGroupSort);
}

function filterEventsByScheduleLens(events, { callerGroups, checkedCallerIds, checkedUserIds, userGroups }) {
  const userGroupIds = new Set(userGroups.map((group) => String(group.id)));
  const callerGroupIds = new Set(callerGroups.map((group) => String(group.id)));
  const checkedUserIdSet = new Set(checkedUserIds.map(String));
  const checkedCallerIdSet = new Set(checkedCallerIds.map(String));

  return events.filter((event) => {
    const ownerGroup = ownerGroupBase(event);
    const ownerId = String(ownerGroup.id);
    if (userGroupIds.has(ownerId) && !checkedUserIdSet.has(ownerId)) return false;

    const callerId = String(callerGroupBase(event).id);
    if (callerGroupIds.has(callerId) && !checkedCallerIdSet.has(callerId)) return false;
    return true;
  });
}

function profileGroupBase(profile = {}) {
  const color = profile.calendarColor || PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green;
  return {
    id: String(profile.id || ''),
    label: profile.name || 'Profile',
    color,
    count: 0,
    nextAt: null,
  };
}

function ownerGroupBase(event) {
  const owner = profileOwnerForEvent(event);
  const ownerId = owner.id || UNKNOWN_OWNER_ID;
  return {
    id: String(ownerId),
    label: owner.username || (ownerId === UNKNOWN_OWNER_ID ? 'Unknown owner' : `User #${ownerId}`),
    color: USER_COLOR,
    count: 0,
    nextAt: null,
  };
}

function profileOwnerForEvent(event) {
  const profile = event.profile || {};
  const profileOwnerId = profile.userId || event.job?.bid?.profileOwnerUserId || null;
  const profileOwnerUsername = profile.ownerUsername || event.job?.bid?.profileOwnerUsername || '';
  if (profileOwnerId || profileOwnerUsername) {
    return { id: profileOwnerId, username: profileOwnerUsername };
  }
  const bidUser = event.job?.bid?.user || null;
  if (BIDDER_ROLES.includes(bidUser?.role)) return { id: null, username: '' };
  return { id: bidUser?.id || event.job?.bid?.userId || null, username: bidUser?.username || '' };
}

function callerGroupBase(event) {
  const caller = event.job?.bid?.callerUser || null;
  const callerId = caller?.id || event.job?.bid?.callerUserId || UNASSIGNED_CALLER_ID;
  const isUnassigned = callerId === UNASSIGNED_CALLER_ID;
  return {
    id: String(callerId),
    label: caller?.username || (isUnassigned ? 'Unassigned caller' : `Caller #${callerId}`),
    color: isUnassigned ? UNASSIGNED_COLOR : CALLER_COLOR,
    count: 0,
    nextAt: null,
  };
}

function addEventToGroup(groups, baseGroup, event) {
  if (!baseGroup.id) return;
  const id = String(baseGroup.id);
  if (!groups.has(id)) groups.set(id, { ...baseGroup });
  const group = groups.get(id);
  group.count += 1;
  if (!group.nextAt || event.startsAt < group.nextAt) group.nextAt = event.startsAt;
}

function scheduleGroupSort(left, right) {
  const countDiff = right.count - left.count;
  if (countDiff) return countDiff;
  if (left.nextAt && right.nextAt) {
    const dateDiff = left.nextAt - right.nextAt;
    if (dateDiff) return dateDiff;
  }
  if (left.nextAt) return -1;
  if (right.nextAt) return 1;
  return String(left.label).localeCompare(String(right.label));
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

function sameStringArray(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => String(value) === String(right[index]));
}

function syncCheckedIds(currentIds, activeIds) {
  const activeIdSet = new Set(activeIds.map(String));
  const keptIds = currentIds.map(String).filter((id) => activeIdSet.has(id));
  const addedIds = activeIds.map(String).filter((id) => !keptIds.includes(id));
  const nextIds = [...keptIds, ...addedIds];
  return sameStringArray(currentIds, nextIds) ? currentIds : nextIds;
}

function toggleCheckedId(currentIds, rawId, checked, activeIds) {
  const id = String(rawId);
  const currentSet = new Set(currentIds.map(String));
  if (checked) currentSet.add(id);
  else currentSet.delete(id);
  const nextIds = activeIds.map(String).filter((activeId) => currentSet.has(activeId));
  return sameStringArray(currentIds, nextIds) ? currentIds : nextIds;
}

function fetchCalendarInterviews(range, workspaceId) {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  if (workspaceId && workspaceId !== 'all') query.set('workspaceId', String(workspaceId));
  return api(`/api/bid/calendar?${query}`);
}

function calendarQueryKey(range, workspaceId) {
  return ['calendar', 'interviews', workspaceId || 'all', range.from, range.to];
}

function calendarRangeForDays(days) {
  const firstDay = days[0];
  const dayAfterLast = addDaysToDateKey(days[days.length - 1], 1);
  return {
    from: fromDefaultTimezoneDatetimeLocal(`${firstDay}T00:00`),
    to: fromDefaultTimezoneDatetimeLocal(`${dayAfterLast}T00:00`),
  };
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
  return filterEventsByVisibleRange(events, view, cursorDate, visibleDays).length;
}

function monthDays(dateKey) {
  const start = startOfWorkWeek(`${dateKeyMonth(dateKey)}-01`);
  return Array.from({ length: 6 }, (_item, weekIndex) =>
    Array.from({ length: 5 }, (_dayItem, dayIndex) => addDays(start, weekIndex * 7 + dayIndex)),
  ).flat();
}

function weekDays(dateKey) {
  const start = startOfWorkWeek(dateKey);
  return Array.from({ length: 5 }, (_item, index) => addDays(start, index));
}

function startOfWorkWeek(dateKey) {
  return addDays(dateKey, -workWeekOffset(dateKey));
}

function workWeekOffset(dateKey) {
  const dayOfWeek = dateKeyDayOfWeek(dateKey);
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
}

function isWeekday(dateKey) {
  const dayOfWeek = dateKeyDayOfWeek(dateKey);
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

function addDays(dateKey, days) {
  return addDaysToDateKey(dateKey, days);
}

function monthLabel(dateKey) {
  return monthLabelForDateKey(dateKey);
}

function weekRangeLabel(date) {
  const days = weekDays(date);
  return `${formatDateInDefaultTimezone(days[0])} - ${formatDateInDefaultTimezone(days[days.length - 1])}`;
}
