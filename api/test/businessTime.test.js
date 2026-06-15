import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { businessDateRange, businessDayRange, businessDateKey } from '../server/utils/businessTime.js';

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

  it('compares UTC stored timestamps against the platform today window', () => {
    const range = businessDayRange(new Date('2026-06-15T22:30:00.000Z'));

    assert.equal(isWithinRange(new Date('2026-06-14T22:59:59.999Z'), range), false);
    assert.equal(isWithinRange(new Date('2026-06-14T23:00:00.000Z'), range), true);
    assert.equal(isWithinRange(new Date('2026-06-15T02:00:00.000Z'), range), true);
    assert.equal(isWithinRange(new Date('2026-06-15T22:59:59.999Z'), range), true);
    assert.equal(isWithinRange(new Date('2026-06-15T23:00:00.000Z'), range), false);
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
