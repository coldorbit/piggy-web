export const DEFAULT_TIME_ZONE = 'America/New_York';
export const DEFAULT_TIME_ZONE_LABEL = 'ET';
export const BUSINESS_DAY_START_HOUR = 19;

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function zonedDateParts(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const valueFor = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: valueFor('year'),
    month: valueFor('month'),
    day: valueFor('day'),
    hour: valueFor('hour'),
    minute: valueFor('minute'),
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
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  let utcMs = localAsUtcMs - defaultTimezoneOffsetMinutes(new Date(localAsUtcMs)) * 60_000;

  for (let index = 0; index < 3; index += 1) {
    const nextUtcMs = localAsUtcMs - defaultTimezoneOffsetMinutes(new Date(utcMs)) * 60_000;
    if (nextUtcMs === utcMs) break;
    utcMs = nextUtcMs;
  }

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

export function businessTimezoneTodayKey(value = new Date()) {
  const parts = zonedDateParts(value);
  const dateKey = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  return parts.hour >= BUSINESS_DAY_START_HOUR ? dateKey : addDaysToDateKey(dateKey, -1);
}

export function businessTimezoneDateKeyDaysAgo(days, value = new Date()) {
  return addDaysToDateKey(businessTimezoneTodayKey(value), -days);
}

export function businessDayProgressPercent(value = new Date()) {
  return dayProgressPercent(value, { timeZone: DEFAULT_TIME_ZONE, startHour: BUSINESS_DAY_START_HOUR });
}

export function dayProgressPercent(value = new Date(), { timeZone = DEFAULT_TIME_ZONE, startHour = 0 } = {}) {
  const parts = zonedDateParts(value, timeZone);
  const minutes = parts.hour * 60 + parts.minute;
  const startMinutes = startHour * 60;
  const elapsed = minutes >= startMinutes
    ? minutes - startMinutes
    : minutes + (24 * 60 - startMinutes);
  return (elapsed / (24 * 60)) * 100;
}

export function millisecondsUntilNextBusinessDayStart(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 60_000;
  const parts = zonedDateParts(date);
  const dateKey = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const nextDateKey = parts.hour >= BUSINESS_DAY_START_HOUR ? addDaysToDateKey(dateKey, 1) : dateKey;
  const nextStart = new Date(fromDefaultTimezoneDatetimeLocal(`${nextDateKey}T${pad(BUSINESS_DAY_START_HOUR)}:00`));
  return Math.max(nextStart.getTime() - date.getTime(), 1_000);
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

export function defaultTimezoneAbbreviation(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIME_ZONE,
    timeZoneName: 'short',
  }).formatToParts(date);
  return parts.find((part) => part.type === 'timeZoneName')?.value || DEFAULT_TIME_ZONE_LABEL;
}

function defaultTimezoneOffsetMinutes(date) {
  const parts = zonedDateParts(date);
  const zonedAsUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((zonedAsUtcMs - date.getTime()) / 60_000);
}

function utcDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function pad(value) {
  return String(value).padStart(2, '0');
}
