import { DEFAULT_BID_FILTERS, INTERVIEW_STAGES } from '../bids/bidConstants.js';

export const INTERVIEW_FILTERS = {
  ...DEFAULT_BID_FILTERS,
  since: 'all',
  sort: 'updated_desc',
  limit: 100,
};

const DEFAULT_STAGE = INTERVIEW_STAGES[0].value;

export function groupJobsByStage(jobs, draftFor) {
  return INTERVIEW_STAGES.reduce((groups, stage) => {
    groups[stage.value] = jobs.filter((job) => canonicalInterviewStage(draftFor(job).interviewStage) === stage.value);
    return groups;
  }, {});
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
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}
