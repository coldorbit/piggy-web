const BUSINESS_TIME_ZONE = 'America/New_York';
const BUSINESS_DAY_START_HOUR = 19;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function businessDayRange(value = new Date()) {
  const start = businessDayStart(value);
  return { from: start, to: addBusinessDays(start, 1) };
}

export function businessDayStart(value = new Date()) {
  const parts = zonedDateParts(value);
  const businessDate = parts.hour >= BUSINESS_DAY_START_HOUR
    ? parts
    : addCalendarDays(parts, -1);
  return zonedDateTimeToUtc({
    year: businessDate.year,
    month: businessDate.month,
    day: businessDate.day,
    hour: BUSINESS_DAY_START_HOUR,
    minute: 0,
    second: 0,
  });
}

export function businessDateRange(dateKey) {
  const parts = dateKeyParts(dateKey);
  if (!parts) return null;
  const from = zonedDateTimeToUtc({ ...parts, hour: BUSINESS_DAY_START_HOUR, minute: 0, second: 0 });
  return { from, to: addBusinessDays(from, 1) };
}

export function businessPresetRange(value, now = new Date()) {
  const today = businessDayStart(now);
  if (value === 'today') return { from: today, to: addBusinessDays(today, 1) };
  if (value === 'tomorrow') return { from: addBusinessDays(today, 1), to: addBusinessDays(today, 2) };
  if (value === 'yesterday') return { from: addBusinessDays(today, -1), to: today };
  if (value === 'until_yesterday') return { from: null, to: today };
  if (value === 'through_today') return { from: null, to: addBusinessDays(today, 1) };
  if (value === 'this_week') {
    const weekStart = businessWeekStart(today);
    return { from: weekStart, to: addBusinessDays(weekStart, 7) };
  }
  if (value === 'last_week') {
    const thisWeekStart = businessWeekStart(today);
    return { from: addBusinessDays(thisWeekStart, -7), to: thisWeekStart };
  }
  return null;
}

export function addBusinessDays(value, days) {
  const startParts = zonedDateParts(value);
  const nextDate = addCalendarDays(startParts, days);
  return zonedDateTimeToUtc({
    year: nextDate.year,
    month: nextDate.month,
    day: nextDate.day,
    hour: BUSINESS_DAY_START_HOUR,
    minute: 0,
    second: 0,
  });
}

export function businessWeekStart(value = new Date()) {
  const start = businessDayStart(value);
  const parts = zonedDateParts(start);
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addBusinessDays(start, mondayOffset);
}

export function businessDateKey(value = new Date()) {
  const parts = zonedDateParts(businessDayStart(value));
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

function zonedDateParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
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

function zonedDateTimeToUtc(parts) {
  const localAsUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute || 0, parts.second || 0);
  let utcMs = localAsUtcMs;

  for (let index = 0; index < 3; index += 1) {
    const zoned = zonedDateParts(new Date(utcMs));
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

function pad(value) {
  return String(value).padStart(2, '0');
}
