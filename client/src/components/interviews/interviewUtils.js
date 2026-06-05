import { DEFAULT_BID_FILTERS, INTERVIEW_KANBAN_COLUMNS, INTERVIEW_STAGES } from '../bids/bidConstants.js';
import { toDefaultTimezoneDatetimeLocal } from '../../lib/timezone.js';

export const INTERVIEW_FILTERS = {
  ...DEFAULT_BID_FILTERS,
  since: 'all',
  sort: 'updated_desc',
  limit: 100,
};

const DEFAULT_STAGE = INTERVIEW_STAGES[0].value;

export function groupJobsByStage(jobs, draftFor) {
  return INTERVIEW_KANBAN_COLUMNS.reduce((groups, stage) => {
    groups[stage.value] = jobs.filter((job) => interviewColumnValue(job, draftFor) === stage.value);
    return groups;
  }, {});
}

export function interviewColumnValue(job, draftFor) {
  const draft = draftFor(job);
  if (draft.status === 'won') return 'won';
  if (draft.status === 'lost') return 'lost';
  return canonicalInterviewStage(draft.interviewStage);
}

export function interviewStatusForColumn(column) {
  if (column === 'won') return 'won';
  if (column === 'lost') return 'lost';
  return 'interviewing';
}

export function interviewStageForColumn(column, fallback = DEFAULT_STAGE) {
  if (column === 'won' || column === 'lost') return canonicalInterviewStage(fallback);
  return canonicalInterviewStage(column);
}

export function canonicalInterviewStage(value) {
  const aliases = {
    recruiter: 'hiring_manager',
    technical: 'technical_interview',
    take_home: 'technical_interview',
    onsite: 'panel',
    offer: 'final',
    follow_up: 'final',
  };
  const stage = aliases[value] || value || DEFAULT_STAGE;
  return INTERVIEW_STAGES.some((item) => item.value === stage) ? stage : DEFAULT_STAGE;
}

export function toDatetimeLocalValue(value) {
  return toDefaultTimezoneDatetimeLocal(value);
}
