export const TAILORED_RESUME_STATUSES = ['requested', 'processing', 'ready', 'dead_letter'];
export const TODO_LOCKED_TAILORED_STATUSES = ['requested', 'processing', 'ready'];

export function hasTailoredResumeActivity(job) {
  return TAILORED_RESUME_STATUSES.includes(job?.tailoredResume?.status);
}

export function isTodoTailoringLocked(job) {
  return TODO_LOCKED_TAILORED_STATUSES.includes(job?.tailoredResume?.status);
}
