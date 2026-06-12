export const MAX_ATTEMPTS = numberEnv('TAILORING_MAX_ATTEMPTS', 3);
export const TAILORING_CONCURRENCY = numberEnv('TAILORING_CONCURRENCY', 4);
export const MAX_MESSAGES_PER_POLL = Math.min(numberEnv('TAILORING_MAX_MESSAGES_PER_POLL', 4), 10);
export const RECEIVE_WAIT_TIME_SECONDS = numberEnv('TAILORING_RECEIVE_WAIT_TIME_SECONDS', 20);
export const VISIBILITY_TIMEOUT_SECONDS = numberEnv('TAILORING_VISIBILITY_TIMEOUT_SECONDS', 10 * 60);
export const MAX_SQS_DELAY_SECONDS = 15 * 60;

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
