export function matchesSpamFilter(job, filter) {
  if (filter === 'spam') return job.isSpam === true;
  if (filter === 'not_spam') return job.isSpam === false;
  if (filter === 'unreviewed') return job.isSpam === null;
  return true;
}

export function matchesVisibilityFilter(job, filter) {
  if (filter === 'hidden') return job.isHidden === true;
  if (filter === 'all') return true;
  return job.isHidden !== true;
}
