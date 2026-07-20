import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
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
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import CalendarRelatedCalls from './CalendarRelatedCalls.jsx';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DISPLAY_WEEKDAYS = WEEKDAY_LABELS.slice(1, 6);
const HOURS = Array.from({ length: 24 }, (_item, hour) => hour);
const HOUR_HEIGHT = 64;
const GOOGLE_CALENDAR_BORDER = '#DADCE0';
const GOOGLE_CALENDAR_MUTED = '#5F6368';

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
  const eventById = useMemo(() => eventLookup(eventsByDay), [eventsByDay]);
  const isTimeGrid = view !== CALENDAR_VIEWS.month;

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
          boxShadow: 'none',
          borderColor: GOOGLE_CALENDAR_BORDER,
          borderRadius: 2,
          display: 'grid',
          gridTemplateRows: isTimeGrid ? '1fr' : 'auto 1fr',
          bgcolor: '#FFFFFF',
        }}
      >
        {isTimeGrid ? (
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
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderBottom: `1px solid ${GOOGLE_CALENDAR_BORDER}`, bgcolor: '#FFFFFF' }}>
        {DISPLAY_WEEKDAYS.map((day) => (
          <Typography
            key={day}
            align="center"
            color={GOOGLE_CALENDAR_MUTED}
            fontWeight={500}
            variant="caption"
            sx={{
              py: 0.75,
              borderRight: day === 'Fri' ? 0 : `1px solid ${GOOGLE_CALENDAR_BORDER}`,
              fontSize: 11,
              letterSpacing: 0,
            }}
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
          bgcolor: GOOGLE_CALENDAR_BORDER,
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
  const isDayView = days.length === 1;

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
    <Box ref={scrollRef} sx={{ height: '100%', minHeight: 0, overflow: 'auto', bgcolor: '#FFFFFF', overscrollBehavior: 'contain' }}>
      <Box
        sx={{
          minWidth: { xs: isDayView ? 360 : 660, md: 0 },
          display: 'grid',
          gridTemplateColumns: `64px repeat(${days.length}, minmax(${isDayView ? 240 : 104}px, 1fr))`,
          gridTemplateRows: `66px ${HOURS.length * HOUR_HEIGHT}px`,
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 4,
            bgcolor: '#FFFFFF',
            borderBottom: `1px solid ${GOOGLE_CALENDAR_BORDER}`,
          }}
        />
        {days.map((day) => (
          <WeekDayHeader key={day} day={day} eventCount={(eventsByDay.get(day) || []).length} />
        ))}

        <Box
          sx={{
            gridColumn: '1 / 2',
            gridRow: '2 / 3',
            position: 'sticky',
            left: 0,
            zIndex: 3,
            bgcolor: '#FFFFFF',
            borderRight: `1px solid ${GOOGLE_CALENDAR_BORDER}`,
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
                fontWeight: 400,
                color: GOOGLE_CALENDAR_MUTED,
                fontSize: 10,
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

function WeekDayHeader({ day, eventCount }) {
  const isToday = day === defaultTimezoneTodayKey();
  const weekday = WEEKDAY_LABELS[dateKeyDayOfWeek(day)];
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 4,
        bgcolor: '#FFFFFF',
        borderBottom: `1px solid ${GOOGLE_CALENDAR_BORDER}`,
        borderLeft: `1px solid ${GOOGLE_CALENDAR_BORDER}`,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Box sx={{ display: 'grid', justifyItems: 'center', gap: 0 }}>
        <Typography variant="caption" color={GOOGLE_CALENDAR_MUTED} fontWeight={500} sx={{ fontSize: 11 }}>
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
            fontWeight: 500,
          }}
        >
          {dateKeyDay(day)}
        </Typography>
        <Typography variant="caption" color={GOOGLE_CALENDAR_MUTED} sx={{ fontSize: 10, lineHeight: 1.2 }}>
          {callCountLabel(eventCount)}
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
        borderLeft: `1px solid ${GOOGLE_CALENDAR_BORDER}`,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, ${GOOGLE_CALENDAR_BORDER} ${HOUR_HEIGHT - 1}px, ${GOOGLE_CALENDAR_BORDER} ${HOUR_HEIGHT}px)`,
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
  const left = layout ? `${layout.leftPercent}%` : 0;
  const width = layout ? `${layout.widthPercent}%` : '100%';
  return (
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
          minHeight: 0,
          boxSizing: 'border-box',
          border: `1px solid ${GOOGLE_CALENDAR_BORDER}`,
          borderLeft: `${isSelected ? 5 : 3}px solid ${color.main}`,
          bgcolor: isSelected ? color.main : color.soft,
          color: isSelected ? '#FFFFFF' : color.dark,
          borderRadius: '4px',
          px: 0.75,
          py: 0,
          outline: isSelected ? '2px solid rgba(15, 23, 42, 0.28)' : '1px solid transparent',
          outlineOffset: isSelected ? 1 : 0,
          boxShadow: isSelected ? '0 4px 10px rgba(60, 64, 67, 0.28)' : 'none',
          overflow: 'hidden',
          display: 'grid',
          alignContent: isCompact ? 'center' : 'start',
          gap: 0,
          cursor: event.canDrag ? 'grab' : 'pointer',
          opacity: isDragging ? 0.55 : 1,
          font: 'inherit',
          textAlign: 'left',
          zIndex: isSelected ? 20 : layout?.column + 1 || 1,
          '&:hover': {
            boxShadow: isSelected ? '0 5px 12px rgba(60, 64, 67, 0.3)' : '0 1px 4px rgba(60, 64, 67, 0.24)',
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
        <Typography variant="caption" fontWeight={600} noWrap sx={{ lineHeight: 1.15 }}>
          {compactEventLabel(event)}
        </Typography>
      ) : (
        <>
          <Typography variant="caption" fontWeight={600} noWrap sx={{ lineHeight: 1.25 }}>
            {event.title}
          </Typography>
          <Typography variant="caption" noWrap sx={{ opacity: isSelected ? 1 : 0.9, lineHeight: 1.25 }}>
            {timeLabel(event.startsAt)} · {durationLabel(event.durationMinutes)} · {compactEventLabel(event)}
          </Typography>
          {event.hasConflict ? (
            <Typography variant="caption" fontWeight={600} noWrap sx={{ opacity: isSelected ? 1 : 0.95, lineHeight: 1.25 }}>
              Conflict
            </Typography>
          ) : null}
        </>
      )}
    </Box>
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
        borderTop: '2px solid #C42B1C',
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
          bgcolor: '#C42B1C',
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
        bgcolor: isCurrentMonth ? '#FFFFFF' : '#F8F9FA',
        px: 0,
        py: 0.5,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 0.5,
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
            color: isToday ? 'primary.contrastText' : isCurrentMonth ? '#202124' : GOOGLE_CALENDAR_MUTED,
            fontWeight: isToday ? 500 : 400,
          }}
        >
          {dateKeyDay(day)}
        </Typography>
        <Typography variant="caption" color={GOOGLE_CALENDAR_MUTED} sx={{ pr: 0.75, fontSize: 10 }}>
          {callCountLabel(events.length)}
        </Typography>
      </Box>
      <Box sx={{ minHeight: 0, overflow: 'hidden', display: 'grid', alignContent: 'start', gap: 0.25 }}>
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
          <Typography variant="caption" color={GOOGLE_CALENDAR_MUTED} sx={{ px: 0.25 }}>
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
          boxSizing: 'border-box',
          border: `1px solid ${GOOGLE_CALENDAR_BORDER}`,
          borderLeft: `${isSelected ? 5 : 3}px solid ${color.main}`,
          bgcolor: isSelected ? color.main : color.soft,
          color: isSelected ? '#FFFFFF' : color.dark,
          borderRadius: '4px',
          px: 0.75,
          py: 0,
          display: 'grid',
          gap: 0,
          cursor: event.canDrag ? 'grab' : 'pointer',
          opacity: isDragging ? 0.55 : 1,
          font: 'inherit',
          textAlign: 'left',
          outline: isSelected ? '2px solid rgba(15, 23, 42, 0.25)' : '1px solid transparent',
          outlineOffset: isSelected ? 1 : 0,
          boxShadow: isSelected ? '0 4px 10px rgba(60, 64, 67, 0.28)' : 'none',
          '&:hover': {
            boxShadow: isSelected ? '0 5px 12px rgba(60, 64, 67, 0.3)' : '0 1px 4px rgba(60, 64, 67, 0.24)',
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
      <Typography variant="caption" fontWeight={600} noWrap sx={{ lineHeight: 1.25 }}>
        {compactEventLabel(event)}
      </Typography>
      <Typography variant="caption" noWrap sx={{ opacity: 0.9, lineHeight: 1.25 }}>
        {timeLabel(event.startsAt)} · {durationLabel(event.durationMinutes)}
      </Typography>
      {event.hasConflict ? (
        <Typography variant="caption" fontWeight={600} noWrap sx={{ lineHeight: 1.25 }}>
          Conflict
        </Typography>
      ) : null}
    </Box>
  );
}

function CalendarEventDialog({ callerUsers = [], currentUser = {}, event, isAssigningCaller = false, onCallerChange = null, onClose }) {
  const { mutate: deleteInterviewCall, isPending: deletingInterviewCall, error: deleteCallError } = useDeleteInterviewCall();
  const [callerUserId, setCallerUserId] = useState('');
  const jobUrl = externalJobUrl(event);
  const meetingUrl = meetingLinkForEvent(event);
  const resumeUrl = resumeDownloadUrl(event?.job?.tailoredResume);
  const resumeHref = resumeUrl ? authUrl(resumeUrl) : '';
  const resumeStatus = event?.job?.tailoredResume?.status || '';
  const owner = profileOwnerForEvent(event);
  const applicationActor = event?.job?.bid?.applicationActor || null;
  const canDeleteCall = canDeleteCalendarCall(currentUser, event);
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
    <Dialog open={Boolean(event)} onClose={onClose} fullWidth maxWidth="md">
      {event ? (
        <>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'grid', gap: 0.4, minWidth: 0 }}>
              <Typography fontWeight={600} noWrap>
                {event.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={600} noWrap>
                {compactEventLabel(event)}
              </Typography>
              {event.hasConflict ? (
                <Chip label="Schedule conflict" color="error" size="small" sx={{ justifySelf: 'start', borderRadius: 1, fontWeight: 600 }} />
              ) : null}
            </Box>
          </DialogTitle>
          <DialogContent
            sx={{
              alignItems: 'start',
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.9fr) minmax(360px, 1.1fr)' },
              pt: 2,
            }}
          >
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              <DetailRow label="Time" value={`${formatDateTimeInDefaultTimezone(event.startsAt)} · ${durationLabel(event.durationMinutes)}`} />
              <DetailRow label="Profile" value={event.profile?.name || 'Profile'} />
              {owner.username ? <DetailRow label="User" value={owner.username} /> : null}
              {applicationActor ? <DetailRow label="Applied by" value={[applicationActor.username, applicationActor.label].filter(Boolean).join(' · ')} /> : null}
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
              {deleteCallError ? <Alert severity="error">{deleteCallError.message}</Alert> : null}
            </Box>
            <CalendarRelatedCalls event={event} />
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
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: multiline ? 'pre-wrap' : 'normal', overflowWrap: 'anywhere' }}>
        {href ? (
          <Link href={href} target="_blank" rel="noreferrer" fontWeight={600} underline="always">
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
        <Link href={href} target="_blank" rel="noreferrer" fontWeight={600} underline="always">
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
  return (minutes / 60) * HOUR_HEIGHT;
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
  return Math.max((Number(durationMinutes || 60) / 60) * HOUR_HEIGHT, 1);
}

function durationLabel(durationMinutes = 60) {
  const minutes = Number(durationMinutes || 60);
  if (minutes === 60) return '1 hr';
  if (minutes === 120) return '2 hrs';
  return `${minutes} mins`;
}

function compactEventLabel(event) {
  return [event.profile?.name || 'Profile', event.company || 'Unknown company', event.job?.bid?.applicationActor?.label].filter(Boolean).join(' · ');
}

export function canDeleteCalendarCall(user, event) {
  if (!event?.interviewCallId) return false;
  if (isSuperadmin(user)) return true;
  const userId = String(user?.id || '');
  if (!userId) return false;
  const ownerUserId = event.job?.bid?.profileOwnerUserId
    || event.job?.bid?.userId
    || event.profile?.userId
    || '';
  return String(ownerUserId) === userId;
}

function callCountLabel(count) {
  return `${count} ${count === 1 ? 'call' : 'calls'}`;
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
