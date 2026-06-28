export const DEFAULT_TIME_ZONE = 'America/New_York';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
let supportedTimeZones;

export function localDayRange(value = new Date(), options = {}) {
  const start = localDayStart(value, options);
  return { from: start, to: addLocalDays(start, 1, options) };
}

export function localDayStart(value = new Date(), options = {}) {
  const timeZone = normalizeTimeZone(options.timeZone);
  const parts = zonedDateParts(value, timeZone);
  return zonedDateTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0,
  }, timeZone);
}

export function localDateRange(dateKey, options = {}) {
  const parts = dateKeyParts(dateKey);
  if (!parts) return null;
  const timeZone = normalizeTimeZone(options.timeZone);
  const from = zonedDateTimeToUtc({ ...parts, hour: 0, minute: 0, second: 0 }, timeZone);
  return { from, to: addLocalDays(from, 1, { timeZone }) };
}

export function localPresetRange(value, now = new Date(), options = {}) {
  const today = localDayStart(now, options);
  if (value === 'today') return { from: today, to: addLocalDays(today, 1, options) };
  if (value === 'tomorrow') return { from: addLocalDays(today, 1, options), to: addLocalDays(today, 2, options) };
  if (value === 'yesterday') return { from: addLocalDays(today, -1, options), to: today };
  if (value === 'until_yesterday') return { from: null, to: today };
  if (value === 'through_today') return { from: null, to: addLocalDays(today, 1, options) };
  if (value === 'this_week') {
    const weekStart = localWeekStart(today, options);
    return { from: weekStart, to: addLocalDays(weekStart, 7, options) };
  }
  if (value === 'last_week') {
    const thisWeekStart = localWeekStart(today, options);
    return { from: addLocalDays(thisWeekStart, -7, options), to: thisWeekStart };
  }
  return null;
}

export function addLocalDays(value, days, options = {}) {
  const timeZone = normalizeTimeZone(options.timeZone);
  const startParts = zonedDateParts(value, timeZone);
  const nextDate = addCalendarDays(startParts, days);
  return zonedDateTimeToUtc({
    year: nextDate.year,
    month: nextDate.month,
    day: nextDate.day,
    hour: 0,
    minute: 0,
    second: 0,
  }, timeZone);
}

export function localWeekStart(value = new Date(), options = {}) {
  const timeZone = normalizeTimeZone(options.timeZone);
  const start = localDayStart(value, { timeZone });
  const parts = zonedDateParts(start, timeZone);
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return addLocalDays(start, -day, { timeZone });
}

export function localDateKey(value = new Date(), options = {}) {
  const timeZone = normalizeTimeZone(options.timeZone);
  const parts = zonedDateParts(localDayStart(value, { timeZone }), timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function localDateKeyDaysAgo(days, value = new Date(), options = {}) {
  const start = addLocalDays(localDayStart(value, options), -days, options);
  return localDateKey(start, options);
}

export function localDaySql(column, timeZone = DEFAULT_TIME_ZONE) {
  return `date_trunc('day', timezone('${escapeSqlLiteral(normalizeTimeZone(timeZone))}', ${column}))`;
}

export function localBucketSql(column, grainSql, timeZone = DEFAULT_TIME_ZONE) {
  return `date_trunc('${escapeSqlLiteral(grainSql)}', timezone('${escapeSqlLiteral(normalizeTimeZone(timeZone))}', ${column}))`;
}

export function localNowBucketSql(grainSql, timeZone = DEFAULT_TIME_ZONE) {
  return `date_trunc('${escapeSqlLiteral(grainSql)}', timezone('${escapeSqlLiteral(normalizeTimeZone(timeZone))}', now()))`;
}

export function isValidTimeZone(value) {
  const timeZone = String(value || '').trim();
  if (!timeZone) return false;
  if (timeZone === 'UTC' || timeZone === 'Etc/UTC') return true;
  if (typeof Intl.supportedValuesOf === 'function') {
    supportedTimeZones ||= new Set(Intl.supportedValuesOf('timeZone'));
    return supportedTimeZones.has(timeZone);
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value, fallback = DEFAULT_TIME_ZONE) {
  const timeZone = String(value || '').trim();
  return isValidTimeZone(timeZone) ? timeZone : fallback;
}

function zonedDateParts(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const valueFor = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: valueFor('year'),
    month: valueFor('month'),
    day: valueFor('day'),
    hour: valueFor('hour'),
    minute: valueFor('minute'),
    second: valueFor('second'),
  };
}

function zonedDateTimeToUtc(parts, timeZone = DEFAULT_TIME_ZONE) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const localAsUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute || 0, parts.second || 0);
  let utcMs = localAsUtcMs;

  for (let index = 0; index < 3; index += 1) {
    const zoned = zonedDateParts(new Date(utcMs), normalizedTimeZone);
    const zonedAsUtcMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
    const nextUtcMs = utcMs - (zonedAsUtcMs - localAsUtcMs);
    if (nextUtcMs === utcMs) break;
    utcMs = nextUtcMs;
  }

  return new Date(utcMs);
}

function addCalendarDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + days * MS_PER_DAY);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function dateKeyParts(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function pad(value) {
  return String(value).padStart(2, '0');
}
