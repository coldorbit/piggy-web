import { execFileSync } from 'node:child_process';
import test from 'node:test';

function inTimezone(timeZone, assertions) {
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {
      fromDefaultTimezoneDatetimeLocal as toUtc,
      toDefaultTimezoneDatetimeLocal as toLocal,
      defaultTimezoneAbbreviation as label,
      defaultTimezoneRangeLabel as rangeLabel,
    } from './client/src/lib/timezone.js';
    ${assertions}
  `], { cwd: new URL('../../', import.meta.url), env: { ...process.env, TZ: timeZone }, stdio: 'pipe' });
}

test('interview scheduling and labels use the scheduled date DST offset in New York', () => {
  inTimezone('America/New_York', `
    assert.equal(toUtc('2026-01-15T09:00'), '2026-01-15T14:00:00.000Z');
    assert.equal(toUtc('2026-07-15T09:00'), '2026-07-15T13:00:00.000Z');
    assert.equal(toLocal('2026-07-15T13:00:00Z'), '2026-07-15T09:00');
    assert.equal(label('2026-01-15T09:00'), 'EST');
    assert.equal(label('2026-07-15T09:00'), 'EDT');
    assert.equal(rangeLabel(['2026-03-07', '2026-03-08']), 'EST / EDT');
    assert.equal(toUtc('2026-03-08T02:30'), '2026-03-08T07:30:00.000Z');
    assert.equal(toUtc('2026-11-01T01:30'), '2026-11-01T05:30:00.000Z');
    const start = new Date(toUtc('2026-03-08T00:00'));
    const end = new Date(toUtc('2026-03-09T00:00'));
    assert.equal((end - start) / 3600000, 23);
    assert.equal((new Date(toUtc('2026-11-02T00:00')) - new Date(toUtc('2026-11-01T00:00'))) / 3600000, 25);
  `);
});

test('calendar moves preserve wall time across UK daylight saving changes', () => {
  inTimezone('Europe/London', `
    assert.equal(toUtc('2026-03-28T09:00'), '2026-03-28T09:00:00.000Z');
    assert.equal(toUtc('2026-03-29T09:00'), '2026-03-29T08:00:00.000Z');
    assert.equal(toUtc('2026-10-25T09:00'), '2026-10-25T09:00:00.000Z');
    assert.equal(toLocal(toUtc('2026-07-15T09:00')), '2026-07-15T09:00');
    assert.notEqual(label('2026-01-15T09:00'), label('2026-07-15T09:00'));
  `);
});

test('scheduling also works in a timezone without daylight saving', () => {
  inTimezone('Asia/Kolkata', `
    assert.equal(toUtc('2026-01-15T09:00'), '2026-01-15T03:30:00.000Z');
    assert.equal(toUtc('2026-07-15T09:00'), '2026-07-15T03:30:00.000Z');
    assert.equal(rangeLabel(['2026-01-15', '2026-07-15']), label('2026-01-15T09:00'));
  `);
});
