import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { businessDateRange, businessDayRange, businessDateKey, businessPresetRange } from '../server/utils/businessTime.js';

describe('business time helpers', () => {
  it('keeps the previous business day before 7pm ET', () => {
    const range = businessDayRange(new Date('2026-06-15T22:59:00.000Z'));

    assert.equal(range.from.toISOString(), '2026-06-14T23:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-15T23:00:00.000Z');
    assert.equal(businessDateKey(new Date('2026-06-15T22:59:00.000Z')), '2026-06-14');
  });

  it('starts the next business day at 7pm ET', () => {
    const range = businessDayRange(new Date('2026-06-15T23:00:00.000Z'));

    assert.equal(range.from.toISOString(), '2026-06-15T23:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-16T23:00:00.000Z');
    assert.equal(businessDateKey(new Date('2026-06-15T23:00:00.000Z')), '2026-06-15');
  });

  it('uses 11pm UTC as the today boundary during daylight time', () => {
    const range = businessDayRange(new Date('2026-06-15T22:30:00.000Z'));

    assert.equal(range.from.toISOString(), '2026-06-14T23:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-15T23:00:00.000Z');
  });

  it('compares UTC stored timestamps against the platform today window', () => {
    const range = businessDayRange(new Date('2026-06-15T22:30:00.000Z'));

    assert.equal(isWithinRange(new Date('2026-06-14T22:59:59.999Z'), range), false);
    assert.equal(isWithinRange(new Date('2026-06-14T23:00:00.000Z'), range), true);
    assert.equal(isWithinRange(new Date('2026-06-15T02:00:00.000Z'), range), true);
    assert.equal(isWithinRange(new Date('2026-06-15T22:59:59.999Z'), range), true);
    assert.equal(isWithinRange(new Date('2026-06-15T23:00:00.000Z'), range), false);
  });

  it('treats the latest 7pm ET boundary as today during the next morning', () => {
    const range = businessDayRange(new Date('2026-06-16T14:00:00.000Z'));

    assert.equal(range.from.toISOString(), '2026-06-15T23:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-16T23:00:00.000Z');
    assert.equal(isWithinRange(new Date('2026-06-15T22:00:00.000Z'), range), false);
    assert.equal(isWithinRange(new Date('2026-06-16T00:00:00.000Z'), range), true);
  });

  it('builds today and yesterday presets from the same 7pm ET boundary', () => {
    const now = new Date('2026-06-16T14:00:00.000Z');
    const today = businessPresetRange('today', now);
    const yesterday = businessPresetRange('yesterday', now);
    const untilYesterday = businessPresetRange('until_yesterday', now);
    const throughToday = businessPresetRange('through_today', now);

    assert.equal(today.from.toISOString(), '2026-06-15T23:00:00.000Z');
    assert.equal(today.to.toISOString(), '2026-06-16T23:00:00.000Z');
    assert.equal(yesterday.from.toISOString(), '2026-06-14T23:00:00.000Z');
    assert.equal(yesterday.to.toISOString(), '2026-06-15T23:00:00.000Z');
    assert.equal(untilYesterday.from, null);
    assert.equal(untilYesterday.to.toISOString(), '2026-06-15T23:00:00.000Z');
    assert.equal(throughToday.from, null);
    assert.equal(throughToday.to.toISOString(), '2026-06-16T23:00:00.000Z');
  });

  it('honors standard time offsets for explicit business dates', () => {
    const range = businessDateRange('2026-01-10');

    assert.equal(range.from.toISOString(), '2026-01-11T00:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-01-12T00:00:00.000Z');
  });
});

function isWithinRange(value, range) {
  return value >= range.from && value < range.to;
}
