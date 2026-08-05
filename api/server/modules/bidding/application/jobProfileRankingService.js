import { createHash } from 'node:crypto';

export const JOB_PROFILE_RANKING_MODEL_VERSION = 'baseline-keyword-v1';
export const JOB_PROFILE_RANKING_CANDIDATE_LIMIT = 500;

const COMPONENT_WEIGHTS = {
  skills: 0.45,
  title: 0.2,
  specialization: 0.1,
  seniority: 0.1,
  workMode: 0.05,
  freshness: 0.1,
};

const STOP_WORDS = new Set([
  'about', 'after', 'also', 'among', 'and', 'are', 'based', 'been', 'being', 'build', 'building',
  'but', 'can', 'company', 'develop', 'developing', 'experience', 'for', 'from', 'have', 'having',
  'into', 'job', 'more', 'our', 'role', 'team', 'that', 'the', 'their', 'them', 'they', 'this',
  'through', 'using', 'was', 'will', 'with', 'work', 'working', 'you', 'your', 'years',
]);

const SENIORITY_LEVELS = [
  { level: 6, patterns: [/\bchief\b/, /\bvp\b/, /\bvice president\b/] },
  { level: 5, patterns: [/\bdirector\b/, /\bhead\b/] },
  { level: 4, patterns: [/\bprincipal\b/, /\bstaff\b/] },
  { level: 3, patterns: [/\bsenior\b/, /\bsr\.?\b/, /\blead\b/] },
  { level: 1, patterns: [/\bjunior\b/, /\bjr\.?\b/, /\bentry[- ]level\b/, /\bnew grad\b/, /\bintern\b/] },
];

export function rankJobsForProfile({ profile, intelligence = null, jobs = [], now = new Date() }) {
  const profileContext = buildProfileContext(profile, intelligence);
  return jobs
    .map((job) => ({ job, match: scoreJobForProfile({ profileContext, job, now }) }))
    .sort(compareRankedJobs);
}

export function buildProfileContext(profile = {}, intelligence = null) {
  const targetTitles = arrayValues(intelligence?.targetTitles);
  const specializations = arrayValues(intelligence?.specializations);
  const profileDocument = [
    targetTitles.join(' '),
    intelligence?.targetLevel,
    specializations.join(' '),
    intelligence?.professionalSummary,
    profile.profileBadge,
    profile.yearsOfExperience,
    profile.resumeText,
  ].filter(Boolean).join('\n');

  return {
    document: profileDocument,
    fingerprint: textFingerprint(profileDocument),
    tokens: rankingTokens(profileDocument),
    targetTitleTokens: rankingTokens(targetTitles.join(' ')),
    targetLevel: String(intelligence?.targetLevel || '').trim(),
    specializations: new Set(specializations.map(normalizedLabel)),
    remotePreference: String(intelligence?.remotePreference || '').trim().toLowerCase(),
    yearsOfExperience: numericYears(profile.yearsOfExperience),
  };
}

export function scoreJobForProfile({ profileContext, job = {}, now = new Date() }) {
  const jobDocument = [job.title, job.category, job.aiMlArea, job.location, job.listingText].filter(Boolean).join('\n');
  const jobTokens = rankingTokens(jobDocument);
  const titleTokens = rankingTokens(job.title);
  const components = {
    skills: tokenCosine(profileContext.tokens, jobTokens),
    title: tokenCoverage(
      profileContext.targetTitleTokens.size ? profileContext.targetTitleTokens : profileContext.tokens,
      titleTokens,
    ),
    specialization: specializationScore(profileContext, job),
    seniority: seniorityScore(profileContext, job.title),
    workMode: workModeScore(profileContext.remotePreference, `${job.location || ''} ${job.listingText || ''}`),
    freshness: freshnessScore(job.postedAt || job.scrapedAt, now),
  };
  const score = weightedScore(components);

  return {
    score,
    percent: Math.round(score * 100),
    components: roundedComponents(components),
    reasons: matchReasons(components, profileContext),
    modelVersion: JOB_PROFILE_RANKING_MODEL_VERSION,
    profileFingerprint: profileContext.fingerprint,
    jobFingerprint: textFingerprint(jobDocument),
    scoredAt: now.toISOString(),
  };
}

