import assert from 'node:assert/strict';
import test from 'node:test';
import { jobRegion } from './jobRegion.js';

test('classifies UK job locations separately from US/worldwide', () => {
  assert.equal(jobRegion({ location: 'London, England' })?.value, 'uk');
  assert.equal(jobRegion({ location: 'Remote - UK' })?.value, 'uk');
  assert.equal(jobRegion({ location: 'New York, NY' })?.value, 'us_worldwide');
});

test('classifies grouped jobs as UK when a UK location option is present', () => {
  assert.equal(jobRegion({
    location: 'Worldwide',
    locationOptions: [{ locationLabel: 'Manchester, United Kingdom' }],
  })?.value, 'uk');
});

test('does not confuse British Columbia with the UK', () => {
  assert.equal(jobRegion({ location: 'Vancouver, British Columbia' })?.value, 'canada');
});
