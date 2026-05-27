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
  const text = jobClipboardText(job);

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}