export function rankingTokens(value) {
  const matches = String(value || '')
    .toLowerCase()
    .replace(/c\+\+/g, 'cplusplus')
    .replace(/c#/g, 'csharp')
    .replace(/\.net/g, 'dotnet')
    .match(/[a-z][a-z0-9-]{1,30}/g) || [];
  return new Set(matches.filter((term) => !STOP_WORDS.has(term)));
}

function compareRankedJobs(left, right) {
  if (right.match.score !== left.match.score) return right.match.score - left.match.score;
  const rightDate = Date.parse(right.job.postedAt || right.job.scrapedAt || 0) || 0;
  const leftDate = Date.parse(left.job.postedAt || left.job.scrapedAt || 0) || 0;
  if (rightDate !== leftDate) return rightDate - leftDate;
  return Number(right.job.id || 0) - Number(left.job.id || 0);
}

function weightedScore(components) {
  const score = Object.entries(COMPONENT_WEIGHTS)
    .reduce((total, [component, weight]) => total + components[component] * weight, 0);
  return Number(Math.max(0, Math.min(1, score)).toFixed(6));
}

function roundedComponents(components) {
  return Object.fromEntries(
    Object.entries(components).map(([key, value]) => [key, Number(value.toFixed(4))]),
  );
}

function tokenCosine(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.sqrt(left.size * right.size);
}

function tokenCoverage(profileTokens, jobTitleTokens) {
  if (!profileTokens.size || !jobTitleTokens.size) return 0;
  let matches = 0;
  for (const token of jobTitleTokens) if (profileTokens.has(token)) matches += 1;
  return Math.min(1, matches / jobTitleTokens.size);
}

function specializationScore(profileContext, job) {
  if (!profileContext.specializations.size) return 0.5;
  const jobLabels = [job.category, job.aiMlArea].map(normalizedLabel).filter(Boolean);
  if (jobLabels.some((label) => profileContext.specializations.has(label))) return 1;

  const specializationTokens = rankingTokens([...profileContext.specializations].join(' '));
  const jobTokens = rankingTokens(jobLabels.join(' '));
  return tokenCoverage(specializationTokens, jobTokens);
}

function seniorityScore(profileContext, jobTitle) {
  const jobLevel = seniorityLevel(jobTitle, 2);
  const profileLevel = seniorityLevel(profileContext.targetLevel, 0) || seniorityFromYears(profileContext.yearsOfExperience);
  if (!jobLevel || !profileLevel) return 0.5;
  const difference = Math.abs(jobLevel - profileLevel);
  if (difference === 0) return 1;
  if (difference === 1) return 0.6;
  return 0;
}

function seniorityLevel(value, fallback = 2) {
  const text = String(value || '').toLowerCase();
  return SENIORITY_LEVELS.find((entry) => entry.patterns.some((pattern) => pattern.test(text)))?.level || fallback;
}

function seniorityFromYears(years) {
  if (years === null) return 0;
  if (years < 2) return 1;
  if (years < 5) return 2;
  if (years < 9) return 3;
  return 4;
}

function workModeScore(preference, jobText) {
  if (!preference) return 0.5;
  const normalizedJob = String(jobText || '').toLowerCase();
  const wantsRemote = preference.includes('remote');
  const jobIsRemote = /\bremote\b/.test(normalizedJob);
  const jobIsOnsite = /\b(on[- ]?site|in office)\b/.test(normalizedJob);
  if (wantsRemote && jobIsRemote) return 1;
  if (wantsRemote && jobIsOnsite) return 0;
  return 0.5;
}

function freshnessScore(value, now) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 0.25;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  if (ageDays <= 3) return 1;
  if (ageDays <= 7) return 0.9;
  if (ageDays <= 14) return 0.75;
  if (ageDays <= 30) return 0.5;
  if (ageDays <= 60) return 0.25;
  return 0.1;
}

function matchReasons(components, profileContext) {
  const candidates = [
    { score: components.title, minimum: 0.65, text: 'Target title aligns' },
    { score: components.skills, minimum: 0.2, text: 'Relevant experience and skills overlap' },
    { score: components.specialization, minimum: 0.85, text: 'Specialization matches' },
    { score: components.seniority, minimum: 0.85, text: 'Seniority aligns' },
    { score: components.workMode, minimum: 0.85, text: 'Work preference aligns' },
    { score: components.freshness, minimum: 0.85, text: 'Recently posted' },
  ];
  const reasons = candidates
    .filter((candidate) => candidate.score >= candidate.minimum)
    .sort((left, right) => right.score - left.score)
    .map((candidate) => candidate.text)
    .slice(0, 3);
  if (!profileContext.tokens.size) return ['Add profile details to improve this ranking'];
  return reasons.length ? reasons : ['Potential match based on available profile details'];
}

function numericYears(value) {
  const match = String(value || '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function arrayValues(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function normalizedLabel(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function textFingerprint(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}
