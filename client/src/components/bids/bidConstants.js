export const EMPTY_BID = {
  status: 'planned',
};

export const DEFAULT_BID_FILTERS = {
  search: '',
  roleFamily: 'all',
  source: 'all',
  appliedByUserId: 'all',
  since: '24h',
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
  interviews: 'interviews',
};

export const DONE_STATUSES = new Set(['submitted', 'won', 'lost']);
export const INTERVIEW_STATUSES = new Set(['interviewing']);

export const INTERVIEW_STAGES = [
  { value: 'screening', label: 'Screening' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'technical_interview', label: 'Technical Interview' },
  { value: 'panel', label: 'Panel' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'system_design', label: 'System Design' },
  { value: 'final', label: 'Final' },
];
