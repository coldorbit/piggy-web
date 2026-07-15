export function normalizeLearningImageUrl(value) {
  const input = String(value || '').trim();
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Enter a valid image URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Image URLs must use HTTP or HTTPS.');
  }
  return parsed.toString();
}

export function insertLearningImage(content, image, selection = {}) {
  const source = String(content || '');
  const start = clampSelection(selection.start, source.length);
  const end = Math.max(start, clampSelection(selection.end ?? start, source.length));
  const url = normalizeLearningImageUrl(image?.url);
  const alt = escapeImageAlt(image?.alt);
  if (!alt) throw new Error('Add a short image description for accessibility.');

  const before = source.slice(0, start);
  const after = source.slice(end);
  const leading = blockSpacingBefore(before);
  const trailing = blockSpacingAfter(after);
  const markdown = `![${alt}](<${url}>)`;
  const insertion = `${leading}${markdown}${trailing}`;

  return {
    content: `${before}${insertion}${after}`,
    cursor: before.length + leading.length + markdown.length,
  };
}

function clampSelection(value, length) {
  const number = Number(value);
  if (!Number.isFinite(number)) return length;
  return Math.min(length, Math.max(0, Math.trunc(number)));
}

function escapeImageAlt(value) {
  return String(value || '').trim().replace(/([\\\[\]])/g, '\\$1');
}

function blockSpacingBefore(value) {
  if (!value || value.endsWith('\n\n')) return '';
  return value.endsWith('\n') ? '\n' : '\n\n';
}

function blockSpacingAfter(value) {
  if (!value || value.startsWith('\n\n')) return '';
  return value.startsWith('\n') ? '\n' : '\n\n';
}
