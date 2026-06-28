import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localDateRange, localDayRange, localDateKey, localPresetRange, localWeekStart } from '../server/utils/localTime.js';

describe('local time helpers', () => {
  it('uses local midnight as the day boundary', () => {
    const range = localDayRange(new Date('2026-06-15T06:59:00.000Z'), { timeZone: 'America/Los_Angeles' });

    assert.equal(range.from.toISOString(), '2026-06-14T07:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-15T07:00:00.000Z');
    assert.equal(localDateKey(new Date('2026-06-15T06:59:00.000Z'), { timeZone: 'America/Los_Angeles' }), '2026-06-14');
  });

  it('starts the next local day at midnight', () => {
    const range = localDayRange(new Date('2026-06-15T07:00:00.000Z'), { timeZone: 'America/Los_Angeles' });

    assert.equal(range.from.toISOString(), '2026-06-15T07:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-16T07:00:00.000Z');
    assert.equal(localDateKey(new Date('2026-06-15T07:00:00.000Z'), { timeZone: 'America/Los_Angeles' }), '2026-06-15');
  });

  it('compares UTC stored timestamps against the viewer local day', () => {
    const range = localDayRange(new Date('2026-06-15T12:00:00.000Z'), { timeZone: 'America/Los_Angeles' });

    assert.equal(isWithinRange(new Date('2026-06-15T06:59:59.999Z'), range), false);
    assert.equal(isWithinRange(new Date('2026-06-15T07:00:00.000Z'), range), true);
    assert.equal(isWithinRange(new Date('2026-06-15T22:59:59.999Z'), range), true);
    assert.equal(isWithinRange(new Date('2026-06-16T07:00:00.000Z'), range), false);
  });

  it('builds today and yesterday presets from local midnight', () => {
    const now = new Date('2026-06-16T14:00:00.000Z');
    const today = localPresetRange('today', now, { timeZone: 'America/Los_Angeles' });
    const tomorrow = localPresetRange('tomorrow', now, { timeZone: 'America/Los_Angeles' });
    const yesterday = localPresetRange('yesterday', now, { timeZone: 'America/Los_Angeles' });
    const untilYesterday = localPresetRange('until_yesterday', now, { timeZone: 'America/Los_Angeles' });
    const throughToday = localPresetRange('through_today', now, { timeZone: 'America/Los_Angeles' });

    assert.equal(today.from.toISOString(), '2026-06-16T07:00:00.000Z');
    assert.equal(today.to.toISOString(), '2026-06-17T07:00:00.000Z');
    assert.equal(tomorrow.from.toISOString(), '2026-06-17T07:00:00.000Z');
    assert.equal(tomorrow.to.toISOString(), '2026-06-18T07:00:00.000Z');
    assert.equal(yesterday.from.toISOString(), '2026-06-15T07:00:00.000Z');
    assert.equal(yesterday.to.toISOString(), '2026-06-16T07:00:00.000Z');
    assert.equal(untilYesterday.from, null);
    assert.equal(untilYesterday.to.toISOString(), '2026-06-16T07:00:00.000Z');
    assert.equal(throughToday.from, null);
    assert.equal(throughToday.to.toISOString(), '2026-06-17T07:00:00.000Z');
  });

  it('honors explicit local dates in the selected timezone', () => {
    const range = localDateRange('2026-01-10', { timeZone: 'America/Los_Angeles' });

    assert.equal(range.from.toISOString(), '2026-01-10T08:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-01-11T08:00:00.000Z');
  });

  it('uses Sunday through Saturday for local week presets', () => {
    const now = new Date('2026-06-17T14:00:00.000Z');
    const thisWeek = localPresetRange('this_week', now, { timeZone: 'America/Los_Angeles' });
    const lastWeek = localPresetRange('last_week', now, { timeZone: 'America/Los_Angeles' });

    assert.equal(localWeekStart(now, { timeZone: 'America/Los_Angeles' }).toISOString(), '2026-06-14T07:00:00.000Z');
    assert.equal(thisWeek.from.toISOString(), '2026-06-14T07:00:00.000Z');
    assert.equal(thisWeek.to.toISOString(), '2026-06-21T07:00:00.000Z');
    assert.equal(lastWeek.from.toISOString(), '2026-06-07T07:00:00.000Z');
    assert.equal(lastWeek.to.toISOString(), '2026-06-14T07:00:00.000Z');
  });
});

function isWithinRange(value, range) {
  return value >= range.from && value < range.to;
}
