export const MAX_ATTEMPTS = numberEnv('TAILORING_MAX_ATTEMPTS', 3);
export const TAILORING_CONCURRENCY = numberEnv('TAILORING_CONCURRENCY', 4);
export const STALE_PROCESSING_SECONDS = numberEnv('TAILORING_STALE_PROCESSING_SECONDS', 10 * 60);
export const MAX_RETRY_DELAY_SECONDS = 15 * 60;

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
