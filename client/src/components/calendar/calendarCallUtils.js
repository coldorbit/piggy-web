import { timeLabelInDefaultTimezone } from '../../lib/timezone.js';

export function isLowAttentionCalendarCall(call) {
  const status = call?.status || call?.job?.bid?.status || '';
  return ['failed', 'lost'].includes(String(status).trim().toLowerCase());
}

export function calendarCallInteractionSx({ canDrag, isDragging, isLowAttention, isSelected, raiseOnHover = false }) {
  return {
    boxShadow: isSelected ? '0 4px 10px rgba(60, 64, 67, 0.28)' : 'none',
    filter: isLowAttention && !isSelected ? 'saturate(0.45)' : 'none',
    opacity: isDragging ? 0.45 : isLowAttention && !isSelected ? 0.58 : 1,
    '&:active': { cursor: canDrag ? 'grabbing' : 'pointer' },
    '&:focus-visible': {
      filter: 'none',
      opacity: 1,
      outline: '3px solid rgba(37, 99, 235, 0.42)',
      outlineOffset: 2,
    },
    '&:hover': {
      boxShadow: isSelected ? '0 5px 12px rgba(60, 64, 67, 0.3)' : isLowAttention ? 'none' : '0 1px 4px rgba(60, 64, 67, 0.24)',
      ...(raiseOnHover ? { zIndex: isSelected ? 20 : 10 } : {}),
    },
  };
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
