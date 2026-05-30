export const EMPTY_BID = {
  status: 'planned',
};

export const DEFAULT_BID_FILTERS = {
  search: '',
  roleFamily: 'all',
  source: 'all',
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
};

export const DONE_STATUSES = new Set(['submitted', 'interviewing', 'won', 'lost']);
