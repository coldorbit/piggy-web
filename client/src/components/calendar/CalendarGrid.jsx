import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { formatDateTimeInDefaultTimezone } from '../../lib/formatters.js';
import { authUrl, useDeleteInterviewCall } from '../../lib/api.js';
import { BIDDER_ROLES, isSuperadmin } from '../../lib/roles.js';
import {
  dateKeyDay,
  dateKeyDayOfWeek,
  dateKeyMonth,
  defaultTimezoneTodayKey,
  fromDefaultTimezoneDatetimeLocal,
  timeLabelInDefaultTimezone,
  zonedDateParts,
} from '../../lib/timezone.js';
import { PROFILE_COLORS } from '../profiles/profileConstants.js';
import { CALENDAR_VIEWS } from './CalendarToolbar.jsx';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DISPLAY_WEEKDAYS = WEEKDAY_LABELS.slice(1, 6);
const HOURS = Array.from({ length: 24 }, (_item, hour) => hour);
const HOUR_HEIGHT = 64;

export default function CalendarGrid({
  callerUsers = [],
  currentUser = {},
  cursorDate,
  eventsByDay,
  isAssigningCaller = false,
  visibleDays,
  view,
  onCallerChange = null,
  onEventDrop = null,
}) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [draggedEventId, setDraggedEventId] = useState('');
  const selectedEventId = selectedEvent?.id || '';
  const eventById = eventLookup(eventsByDay);

  function handleDragStart(event) {
    setDraggedEventId(event.id);
  }

  function handleDragEnd() {
    setDraggedEventId('');
  }

  function handleEventDrop(eventId, startsAt) {
    const event = eventById.get(eventId);
    setDraggedEventId('');
    if (!event || !onEventDrop) return;
    onEventDrop(event, startsAt);
  }

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          minHeight: 0,
          height: '100%',
          overflow: 'hidden',
          boxShadow: 1,
          display: 'grid',
          gridTemplateRows: view === CALENDAR_VIEWS.week ? '1fr' : 'auto 1fr',
        }}
      >
        {view === CALENDAR_VIEWS.week ? (
          <WeekCalendar
            days={visibleDays}
            draggedEventId={draggedEventId}
            eventsByDay={eventsByDay}
            selectedEventId={selectedEventId}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onEventClick={setSelectedEvent}
            onEventDrop={onEventDrop ? handleEventDrop : null}
          />
        ) : (
          <MonthCalendar
            cursorDate={cursorDate}
            days={visibleDays}
            draggedEventId={draggedEventId}
            eventsByDay={eventsByDay}
            selectedEventId={selectedEventId}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onEventClick={setSelectedEvent}
            onEventDrop={onEventDrop ? handleEventDrop : null}
          />
        )}
      </Paper>
      <CalendarEventDialog
        callerUsers={callerUsers}
        currentUser={currentUser}
        event={selectedEvent}
        isAssigningCaller={isAssigningCaller}
        onCallerChange={onCallerChange}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}

function MonthCalendar({ cursorDate, days, draggedEventId, eventsByDay, selectedEventId, onDragEnd, onDragStart, onEventClick, onEventDrop }) {
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderBottom: 1, borderColor: 'divider' }}>
        {DISPLAY_WEEKDAYS.map((day) => (
          <Typography
            key={day}
            align="center"
            color="text.secondary"
            fontWeight={900}
            variant="caption"
            sx={{ py: 1, bgcolor: '#F8FAFC', borderRight: day === 'Fri' ? 0 : 1, borderColor: 'divider' }}
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
          gridTemplateColumns: 'repeat(5, minmax(128px, 1fr))',
          gridAutoRows: 148,
          bgcolor: 'divider',
          gap: '1px',
        }}
      >
        {days.map((day) => (
          <CalendarDay
            key={day}
            day={day}
            draggedEventId={draggedEventId}
            events={eventsByDay.get(day) || []}
            isCurrentMonth={dateKeyMonth(day) === dateKeyMonth(cursorDate)}
            selectedEventId={selectedEventId}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
          />
        ))}
      </Box>
    </>
  );
}

