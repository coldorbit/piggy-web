import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesAiMlArea, matchesJobRole } from './jobClassification.js';

test('the all-AI/ML role filter includes scraper role categories and legacy rows', () => {
  for (const category of [
    'ai_ml',
    'ml_engineer',
    'data_scientist',
    'applied_scientist',
    'research_scientist',
    'other_ai_ml',
  ]) {
    assert.equal(matchesJobRole({ category }, 'ai_ml'), true, category);
  }
  assert.equal(matchesJobRole({ category: 'software' }, 'ai_ml'), false);
});

test('individual role and AI/ML area filters remain exact', () => {
  const job = { category: 'research_scientist', aiMlArea: 'generative_ai' };

  assert.equal(matchesJobRole(job, 'research_scientist'), true);
  assert.equal(matchesJobRole(job, 'data_scientist'), false);
  assert.equal(matchesAiMlArea(job, 'generative_ai'), true);
  assert.equal(matchesAiMlArea(job, 'computer_vision'), false);
});

test('AI/ML area filters reject non-AI roles with stale area values', () => {
  assert.equal(matchesAiMlArea({
    category: 'software',
    aiMlArea: 'generative_ai',
  }, 'generative_ai'), false);
});
