import { clean } from '../../../utils/index.js';
import { InputError } from '../../../utils/errors.js';

export const INTERVIEW_FAILURE_FEEDBACK_VALUES = [
  'bad_preparation',
  'linkedin_problem',
  'face_problem',
  'lack_of_skill',
  'other',
];

const FAILURE_FEEDBACK_SET = new Set(INTERVIEW_FAILURE_FEEDBACK_VALUES);
const FAILED_INTERVIEW_STATUSES = new Set(['failed', 'lost']);

export function isFailedInterviewStatus(value) {
  return FAILED_INTERVIEW_STATUSES.has(clean(value).toLowerCase());
}

export function interviewFailureFeedbackAttributes(body = {}, status = '') {
  const hasFailureFeedback = Object.prototype.hasOwnProperty.call(body, 'failureFeedback');
  const hasFailureFeedbackNotes = Object.prototype.hasOwnProperty.call(body, 'failureFeedbackNotes');
  const failureFeedback = clean(body.failureFeedback).toLowerCase();
  const failureFeedbackNotes = clean(body.failureFeedbackNotes);

  if (failureFeedback && !FAILURE_FEEDBACK_SET.has(failureFeedback)) {
    throw new InputError('Choose valid interview feedback');
  }
  if (isFailedInterviewStatus(status) && !failureFeedback) {
    throw new InputError('Interview feedback is required when marking an interview failed or lost');
  }

  return {
    ...(hasFailureFeedback ? { failureFeedback: failureFeedback || null } : {}),
    ...(hasFailureFeedbackNotes ? { failureFeedbackNotes: failureFeedbackNotes || null } : {}),
  };
}

export function interviewFailureFeedbackValues(attrs = {}, existing = null, status = '') {
  if (!isFailedInterviewStatus(status)) {
    return { failureFeedback: null, failureFeedbackNotes: null };
  }

  const failureFeedback = clean(attrs.failureFeedback || existing?.failureFeedback).toLowerCase();
  if (!FAILURE_FEEDBACK_SET.has(failureFeedback)) {
    throw new InputError('Interview feedback is required when marking an interview failed or lost');
  }
  const failureFeedbackNotes = Object.prototype.hasOwnProperty.call(attrs, 'failureFeedbackNotes')
    ? clean(attrs.failureFeedbackNotes) || null
    : clean(existing?.failureFeedbackNotes) || null;
  return { failureFeedback, failureFeedbackNotes };
}
