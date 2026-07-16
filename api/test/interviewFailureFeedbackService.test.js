import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  interviewFailureFeedbackAttributes,
  interviewFailureFeedbackValues,
  isFailedInterviewStatus,
} from '../server/modules/bidding/application/interviewFailureFeedbackService.js';

describe('interview failure feedback', () => {
  it('requires a supported reason for failed or lost interviews', () => {
    assert.equal(isFailedInterviewStatus('lost'), true);
    assert.equal(isFailedInterviewStatus('failed'), true);
    assert.equal(isFailedInterviewStatus('won'), false);
    assert.throws(
      () => interviewFailureFeedbackAttributes({ status: 'lost' }, 'lost'),
      /feedback is required/,
    );
    assert.throws(
      () => interviewFailureFeedbackAttributes({ failureFeedback: 'connection_problem' }, 'lost'),
      /valid interview feedback/,
    );
  });

  it('normalizes a reason and optional notes', () => {
    assert.deepEqual(
      interviewFailureFeedbackAttributes({
        failureFeedback: ' LACK_OF_SKILL ',
        failureFeedbackNotes: ' Needs more system design practice. ',
      }, 'lost'),
      {
        failureFeedback: 'lack_of_skill',
        failureFeedbackNotes: 'Needs more system design practice.',
      },
    );
  });

  it('preserves stored feedback on failed updates and clears it when reopened', () => {
    const existing = {
      failureFeedback: 'bad_preparation',
      failureFeedbackNotes: 'Backfilled review',
    };
    assert.deepEqual(
      interviewFailureFeedbackValues({}, existing, 'lost'),
      { failureFeedback: 'bad_preparation', failureFeedbackNotes: 'Backfilled review' },
    );
    assert.deepEqual(
      interviewFailureFeedbackValues({}, existing, 'interviewing'),
      { failureFeedback: null, failureFeedbackNotes: null },
    );
  });
});
