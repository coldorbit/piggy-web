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

  it('honors standard time offsets for explicit business dates', () => {
    const range = businessDateRange('2026-01-10');

    assert.equal(range.from.toISOString(), '2026-01-11T00:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-01-12T00:00:00.000Z');
  });
});
