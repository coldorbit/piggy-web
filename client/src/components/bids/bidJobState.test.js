import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { moveToInterviewDraft } from './bidJobState.js';

describe('moveToInterviewDraft', () => {
  it('moves an application into an interview todo stage', () => {
    assert.deepEqual(
      moveToInterviewDraft({
        status: 'submitted',
        interviewStage: 'final',
        notes: 'keep this note',
      }),
      {
        status: 'interviewing',
        interviewStage: 'todo',
        notes: 'keep this note',
      },
    );
  });
});