function WeekCalendar({ days, draggedEventId, eventsByDay, selectedEventId, onDragEnd, onDragStart, onEventClick, onEventDrop }) {
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef(null);
  const centeredRangeRef = useRef('');

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    if (!days.includes(defaultTimezoneTodayKey())) {
      centeredRangeRef.current = '';
      return;
    }
    const rangeKey = days.join(':');
    if (centeredRangeRef.current === rangeKey) return;
    centeredRangeRef.current = rangeKey;
    const centeredTop = eventTop(now) - scrollElement.clientHeight / 2;
    scrollElement.scrollTop = Math.max(0, centeredTop);
  }, [days, now]);

  return (
    <Box ref={scrollRef} sx={{ height: '100%', minHeight: 0, overflow: 'auto', bgcolor: 'background.paper', overscrollBehavior: 'contain' }}>
      <Box
        sx={{
          minWidth: { xs: 660, md: 0 },
          display: 'grid',
          gridTemplateColumns: '64px repeat(5, minmax(104px, 1fr))',
          gridTemplateRows: `56px ${HOURS.length * HOUR_HEIGHT}px`,
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 4,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        />
        {days.map((day) => (
          <WeekDayHeader key={day} day={day} />
        ))}

        <Box
          sx={{
            gridColumn: '1 / 2',
            gridRow: '2 / 3',
            position: 'sticky',
            left: 0,
            zIndex: 3,
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
          }}
        >
          {HOURS.map((hour) => (
            <Typography
              key={hour}
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                height: HOUR_HEIGHT,
                pr: 1,
                textAlign: 'right',
                transform: 'translateY(-0.65em)',
                fontWeight: 700,
              }}
            >
              {hourLabel(hour)}
            </Typography>
          ))}
        </Box>

        {days.map((day, index) => (
          <WeekDayColumn
            key={day}
            day={day}
            column={index + 2}
            draggedEventId={draggedEventId}
            events={eventsByDay.get(day) || []}
            now={now}
            selectedEventId={selectedEventId}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
          />
        ))}
      </Box>
    </Box>
  );
}

function WeekDayHeader({ day }) {
  const isToday = day === defaultTimezoneTodayKey();
  const weekday = WEEKDAY_LABELS[dateKeyDayOfWeek(day)];
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 4,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderLeft: 1,
        borderColor: 'divider',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={900}>
          {weekday}
        </Typography>
        <Typography
          align="center"
          variant="body2"
          sx={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            bgcolor: isToday ? 'primary.main' : 'transparent',
            color: isToday ? 'primary.contrastText' : 'text.primary',
            fontWeight: 900,
          }}
        >
          {dateKeyDay(day)}
        </Typography>
      </Box>
    </Box>
  );
}

