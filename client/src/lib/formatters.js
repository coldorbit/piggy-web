export function formatDate(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function spamStatusLabel(job) {
  if (job.isSpam === true) return `Spam${job.spamReviewedAt ? ` on ${formatDateTime(job.spamReviewedAt)}` : ''}`;
  if (job.isSpam === false) return `Not spam${job.spamReviewedAt ? ` on ${formatDateTime(job.spamReviewedAt)}` : ''}`;
  return 'Unreviewed';
}
