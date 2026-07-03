export const EMPTY_BID = {
  status: 'planned',
};

export const DEFAULT_BID_FILTERS = {
  search: '',
  roleFamily: 'all',
  source: 'all',
  locationRegion: 'all',
  appliedProfileId: 'all',
  since: 'all',
  dateFrom: '',
  dateTo: '',
  spam: 'all',
  visibility: 'visible',
  origin: 'all',
  sort: 'scraped_desc',
  page: 1,
  limit: 10,
};

export const BID_TABS = {
  todo: 'todo',
  tailored: 'tailored',
  done: 'done',
  badWork: 'bad_work',
  interviews: 'interviews',
};

export const REVIEW_STATUSES = new Set(['mismatching_bid', 'spam_job']);
export const DONE_STATUSES = new Set(['submitted', 'needs_follow_up', 'stale', 'blocked', 'won', 'lost']);
export const INTERVIEW_STATUSES = new Set(['interviewing']);
export const APPLICATION_WORKFLOW_STATUSES = [
  { value: 'queued', label: 'Queued' },
  { value: 'tailoring', label: 'Tailoring' },
  { value: 'ready', label: 'Ready' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'needs_follow_up', label: 'Needs follow-up' },
  { value: 'stale', label: 'Stale' },
  { value: 'blocked', label: 'Blocked' },
];

export const INTERVIEW_STAGES = [
  { value: 'todo', label: 'Todo' },
  { value: 'screening', label: 'Screening' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'technical_interview', label: 'Technical Interview' },
  { value: 'panel', label: 'Panel' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'system_design', label: 'System Design' },
  { value: 'final', label: 'Final' },
];

export const INTERVIEW_OUTCOME_COLUMNS = [
  { value: 'won', label: 'Hired', status: 'won' },
  { value: 'lost', label: 'Failed/Lost', status: 'lost' },
];

export const INTERVIEW_KANBAN_COLUMNS = [...INTERVIEW_STAGES, ...INTERVIEW_OUTCOME_COLUMNS];