function WeekDayColumn({ day, column, draggedEventId, events, now, selectedEventId, onDragEnd, onDragStart, onEventClick, onEventDrop }) {
  const isToday = day === defaultTimezoneTodayKey();
  const currentTimeTop = isToday ? eventTop(now) : null;
  const laidOutEvents = layoutOverlappingEvents(events);

  function handleDragOver(event) {
    if (!onEventDrop || !draggedEventId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(event) {
    if (!onEventDrop) return;
    event.preventDefault();
    const eventId = event.dataTransfer.getData('text/calendar-event-id') || draggedEventId;
    if (!eventId) return;
    onEventDrop(eventId, weekDropDateTime(day, event.currentTarget, event.clientY));
  }

  return (
    <Box
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        gridColumn: `${column} / ${column + 1}`,
        gridRow: '2 / 3',
        position: 'relative',
        minWidth: 0,
        borderLeft: 1,
        borderColor: 'divider',
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, rgba(148, 163, 184, 0.32) ${HOUR_HEIGHT - 1}px, rgba(148, 163, 184, 0.32) ${HOUR_HEIGHT}px)`,
      }}
    >
      {isToday ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(37, 99, 235, 0.035)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {laidOutEvents.map(({ event, layout }) => (
        <WeekCalendarEvent
          key={event.id}
          event={event}
          isDragging={event.id === draggedEventId}
          isSelected={event.id === selectedEventId}
          layout={layout}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onEventClick={onEventClick}
        />
      ))}
      {isToday ? <CurrentTimeLine top={currentTimeTop} /> : null}
    </Box>
  );
}

function WeekCalendarEvent({ event, isDragging, isSelected, layout, onDragEnd, onDragStart, onEventClick }) {
  const color = event.profile?.calendarColor || PROFILE_COLORS[event.profile?.colorScheme] || PROFILE_COLORS.green;
  const top = eventTop(event.startsAt);
  const height = eventHeight(event.durationMinutes);
  const isCompact = height < 44;
  const leftInset = layout?.column === 0 ? 6 : 2;
  const widthInset = layout?.widthPercent === 100 ? 12 : 8;
  const left = layout ? `calc(${layout.leftPercent}% + ${leftInset}px)` : 6;
  const width = layout ? `calc(${layout.widthPercent}% - ${widthInset}px)` : 'calc(100% - 12px)';
  return (
    <Tooltip
      title={`${formatDateTimeInDefaultTimezone(event.startsAt)} · ${durationLabel(event.durationMinutes)} · ${event.title} · ${
        event.profile?.name || 'Profile'
      } · ${calendarPeopleLabel(event)}`}
    >
      <Box
        component="button"
        type="button"
        draggable={Boolean(event.canDrag)}
        aria-pressed={isSelected}
        onDragEnd={onDragEnd}
        onDragStart={(dragEvent) => beginEventDrag(dragEvent, event, onDragStart)}
        onClick={() => onEventClick(event)}
        sx={{
          position: 'absolute',
          top,
          height,
          left,
          width,
          minHeight: 18,
          borderLeft: isSelected ? 5 : 3,
          borderColor: color.main,
          bgcolor: isSelected ? color.main : color.soft,
          color: isSelected ? '#FFFFFF' : color.dark,
          borderRadius: 1,
          px: 0.75,
          py: 0.5,
          outline: isSelected ? '2px solid rgba(15, 23, 42, 0.28)' : '1px solid transparent',
          outlineOffset: isSelected ? 1 : 0,
          boxShadow: isSelected ? '0 8px 18px rgba(15, 23, 42, 0.28)' : '0 1px 3px rgba(15, 23, 42, 0.16)',
          overflow: 'hidden',
          display: 'grid',
          alignContent: 'start',
          gap: 0.1,
          borderTop: 0,
          borderRight: 0,
          borderBottom: 0,
          cursor: event.canDrag ? 'grab' : 'pointer',
          opacity: isDragging ? 0.55 : 1,
          font: 'inherit',
          textAlign: 'left',
          zIndex: isSelected ? 20 : layout?.column + 1 || 1,
          '&:hover': {
            boxShadow: isSelected ? '0 10px 22px rgba(15, 23, 42, 0.32)' : '0 2px 7px rgba(15, 23, 42, 0.22)',
            zIndex: isSelected ? 20 : 10,
          },
          '&:active': {
            cursor: event.canDrag ? 'grabbing' : 'pointer',
          },
          '&:focus-visible': {
            outline: '3px solid rgba(37, 99, 235, 0.42)',
            outlineOffset: 2,
          },
        }}
      >
        {isCompact ? (
          <Typography variant="caption" fontWeight={900} noWrap>
            {compactEventLabel(event)}
          </Typography>
        ) : (
          <>
            <Typography variant="caption" fontWeight={900} noWrap>
              {event.title}
            </Typography>
            <Typography variant="caption" noWrap sx={{ opacity: isSelected ? 1 : 0.9 }}>
              {timeLabel(event.startsAt)} · {durationLabel(event.durationMinutes)} · {compactEventLabel(event)}
            </Typography>
            {event.hasConflict ? (
              <Typography variant="caption" fontWeight={900} noWrap sx={{ opacity: isSelected ? 1 : 0.95 }}>
                Conflict
              </Typography>
            ) : null}
          </>
        )}
      </Box>
    </Tooltip>
  );
}

function CurrentTimeLine({ top }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        height: 0,
        borderTop: '2px solid #DC2626',
        zIndex: 2,
        pointerEvents: 'none',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: -5,
          top: -5,
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: '#DC2626',
        },
      }}
    />
  );
}

function CalendarDay({ day, draggedEventId, events, isCurrentMonth, selectedEventId, onDragEnd, onDragStart, onEventClick, onEventDrop }) {
  const isToday = day === defaultTimezoneTodayKey();
  const displayedEvents = events.slice(0, 4);
  const hiddenCount = events.length - displayedEvents.length;

  function handleDragOver(event) {
    if (!onEventDrop || !draggedEventId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(event) {
    if (!onEventDrop) return;
    event.preventDefault();
    const eventId = event.dataTransfer.getData('text/calendar-event-id') || draggedEventId;
    const sourceStartsAt = event.dataTransfer.getData('text/calendar-event-start');
    if (!eventId) return;
    onEventDrop(eventId, monthDropDateTime(day, sourceStartsAt));
  }

  return (
    <Box
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        minWidth: 0,
        minHeight: 0,
        bgcolor: isCurrentMonth ? 'background.paper' : '#F8FAFC',
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
            color: isToday ? 'primary.contrastText' : isCurrentMonth ? 'text.primary' : 'text.secondary',
            fontWeight: isToday ? 900 : 700,
          }}
        >
          {dateKeyDay(day)}
        </Typography>
        {events.length ? (
          <Typography variant="caption" color="text.secondary">
            {events.length}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ minHeight: 0, overflow: 'hidden', display: 'grid', alignContent: 'start', gap: 0.5 }}>
        {displayedEvents.map((event) => (
          <CalendarEvent
            key={event.id}
            event={event}
            isDragging={event.id === draggedEventId}
            isSelected={event.id === selectedEventId}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onEventClick={onEventClick}
          />
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

function CalendarEvent({ event, isDragging, isSelected, onDragEnd, onDragStart, onEventClick }) {
  const color = event.profile?.calendarColor || PROFILE_COLORS[event.profile?.colorScheme] || PROFILE_COLORS.green;
  return (
    <Tooltip
      title={`${formatDateTimeInDefaultTimezone(event.startsAt)} · ${durationLabel(event.durationMinutes)} · ${event.title} · ${
        event.profile?.name || 'Profile'
      } · ${calendarPeopleLabel(event)}`}
    >
      <Box
        component="button"
        type="button"
        draggable={Boolean(event.canDrag)}
        aria-pressed={isSelected}
        onDragEnd={onDragEnd}
        onDragStart={(dragEvent) => beginEventDrag(dragEvent, event, onDragStart)}
        onClick={() => onEventClick(event)}
        sx={{
          minWidth: 0,
          borderLeft: isSelected ? 5 : 3,
          borderTop: 0,
          borderRight: 0,
          borderBottom: 0,
          borderColor: color.main,
          bgcolor: isSelected ? color.main : color.soft,
          color: isSelected ? '#FFFFFF' : color.dark,
          borderRadius: 1,
          px: 0.75,
          py: 0.5,
          display: 'grid',
          gap: 0.1,
          cursor: event.canDrag ? 'grab' : 'pointer',
          opacity: isDragging ? 0.55 : 1,
          font: 'inherit',
          textAlign: 'left',
          outline: isSelected ? '2px solid rgba(15, 23, 42, 0.25)' : '1px solid transparent',
          outlineOffset: isSelected ? 1 : 0,
          boxShadow: isSelected ? '0 5px 12px rgba(15, 23, 42, 0.24)' : 'none',
          '&:hover': {
            boxShadow: isSelected ? '0 7px 16px rgba(15, 23, 42, 0.28)' : '0 1px 4px rgba(15, 23, 42, 0.18)',
          },
          '&:active': {
            cursor: event.canDrag ? 'grabbing' : 'pointer',
          },
          '&:focus-visible': {
            outline: '3px solid rgba(37, 99, 235, 0.42)',
            outlineOffset: 2,
          },
        }}
      >
        <Typography variant="caption" fontWeight={900} noWrap>
          {compactEventLabel(event)}
        </Typography>
          <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
            {timeLabel(event.startsAt)} · {durationLabel(event.durationMinutes)}
          </Typography>
          {event.hasConflict ? (
            <Typography variant="caption" fontWeight={900} noWrap>
              Conflict
            </Typography>
          ) : null}
      </Box>
    </Tooltip>
  );
}

function CalendarEventDialog({ callerUsers = [], currentUser = {}, event, isAssigningCaller = false, onCallerChange = null, onClose }) {
  const { mutate: deleteInterviewCall, isPending: deletingInterviewCall } = useDeleteInterviewCall();
  const [callerUserId, setCallerUserId] = useState('');
  const jobUrl = externalJobUrl(event);
  const meetingUrl = meetingLinkForEvent(event);
  const resumeUrl = resumeDownloadUrl(event?.job?.tailoredResume);
  const resumeHref = resumeUrl ? authUrl(resumeUrl) : '';
  const resumeStatus = event?.job?.tailoredResume?.status || '';
  const owner = profileOwnerForEvent(event);
  const canDeleteCall = isSuperadmin(currentUser) && event?.interviewCallId;
  const canAssignCaller = Boolean(onCallerChange && callerUsers.length && event?.interviewId && currentUser?.role !== 'caller');

  useEffect(() => {
    setCallerUserId(event?.job?.bid?.callerUserId ? String(event.job.bid.callerUserId) : '');
  }, [event]);

  function handleDeleteCall() {
    if (!event?.interviewCallId) return;
    const label = [event.company, event.title].filter(Boolean).join(' - ') || 'this call';
    if (!window.confirm(`Delete ${label} from the calendar?`)) return;
    deleteInterviewCall(event.interviewCallId, { onSuccess: onClose });
  }

  function handleCallerChange(nextCallerUserId) {
    setCallerUserId(String(nextCallerUserId || ''));
    onCallerChange?.(event, nextCallerUserId || '');
  }

  return (
    <Dialog open={Boolean(event)} onClose={onClose} fullWidth maxWidth="sm">
      {event ? (
        <>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'grid', gap: 0.4, minWidth: 0 }}>
              <Typography fontWeight={900} noWrap>
                {event.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={800} noWrap>
                {compactEventLabel(event)}
              </Typography>
              {event.hasConflict ? (
                <Chip label="Schedule conflict" color="error" size="small" sx={{ justifySelf: 'start', borderRadius: 1, fontWeight: 900 }} />
              ) : null}
            </Box>
          </DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.25, pt: 2 }}>
            <DetailRow label="Time" value={`${formatDateTimeInDefaultTimezone(event.startsAt)} · ${durationLabel(event.durationMinutes)}`} />
            <DetailRow label="Profile" value={event.profile?.name || 'Profile'} />
            {owner.username ? <DetailRow label="User" value={owner.username} /> : null}
            <DetailRow label="Company" value={event.company || 'Unknown company'} />
            <DetailRow label="Role" value={event.title || 'Untitled role'} />
            {event.location ? <DetailRow label="Location" value={event.location} /> : null}
            {event.job?.bid?.interviewStage ? <DetailRow label="Step" value={stageLabel(event.job.bid.interviewStage)} /> : null}
            {canAssignCaller ? (
              <FormControl size="small">
                <InputLabel>Assignee</InputLabel>
                <Select
                  label="Assignee"
                  value={callerUserId}
                  onChange={(selectEvent) => handleCallerChange(selectEvent.target.value)}
                  disabled={isAssigningCaller}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {callerUsers.map((caller) => (
                    <MenuItem key={caller.id} value={String(caller.id)}>
                      {caller.username}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : event.job?.bid?.callerUser ? (
              <DetailRow label="Assignee" value={event.job.bid.callerUser.username} />
            ) : null}
            {meetingUrl ? <DetailRow label="Meeting link" value={meetingUrl} /> : null}
            {resumeStatus ? (
              <DetailRow
                href={resumeHref}
                label="Resume"
                value={resumeUrl ? resumeFileName(event.job.tailoredResume.filePath) : resumeStatus}
              />
            ) : null}
            {event.job?.bid?.interviewNotes ? <DetailRow label="Notes" value={event.job.bid.interviewNotes} multiline /> : null}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between' }}>
            <Box>
              {canDeleteCall ? (
                <Button color="error" disabled={deletingInterviewCall} onClick={handleDeleteCall} startIcon={<DeleteIcon />}>
                  Delete call
                </Button>
              ) : null}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}>
              {meetingUrl ? (
                <Button component="a" href={meetingUrl} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />} variant="contained">
                  Join call
                </Button>
              ) : null}
              {jobUrl ? (
                <Button component="a" href={jobUrl} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />}>
                  Job link
                </Button>
              ) : null}
              {resumeUrl ? (
                <Button component="a" href={resumeHref} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />}>
                  Resume
                </Button>
              ) : null}
              <Button onClick={onClose} variant="contained">
                Close
              </Button>
            </Box>
          </DialogActions>
        </>
      ) : null}
    </Dialog>
  );
}

function DetailRow({ href = '', label, value, multiline = false }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={900}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: multiline ? 'pre-wrap' : 'normal', overflowWrap: 'anywhere' }}>
        {href ? (
          <Link href={href} target="_blank" rel="noreferrer" fontWeight={800} underline="always">
            {value}
          </Link>
        ) : (
          <LinkifiedText value={value} />
        )}
      </Typography>
    </Box>
  );
}

function LinkifiedText({ value }) {
  const text = String(value || '-');
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/gi);
  return parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    const trailingPunctuation = part.match(/[),.;:!?]+$/)?.[0] || '';
    const href = trailingPunctuation ? part.slice(0, -trailingPunctuation.length) : part;
    return (
      <span key={`${href}-${index}`}>
        <Link href={href} target="_blank" rel="noreferrer" fontWeight={800} underline="always">
          {href}
        </Link>
        {trailingPunctuation}
      </span>
    );
  });
}

function eventLookup(eventsByDay) {
  const byId = new Map();
  for (const events of eventsByDay.values()) {
    events.forEach((event) => byId.set(event.id, event));
  }
  return byId;
}

function beginEventDrag(dragEvent, event, onDragStart) {
  if (!event.canDrag) {
    dragEvent.preventDefault();
    return;
  }
  dragEvent.dataTransfer.effectAllowed = 'move';
  dragEvent.dataTransfer.setData('text/calendar-event-id', event.id);
  dragEvent.dataTransfer.setData('text/calendar-event-start', event.startsAt.toISOString());
  onDragStart?.(event);
}

function weekDropDateTime(day, element, clientY) {
  const rect = element.getBoundingClientRect();
  const offsetY = Math.min(Math.max(clientY - rect.top, 0), rect.height);
  const minutes = roundToInterval((offsetY / Math.max(rect.height, 1)) * 24 * 60, 15);
  return dateTimeForDateKey(day, Math.min(minutes, 23 * 60 + 45));
}

function monthDropDateTime(day, sourceStartsAt) {
  const parts = zonedDateParts(sourceStartsAt || new Date());
  return dateTimeForDateKey(day, parts.hour * 60 + parts.minute);
}

function dateTimeForDateKey(day, minutes) {
  const boundedMinutes = Math.min(Math.max(Number(minutes) || 0, 0), 23 * 60 + 59);
  const hour = Math.floor(boundedMinutes / 60);
  const minute = boundedMinutes % 60;
  return new Date(fromDefaultTimezoneDatetimeLocal(`${day}T${padTime(hour)}:${padTime(minute)}`));
}

function roundToInterval(value, interval) {
  return Math.round(value / interval) * interval;
}

function padTime(value) {
  return String(value).padStart(2, '0');
}

function timeLabel(date) {
  return timeLabelInDefaultTimezone(date);
}

function hourLabel(hour) {
  if (hour === 0) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2026, 0, 1, hour)));
}

function eventTop(value) {
  const parts = zonedDateParts(value);
  const minutes = parts.hour * 60 + parts.minute;
  return (minutes / 60) * HOUR_HEIGHT + 4;
}

function layoutOverlappingEvents(events) {
  const orderedEvents = [...events].sort((left, right) => {
    const startDiff = eventStartMinutes(left) - eventStartMinutes(right);
    if (startDiff) return startDiff;
    return eventEndMinutes(right) - eventEndMinutes(left);
  });
  const groups = [];
  let currentGroup = [];
  let groupEnd = -1;

  orderedEvents.forEach((event) => {
    const start = eventStartMinutes(event);
    const end = eventEndMinutes(event);
    if (currentGroup.length && start >= groupEnd) {
      groups.push(currentGroup);
      currentGroup = [];
      groupEnd = -1;
    }
    currentGroup.push(event);
    groupEnd = Math.max(groupEnd, end);
  });
  if (currentGroup.length) groups.push(currentGroup);

  return groups.flatMap(layoutEventGroup);
}

function layoutEventGroup(events) {
  const columns = [];
  const placed = events.map((event) => {
    const start = eventStartMinutes(event);
    const column = columns.findIndex((columnEnd) => columnEnd <= start);
    const assignedColumn = column === -1 ? columns.length : column;
    columns[assignedColumn] = eventEndMinutes(event);
    return { event, column: assignedColumn };
  });

  const columnCount = Math.max(columns.length, 1);
  return placed.map((item) => {
    let span = 1;
    while (item.column + span < columnCount) {
      const hasConflict = placed.some((other) => other.column === item.column + span && eventsOverlap(item.event, other.event));
      if (hasConflict) break;
      span += 1;
    }
    return {
      event: item.event,
      layout: {
        column: item.column,
        leftPercent: (item.column / columnCount) * 100,
        widthPercent: (span / columnCount) * 100,
      },
    };
  });
}

function eventsOverlap(left, right) {
  return eventStartMinutes(left) < eventEndMinutes(right) && eventStartMinutes(right) < eventEndMinutes(left);
}

function eventStartMinutes(event) {
  const parts = zonedDateParts(event.startsAt);
  return parts.hour * 60 + parts.minute;
}

function eventEndMinutes(event) {
  return eventStartMinutes(event) + Number(event.durationMinutes || 60);
}

function eventHeight(durationMinutes = 60) {
  return Math.max((Number(durationMinutes || 60) / 60) * HOUR_HEIGHT - 8, 18);
}

function durationLabel(durationMinutes = 60) {
  const minutes = Number(durationMinutes || 60);
  if (minutes === 60) return '1 hr';
  if (minutes === 120) return '2 hrs';
  return `${minutes} mins`;
}

function compactEventLabel(event) {
  return [event.profile?.name || 'Profile', event.company || 'Unknown company'].filter(Boolean).join(' · ');
}

function calendarPeopleLabel(event) {
  const owner = profileOwnerForEvent(event);
  const caller = event.job?.bid?.callerUser?.username;
  return [
    owner.username ? `User: ${owner.username}` : '',
    caller ? `Caller: ${caller}` : event.job?.bid?.callerUserId ? `Caller #${event.job.bid.callerUserId}` : 'Unassigned caller',
  ].filter(Boolean).join(' · ');
}

function profileOwnerForEvent(event) {
  const profile = event?.profile || {};
  const profileOwnerId = profile.userId || event?.job?.bid?.profileOwnerUserId || null;
  const profileOwnerUsername = profile.ownerUsername || event?.job?.bid?.profileOwnerUsername || '';
  if (profileOwnerId || profileOwnerUsername) {
    return { id: profileOwnerId, username: profileOwnerUsername };
  }
  const bidUser = event?.job?.bid?.user || null;
  if (BIDDER_ROLES.includes(bidUser?.role)) return { id: null, username: '' };
  return { id: bidUser?.id || event?.job?.bid?.userId || null, username: bidUser?.username || '' };
}

function externalJobUrl(event) {
  const url = event?.job?.rawJob?.originalUrl || event?.job?.url || event?.job?.sourceUrl || '';
  return /^https?:\/\//i.test(String(url)) ? url : '';
}

function meetingLinkForEvent(event) {
  const stage = event?.job?.bid?.interviewStage;
  const links = event?.job?.bid?.stageMeetingLinks || {};
  const url = links[stage] || event?.job?.bid?.meetingLink || '';
  return /^https?:\/\//i.test(String(url)) ? url : '';
}

function resumeDownloadUrl(resume) {
  if (resume?.status !== 'ready' || !resume?.filePath || !resume?.id) return '';
  return `/api/bid/tailored-resumes/${encodeURIComponent(resume.id)}/download`;
}

function resumeFileName(filePath) {
  return filePath ? String(filePath).split('/').pop() || 'tailored-resume.docx' : 'tailored-resume.docx';
}

function stageLabel(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
