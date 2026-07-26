import { clean } from '../../../utils/index.js';

const MAX_EXTRACTED_VALUE_LENGTH = 180;
const MAX_IDENTITY_CANDIDATES = 16;
const GENERIC_COMPANY_VALUES = new Set(['a company', 'company', 'the company', 'this company']);
const GENERIC_TITLE_VALUES = new Set(['a job', 'job', 'position', 'role', 'the job', 'the position', 'the role']);

const TITLE_PATTERNS = [
  /\b(?:your\s+)?(?:job\s+)?application for (?:the\s+)?(.{2,180}?)\s+(?:job|role|position)\s+(?:was|has been|is)\s+(?:successfully\s+)?(?:submitted|received)\b/i,
  /\b(?:your\s+)?(?:job\s+)?application for (?:the\s+)?(.{2,180}?)\s+(?:was|has been|is)\s+(?:successfully\s+)?(?:submitted|received)\b/i,
  /\bwe (?:have )?received your (?:job\s+)?application for (?:the\s+)?(.{2,180}?)(?=[.!?\r\n]|$)/i,
  /\b(?:your\s+)?(?:job\s+)?application for (?:the\s+)?(.{2,180}?)(?=[.!?\r\n]|$)/i,
  /\b(?:thank you|thanks) for applying (?:for|to) (?:the\s+)?(.{2,180}?)\s+(?:job|role|position)(?=[.!?\r\n]|$)/i,
  /\byou applied (?:for|to) (?:the\s+)?(.{2,180}?)(?:\s+(?:job|role|position))?(?=\s+at\b|[.!?\r\n]|$)/i,
];

const COMPANY_PATTERNS = [
  /^(?:thank you|thanks) for applying to (.{2,180}?)[.!?]*$/i,
  /^\[([^\]]{2,180})\]\s*(?:your\s+)?(?:job\s+)?application\b/i,
  /\byou applied (?:for|to).{2,180}?\s+at\s+(.{2,180}?)(?=[.!?\r\n]|$)/i,
  /\bapplication for .{2,180}?\s+at\s+(.{2,180}?)(?=[.!?\r\n]|$)/i,
  /\b(?:application|candidacy)\s+(?:to|with)\s+(.{2,180}?)(?=[.!?\r\n]|$)/i,
];

export function jobIdentityCandidatesFromConfirmationMessage(message = {}) {
  const texts = candidateTexts(message);
  const companies = extractedValues(texts, COMPANY_PATTERNS, companyCandidate);
  const titles = extractedValues(texts, TITLE_PATTERNS, titleCandidate)
    .flatMap(titleCandidateVariants);
  const identities = [];
  const seen = new Set();

  for (const company of companies) {
    for (const title of titles) {
      const key = `${company.toLowerCase()}::${title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      identities.push({ company, title });
      if (identities.length >= MAX_IDENTITY_CANDIDATES) return identities;
    }
  }

  return identities;
}

export function matchingJobDateWindow(message = {}, now = new Date()) {
  const receivedAt = validDate(message.receivedAt) || validDate(now) || new Date();
  return {
    cutoff: new Date(receivedAt.getTime() - 180 * 24 * 60 * 60 * 1000),
    ceiling: new Date(receivedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
  };
}

function candidateTexts(message) {
  const values = [
    message.subject,
    message.bodyPreview,
    message.bodyText,
    stripHtml(message.bodyHtml),
  ].map((value) => clean(value)).filter(Boolean);
  const lines = values.flatMap((value) => value.split(/\r?\n/).map((line) => clean(line)).filter(Boolean));
  return [...new Set([...lines, ...values])];
}

function extractedValues(texts, patterns, normalize) {
  const values = [];
  const seen = new Set();
  for (const text of texts) {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      const value = normalize(match?.[1]);
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      values.push(value);
    }
  }
  return values;
}

function companyCandidate(value) {
  const candidate = cleanCandidate(value);
  if (!candidate || GENERIC_COMPANY_VALUES.has(candidate.toLowerCase())) return '';
  if (/\b(job|position|role)\s*$/i.test(candidate)) return '';
  if (/@|https?:\/\//i.test(candidate)) return '';
  return candidate;
}

function titleCandidate(value) {
  const candidate = cleanCandidate(value)
    ?.replace(/\s+(?:job|role|position)\s+(?:was|has been|is)\s+(?:successfully\s+)?(?:submitted|received).*$/i, '')
    .replace(/\s+(?:job|position|role)$/i, '')
    .trim();
  if (!candidate || GENERIC_TITLE_VALUES.has(candidate.toLowerCase())) return '';
  if (/@|https?:\/\//i.test(candidate)) return '';
  return candidate;
}

function titleCandidateVariants(value) {
  const variants = [value];
  const withoutRequisition = value.replace(/\s+[-–—]\s*(?:req(?:uisition)?\s*)?#?\d[\w-]*$/i, '').trim();
  if (withoutRequisition && withoutRequisition !== value) variants.push(withoutRequisition);
  return variants;
}

function cleanCandidate(value) {
  const candidate = clean(value)
    .replace(/^[\s"'([{]+|[\s"')\]}]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (candidate.length < 2 || candidate.length > MAX_EXTRACTED_VALUE_LENGTH) return '';
  return candidate;
}

function stripHtml(value) {
  return clean(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
