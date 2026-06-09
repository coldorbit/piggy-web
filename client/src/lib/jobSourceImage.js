export const MANUAL_JOB_SOURCE_IMAGE_URL = '/assets/manual-job-source.webp';

export const SOURCE_DOMAINS = {
  builtin: 'builtin.com',
  'built in': 'builtin.com',
  diversityjobs: 'diversityjobs.com',
  hiringcafe: 'hiring.cafe',
  jobright: 'jobright.ai',
  linkedin: 'linkedin.com',
  remotehunter: 'remotehunter.io',
  remoteyeah: 'remoteyeah.com',
  simplify: 'simplify.jobs',
};

export function jobSourceImageUrl({ isManual, source, sourceUrl, size = 32 }) {
  if (isManual) return MANUAL_JOB_SOURCE_IMAGE_URL;

  const domain = domainFromUrl(sourceUrl) || SOURCE_DOMAINS[String(source || '').toLowerCase()];
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

export function sourceLabel(source) {
  return String(source || 'Unknown platform').trim() || 'Unknown platform';
}

export function domainFromUrl(value) {
  if (!value) return '';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
