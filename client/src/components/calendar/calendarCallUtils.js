import { timeLabelInDefaultTimezone } from '../../lib/timezone.js';

export const LOW_ATTENTION_CALL_COLOR = {
  border: '#E1E4E8',
  dark: '#5F6368',
  main: '#9AA0A6',
  selected: '#5F6368',
  soft: '#F5F6F7',
};

export function isLowAttentionCalendarCall(call) {
  const status = call?.status || call?.job?.bid?.status || '';
  return ['failed', 'lost'].includes(String(status).trim().toLowerCase());
}

export function calendarCallCountLabel(count) {
  return `${count} ${count === 1 ? 'call' : 'calls'}`;
}

export function calendarCallDurationLabel(durationMinutes = 60) {
  const minutes = Number(durationMinutes || 60);
  if (minutes === 60) return '1 hr';
  if (minutes === 120) return '2 hrs';
  return `${minutes} mins`;
}

export function compactCalendarEventLabel(event) {
  return [event.profile?.name || 'Profile', event.company || 'Unknown company', event.profile?.isExternal ? 'External' : null].filter(Boolean).join(' · ');
}

export function lowAttentionCalendarEventAriaLabel(event) {
  return [event.title, timeLabelInDefaultTimezone(event.startsAt), calendarCallDurationLabel(event.durationMinutes), compactCalendarEventLabel(event), 'Failed or lost']
    .filter(Boolean)
    .join(', ');
}
