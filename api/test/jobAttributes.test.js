import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyJobAttributes,
  inferJobSeniority,
  inferJobWorkMode,
  normalizeJobSeniority,
  normalizeJobWorkMode,
} from '../server/modules/jobs/application/jobAttributes.js';

test('normalizes source-provided job attributes', () => {
  assert.equal(normalizeJobSeniority('Entry Level'), 'entry_level');
  assert.equal(normalizeJobSeniority('Vice President'), 'executive');
  assert.equal(normalizeJobWorkMode('On-site'), 'onsite');
  assert.equal(normalizeJobWorkMode('Fully Remote'), 'remote');
});

test('infers seniority from title with management precedence', () => {
  assert.equal(inferJobSeniority({ title: 'Senior Engineering Manager' }), 'manager');
  assert.equal(inferJobSeniority({ title: 'Staff Machine Learning Engineer' }), 'staff');
  assert.equal(inferJobSeniority({ title: 'Software Engineer' }), 'unknown');
});

test('prefers explicit work mode and conservatively uses description text', () => {
  assert.equal(inferJobWorkMode({ workMode: 'Hybrid', location: 'Remote' }), 'hybrid');
  assert.equal(inferJobWorkMode({ location: 'Remote - US' }), 'remote');
  assert.equal(inferJobWorkMode({ listingText: 'This is an office-based role in Boston.' }), 'onsite');
  assert.equal(inferJobWorkMode({ listingText: 'Benefits include occasional remote work.' }), 'unknown');
});

test('reads scraper-specific values from nested raw job data', () => {
  assert.deepEqual(classifyJobAttributes({
    title: 'Engineer',
    rawJob: { processed: { seniority_level: 'Senior', workplace_type: 'Remote' } },
  }), { seniority: 'senior', workMode: 'remote' });
});
