import { copyText } from './clipboard.js';

export function jobDescriptionText(job) {
  return (
    job?.description ||
    job?.rawJob?.description ||
    job?.listingText ||
    job?.rawJob?.listingText ||
    job?.rawJob?.jobDescription ||
    ''
  );
}

export function jobClipboardText(job) {
  return [job?.company || 'Unknown company', job?.title || 'Untitled role', jobDescriptionText(job)]
    .filter(Boolean)
    .join('\n');
}

export async function copyJobDescription(job) {
  if (!jobDescriptionText(job)) return false;
  return copyText(jobClipboardText(job));
}
