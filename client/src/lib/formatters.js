import { DEFAULT_TIME_ZONE_LABEL, zonedDateParts } from './timezone.js';

export function formatDate(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDateInDefaultTimezone(value) {
  if (!value) return 'Unknown';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return formatUtcDateParts({ year, month, day });
  }
  const parts = zonedDateParts(value);
  return formatUtcDateParts(parts);
}

export function formatDateTimeInDefaultTimezone(value) {
  if (!value) return 'Unknown';
  const parts = zonedDateParts(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)));
}

export function formatDefaultTimezoneLabel() {
  return DEFAULT_TIME_ZONE_LABEL;
}

export function spamStatusLabel(job) {
  if (job.isSpam === true) return `Spam${job.spamReviewedAt ? ` on ${formatDateTime(job.spamReviewedAt)}` : ''}`;
  if (job.isSpam === false) return `Not spam${job.spamReviewedAt ? ` on ${formatDateTime(job.spamReviewedAt)}` : ''}`;
  return 'Unreviewed';
}

function formatUtcDateParts(parts) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day)),
  );
}
