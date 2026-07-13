import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  learningReviewAttributes,
  normalizeCompanyName,
} from '../server/modules/bidding/application/profileLearningReviewService.js';

describe('profile learning review validation', () => {
  it('normalizes a confirmed outcome and learning notes', () => {
    const attrs = learningReviewAttributes({
      outcomeReason: ' Company_Declined ',
      outcomeAt: '2026-07-13',
      learningSummary: '  Lead with production impact. ',
      nextAction: ' Add a reliability story. ',
    });

    assert.equal(attrs.outcomeReason, 'company_declined');
    assert.equal(attrs.outcomeAt, '2026-07-13');
    assert.equal(attrs.learningSummary, 'Lead with production impact.');
    assert.equal(attrs.nextAction, 'Add a reliability story.');
  });

  it('allows an unconfirmed outcome while keeping a reflection', () => {
    assert.deepEqual(learningReviewAttributes({ learningSummary: 'Practice concise trade-offs.' }), {
      outcomeReason: null,
      outcomeAt: null,
      learningSummary: 'Practice concise trade-offs.',
      nextAction: null,
    });
  });

  it('rejects invalid outcome reasons and dates', () => {
    assert.throws(() => learningReviewAttributes({ outcomeReason: 'rejected-ish' }), /valid outcome reason/);
    assert.throws(() => learningReviewAttributes({ outcomeAt: 'not-a-date' }), /valid date/);
  });

  it('matches learning companies without case or spacing differences', () => {
    assert.equal(normalizeCompanyName('  Uber   Technologies  '), 'uber technologies');
  });
});
