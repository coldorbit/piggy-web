import { Box, Paper, Tooltip, Typography } from '@mui/material';
import { formatDateTimeInDefaultTimezone } from '../../lib/formatters.js';
import {
  dateKeyDay,
  dateKeyDayOfWeek,
  dateKeyMonth,
  defaultTimezoneTodayKey,
  timeLabelInDefaultTimezone,
  zonedDateParts,
} from '../../lib/timezone.js';
import { PROFILE_COLORS } from '../profiles/profileConstants.js';
import { CALENDAR_VIEWS } from './CalendarToolbar.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_item, hour) => hour);
const HOUR_HEIGHT = 64;

export default function CalendarGrid({ cursorDate, eventsByDay, visibleDays, view }) {
  return (
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
        <WeekCalendar days={visibleDays} eventsByDay={eventsByDay} />
      ) : (
        <MonthCalendar cursorDate={cursorDate} days={visibleDays} eventsByDay={eventsByDay} />
      )}
    </Paper>
  );
}

function MonthCalendar({ cursorDate, days, eventsByDay }) {
  return (
    <>
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
          gridAutoRows: 148,
          bgcolor: 'divider',
          gap: '1px',
        }}
      >
        {days.map((day) => (
          <CalendarDay
            key={day}
            day={day}
            events={eventsByDay.get(day) || []}
            isCurrentMonth={dateKeyMonth(day) === dateKeyMonth(cursorDate)}
          />
        ))}
      </Box>
    </>
  );
}

function WeekCalendar({ days, eventsByDay }) {
  return (
    <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto', bgcolor: 'background.paper', overscrollBehavior: 'contain' }}>
      <Box
        sx={{
          minWidth: { xs: 860, md: 0 },
          display: 'grid',
          gridTemplateColumns: '64px repeat(7, minmax(104px, 1fr))',
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
          <WeekDayColumn key={day} day={day} column={index + 2} events={eventsByDay.get(day) || []} />
        ))}
      </Box>
    </Box>
  );
}

function WeekDayHeader({ day }) {
  const isToday = day === defaultTimezoneTodayKey();
  const weekday = WEEKDAYS[dateKeyDayOfWeek(day)];
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

function WeekDayColumn({ day, column, events }) {
  return (
    <Box
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
      {day === defaultTimezoneTodayKey() ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(37, 99, 235, 0.035)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {events.map((event) => (
        <WeekCalendarEvent key={event.id} event={event} />
      ))}
    </Box>
  );
}

function WeekCalendarEvent({ event }) {
  const color = PROFILE_COLORS[event.profile?.colorScheme] || PROFILE_COLORS.green;
  const top = eventTop(event.startsAt);
  return (
    <Tooltip title={`${formatDateTimeInDefaultTimezone(event.startsAt)} · ${event.title} · ${event.profile?.name || 'Profile'}`}>
      <Box
        sx={{
          position: 'absolute',
          top,
          left: 6,
          right: 6,
          minHeight: 46,
          borderLeft: 3,
          borderColor: color.main,
          bgcolor: color.soft,
          color: color.dark,
          borderRadius: 1,
          px: 0.75,
          py: 0.5,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.16)',
          overflow: 'hidden',
          display: 'grid',
          alignContent: 'start',
          gap: 0.1,
        }}
      >
        <Typography variant="caption" fontWeight={900} noWrap>
          {event.title}
        </Typography>
        <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
          {timeLabel(event.startsAt)} · {[event.company, event.profile?.name].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function CalendarDay({ day, events, isCurrentMonth }) {
  const isToday = day === defaultTimezoneTodayKey();
  const displayedEvents = events.slice(0, 4);
  const hiddenCount = events.length - displayedEvents.length;

  return (
    <Box
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
    <Tooltip title={`${formatDateTimeInDefaultTimezone(event.startsAt)} · ${event.title} · ${event.profile?.name || 'Profile'}`}>
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
