export const BUSINESS_TIME_ZONE = 'America/New_York';
export const BUSINESS_DAY_START_HOUR = 19;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
let supportedTimeZones;

export function businessDayRange(value = new Date()) {
  return zonedDayRange(value, { timeZone: BUSINESS_TIME_ZONE, startHour: BUSINESS_DAY_START_HOUR });
}

export function businessDayStart(value = new Date()) {
  return zonedDayStart(value, { timeZone: BUSINESS_TIME_ZONE, startHour: BUSINESS_DAY_START_HOUR });
}

export function businessDateRange(dateKey) {
  return zonedDateRange(dateKey, { timeZone: BUSINESS_TIME_ZONE, startHour: BUSINESS_DAY_START_HOUR });
}

export function businessPresetRange(value, now = new Date()) {
  return zonedPresetRange(value, now, { timeZone: BUSINESS_TIME_ZONE, startHour: BUSINESS_DAY_START_HOUR });
}

export function addBusinessDays(value, days) {
  return addZonedDays(value, days, { timeZone: BUSINESS_TIME_ZONE, startHour: BUSINESS_DAY_START_HOUR });
}

export function businessWeekStart(value = new Date()) {
  const start = businessDayStart(value);
  const parts = zonedDateParts(start, BUSINESS_TIME_ZONE);
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addBusinessDays(start, mondayOffset);
}

export function businessDateKey(value = new Date()) {
  const parts = zonedDateParts(businessDayStart(value), BUSINESS_TIME_ZONE);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function businessDateKeyDaysAgo(days, value = new Date()) {
  const start = addBusinessDays(businessDayStart(value), -days);
  return businessDateKey(start);
}

export function businessDaySql(column) {
  return `date_trunc('day', timezone('${BUSINESS_TIME_ZONE}', ${column}) - interval '${BUSINESS_DAY_START_HOUR} hours')`;
}

export function businessBucketSql(column, grainSql) {
  return `date_trunc('${grainSql}', timezone('${BUSINESS_TIME_ZONE}', ${column}) - interval '${BUSINESS_DAY_START_HOUR} hours')`;
}

export function businessNowBucketSql(grainSql) {
  return `date_trunc('${grainSql}', timezone('${BUSINESS_TIME_ZONE}', now()) - interval '${BUSINESS_DAY_START_HOUR} hours')`;
}

export function zonedDayRange(value = new Date(), options = {}) {
  const start = zonedDayStart(value, options);
  return { from: start, to: addZonedDays(start, 1, options) };
}

export function zonedDayStart(value = new Date(), options = {}) {
  const timeZone = normalizeTimeZone(options.timeZone);
  const startHour = normalizeStartHour(options.startHour);
  const parts = zonedDateParts(value, timeZone);
  const localDate = parts.hour >= startHour ? parts : addCalendarDays(parts, -1);
  return zonedDateTimeToUtc({
    year: localDate.year,
    month: localDate.month,
    day: localDate.day,
    hour: startHour,
    minute: 0,
    second: 0,
  }, timeZone);
}

export function zonedDateRange(dateKey, options = {}) {
  const parts = dateKeyParts(dateKey);
  if (!parts) return null;
  const timeZone = normalizeTimeZone(options.timeZone);
  const startHour = normalizeStartHour(options.startHour);
  const from = zonedDateTimeToUtc({ ...parts, hour: startHour, minute: 0, second: 0 }, timeZone);
  return { from, to: addZonedDays(from, 1, { timeZone, startHour }) };
}

export function zonedPresetRange(value, now = new Date(), options = {}) {
  const today = zonedDayStart(now, options);
  if (value === 'today') return { from: today, to: addZonedDays(today, 1, options) };
  if (value === 'tomorrow') return { from: addZonedDays(today, 1, options), to: addZonedDays(today, 2, options) };
  if (value === 'yesterday') return { from: addZonedDays(today, -1, options), to: today };
  if (value === 'until_yesterday') return { from: null, to: today };
  if (value === 'through_today') return { from: null, to: addZonedDays(today, 1, options) };
  if (value === 'this_week') {
    const weekStart = zonedWeekStart(today, options);
    return { from: weekStart, to: addZonedDays(weekStart, 7, options) };
  }
  if (value === 'last_week') {
    const thisWeekStart = zonedWeekStart(today, options);
    return { from: addZonedDays(thisWeekStart, -7, options), to: thisWeekStart };
  }
  return null;
}

export function addZonedDays(value, days, options = {}) {
  const timeZone = normalizeTimeZone(options.timeZone);
  const startHour = normalizeStartHour(options.startHour);
  const startParts = zonedDateParts(value, timeZone);
  const nextDate = addCalendarDays(startParts, days);
  return zonedDateTimeToUtc({
    year: nextDate.year,
    month: nextDate.month,
    day: nextDate.day,
    hour: startHour,
    minute: 0,
    second: 0,
  }, timeZone);
}

export function zonedWeekStart(value = new Date(), options = {}) {
  const timeZone = normalizeTimeZone(options.timeZone);
  const start = zonedDayStart(value, { ...options, timeZone });
  const parts = zonedDateParts(start, timeZone);
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addZonedDays(start, mondayOffset, { ...options, timeZone });
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

export function normalizeTimeZone(value, fallback = BUSINESS_TIME_ZONE) {
  const timeZone = String(value || '').trim();
  return isValidTimeZone(timeZone) ? timeZone : fallback;
}

function zonedDateParts(value, timeZone = BUSINESS_TIME_ZONE) {
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

function zonedDateTimeToUtc(parts, timeZone = BUSINESS_TIME_ZONE) {
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

function normalizeStartHour(value) {
  const hour = Number(value ?? 0);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0;
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

function pad(value) {
  return String(value).padStart(2, '0');
}
