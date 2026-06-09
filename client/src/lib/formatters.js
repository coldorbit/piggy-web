import { DEFAULT_TIME_ZONE, DEFAULT_TIME_ZONE_LABEL, defaultTimezoneAbbreviation, zonedDateParts } from './timezone.js';

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
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DEFAULT_TIME_ZONE,
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function formatDefaultTimezoneLabel(value) {
  return value ? defaultTimezoneAbbreviation(value) : DEFAULT_TIME_ZONE_LABEL;
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
