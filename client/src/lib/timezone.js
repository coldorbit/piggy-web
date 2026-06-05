export const DEFAULT_TIME_ZONE_LABEL = 'EST';
export const DEFAULT_TIME_ZONE_OFFSET_MINUTES = -5 * 60;

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function zonedDateParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  const shifted = new Date(date.getTime() + DEFAULT_TIME_ZONE_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function toDefaultTimezoneDatetimeLocal(value) {
  if (!value) return '';
  if (typeof value === 'string' && DATETIME_LOCAL_PATTERN.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = zonedDateParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function fromDefaultTimezoneDatetimeLocal(value) {
  const match = String(value || '').match(DATETIME_LOCAL_PATTERN);
  if (!match) return '';
  const [, year, month, day, hour, minute] = match.map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - DEFAULT_TIME_ZONE_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

export function defaultTimezoneDateKey(value) {
  const parts = zonedDateParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function defaultTimezoneMonthKey(value) {
  const parts = zonedDateParts(value);
  return `${parts.year}-${pad(parts.month)}`;
}

export function defaultTimezoneTodayKey() {
  return defaultTimezoneDateKey(new Date());
}

export function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);
  return utcDateKey(date);
}

export function addMonthsToDateKey(dateKey, months) {
  const [year, month] = dateKey.split('-').map(Number);
  return utcDateKey(new Date(Date.UTC(year, month - 1 + months, 1)));
}

export function dateKeyDayOfWeek(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function dateKeyDay(dateKey) {
  return Number(dateKey.slice(8, 10));
}

export function dateKeyMonth(dateKey) {
  return dateKey.slice(0, 7);
}

export function monthLabelForDateKey(dateKey) {
  const [year, month] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function timeLabelInDefaultTimezone(value) {
  const parts = zonedDateParts(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)));
}

function utcDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function pad(value) {
  return String(value).padStart(2, '0');
}
