import { InputError } from '../../../utils/errors.js';
import { clean } from '../../../utils/index.js';

export const STAFF_ML_COMPETENCIES = [
  'technicalStrategy',
  'mlSystemDesign',
  'modelingAndExperimentation',
  'productionReliability',
  'responsibleAi',
  'productJudgment',
  'crossFunctionalInfluence',
  'executionAndLearning',
];

export const STAFF_ML_PLAYBOOK = {
  id: 'staff-ml-engineer',
  title: 'Staff+ Machine Learning Engineer Interview Playbook',
  description: 'A practical preparation loop for Staff, Senior Staff, and Principal ML engineering roles.',
  rubricScale: [
    { value: 0, label: 'Not assessed' },
    { value: 1, label: 'Needs evidence' },
    { value: 2, label: 'Interview ready' },
    { value: 3, label: 'Signature strength' },
  ],
  modules: [
    {
      id: 'technical-strategy',
      title: 'Technical strategy and scope',
      competency: 'technicalStrategy',
      summary: 'Show how you turn ambiguous company goals into a multi-team technical direction.',
      questions: [
        'Describe a multi-quarter ML strategy you created and how you earned commitment.',
        'How do you decide whether a problem needs ML at all?',
        'Which decision created leverage beyond your immediate team?',
      ],
      strongSignals: ['Clear business constraint', 'Alternatives and trade-offs', 'Multi-team influence', 'Measured organizational impact'],
    },
    {
      id: 'ml-system-design',
      title: 'ML system design',
      competency: 'mlSystemDesign',
      summary: 'Design the complete learning system, including data, training, serving, feedback, and failure modes.',
      questions: [
        'Design a recommendation, ranking, fraud, forecasting, or retrieval system at production scale.',
        'Define offline and online metrics and explain when they can disagree.',
        'How would the design change under a 50 ms latency or strict cost constraint?',
      ],
      strongSignals: ['Requirements first', 'Data and label quality', 'Baseline before complexity', 'Observability and rollback'],
    },
    {
      id: 'modeling-experimentation',
      title: 'Modeling and experimentation',
      competency: 'modelingAndExperimentation',
      summary: 'Demonstrate statistical judgment and disciplined iteration rather than model-name recall.',
      questions: [
        'How did you select the baseline, objective, and evaluation slices?',
        'Explain an experiment whose offline gain did not produce an online improvement.',
        'How do you detect leakage, selection bias, or feedback loops?',
      ],
      strongSignals: ['Explicit hypotheses', 'Segment-level evaluation', 'Uncertainty awareness', 'Decision-focused experiments'],
    },
    {
      id: 'production-reliability',
      title: 'Production reliability and operations',
      competency: 'productionReliability',
      summary: 'Treat models as operating systems with freshness, cost, reliability, and incident responsibilities.',
      questions: [
        'How do you monitor data quality, drift, model quality, latency, and cost?',
        'Walk through an ML incident and the systemic changes that followed.',
        'When should retraining be scheduled, event-driven, or manually approved?',
      ],
      strongSignals: ['Layered SLOs', 'Safe fallback', 'Root-cause depth', 'Learning applied across teams'],
    },
    {
      id: 'responsible-ai',
      title: 'Responsible AI and risk',
      competency: 'responsibleAi',
      summary: 'Identify who can be harmed, how risks are measured, and which controls belong in the lifecycle.',
      questions: [
        'What harms and abuse cases exist for this system?',
        'How do privacy, fairness, explainability, and safety requirements change the design?',
        'When would you block or reverse a launch?',
      ],
      strongSignals: ['Concrete stakeholders', 'Pre-launch controls', 'Ongoing monitoring', 'Clear escalation thresholds'],
    },
    {
      id: 'leadership-product',
      title: 'Product judgment and influence',
      competency: 'crossFunctionalInfluence',
      summary: 'Show influence without authority and a direct connection between technical choices and customer outcomes.',
      questions: [
        'Describe a disagreement with product, research, legal, or infrastructure leaders.',
        'How did you change an organization-wide engineering practice?',
        'How do you communicate uncertainty to executives?',
      ],
      strongSignals: ['Stakeholder empathy', 'Decision mechanism', 'Durable alignment', 'Outcome rather than activity'],
    },
  ],
  dayOfChecklist: [
    'Confirm interview time, timezone, duration, and meeting link.',
    'Open the submitted resume and exact job description.',
    'Choose two verified stories for each likely competency.',
    'Prepare a requirements-first ML system design structure.',
    'Prepare questions about scope, decision authority, data maturity, and success measures.',
    'Test audio, camera, screen sharing, and diagramming tools.',
  ],
};

const TARGET_LEVELS = new Set(['', 'senior', 'staff', 'senior_staff', 'principal', 'distinguished']);
const REMOTE_PREFERENCES = new Set(['', 'remote', 'hybrid', 'onsite', 'flexible']);
const RELOCATION_PREFERENCES = new Set(['', 'not_open', 'open', 'case_by_case', 'already_relocating']);
const STORY_STATUSES = new Set(['draft', 'verified']);
const PREP_STATUSES = new Set(['draft', 'in_progress', 'ready']);

export function profileIntelligenceAttributesFromBody(body = {}, current = {}) {
  const targetLevel = clean(body.targetLevel ?? current.targetLevel).toLowerCase();
  const remotePreference = clean(body.remotePreference ?? current.remotePreference).toLowerCase();
  const relocationPreference = clean(body.relocationPreference ?? current.relocationPreference).toLowerCase();
  const timezone = clean(body.timezone ?? current.timezone);

  if (!TARGET_LEVELS.has(targetLevel)) throw new InputError('Choose a valid target level');
  if (!REMOTE_PREFERENCES.has(remotePreference)) throw new InputError('Choose a valid work-location preference');
  if (!RELOCATION_PREFERENCES.has(relocationPreference)) throw new InputError('Choose a valid relocation preference');
  if (timezone && !isValidTimezone(timezone)) throw new InputError('Choose a valid IANA timezone, such as America/Los_Angeles');

  return {
    targetLevel: targetLevel || null,
    targetTitles: stringList(body.targetTitles ?? current.targetTitles, 'Target titles', 12),
    specializations: stringList(body.specializations ?? current.specializations, 'Specializations', 16),
    professionalSummary: nullableText(body.professionalSummary ?? current.professionalSummary, 5000),
    workAuthorization: nullableText(body.workAuthorization ?? current.workAuthorization, 500),
    remotePreference: remotePreference || null,
    relocationPreference: relocationPreference || null,
    city: nullableText(body.city ?? current.city, 180),
    region: nullableText(body.region ?? current.region, 180),
    countryCode: countryCode(body.countryCode ?? current.countryCode),
    postalCode: nullableText(body.postalCode ?? current.postalCode, 32),
    timezone: timezone || null,
    regionalContextNotes: nullableText(body.regionalContextNotes ?? current.regionalContextNotes, 8000),
    regionalContextSources: sourceList(body.regionalContextSources ?? current.regionalContextSources),
  };
}

export function profileStoryAttributesFromBody(body = {}, current = {}) {
  const title = clean(body.title ?? current.title);
  const verificationStatus = clean(body.verificationStatus ?? current.verificationStatus ?? 'draft').toLowerCase();
  if (!title) throw new InputError('Story title is required');
  if (title.length > 220) throw new InputError('Story title must be 220 characters or fewer');
  if (!STORY_STATUSES.has(verificationStatus)) throw new InputError('Story status must be draft or verified');
  return {
    title,
    situation: nullableText(body.situation ?? current.situation, 8000),
    responsibility: nullableText(body.responsibility ?? current.responsibility, 8000),
    actions: nullableText(body.actions ?? current.actions, 12000),
    result: nullableText(body.result ?? current.result, 8000),
    metrics: nullableText(body.metrics ?? current.metrics, 3000),
    lessons: nullableText(body.lessons ?? current.lessons, 8000),
    competencies: stringList(body.competencies ?? current.competencies, 'Competencies', 16),
    verificationStatus,
  };
}

export function profilePrepAttributesFromBody(body = {}, current = {}) {
  const status = clean(body.status ?? current.status ?? 'draft').toLowerCase();
  if (!PREP_STATUSES.has(status)) throw new InputError('Preparation status must be draft, in progress, or ready');
  const competencyScores = { ...(current.competencyScores || {}) };
  for (const [key, rawValue] of Object.entries(body.competencyScores || {})) {
    if (!STAFF_ML_COMPETENCIES.includes(key)) continue;
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0 || value > 3) throw new InputError('Readiness scores must be whole numbers from 0 to 3');
    competencyScores[key] = value;
  }
  return {
    status,
    competencyScores,
    focusAreas: stringList(body.focusAreas ?? current.focusAreas, 'Focus areas', 20),
    notes: nullableText(body.notes ?? current.notes, 10000),
    nextMockAt: dateOrNull(body.nextMockAt ?? current.nextMockAt, 'Next mock interview'),
  };
}

export function readinessForProfile({ intelligence = {}, stories = [], prepPlan = {} } = {}) {
  const overviewChecks = [intelligence.targetLevel, intelligence.professionalSummary, intelligence.targetTitles?.length, intelligence.specializations?.length];
  const locationChecks = [intelligence.city, intelligence.region, intelligence.countryCode, intelligence.timezone];
  const verifiedStories = stories.filter((story) => story.verificationStatus === 'verified');
  const scoredCompetencies = STAFF_ML_COMPETENCIES.filter((key) => Number(prepPlan.competencyScores?.[key] || 0) >= 2);
  const sections = [
    { id: 'overview', label: 'Profile narrative', complete: completed(overviewChecks), total: overviewChecks.length },
    { id: 'location', label: 'Location context', complete: completed(locationChecks), total: locationChecks.length },
    { id: 'stories', label: 'Verified stories', complete: Math.min(verifiedStories.length, 4), total: 4 },
    { id: 'competencies', label: 'Interview-ready competencies', complete: scoredCompetencies.length, total: STAFF_ML_COMPETENCIES.length },
  ];
  const complete = sections.reduce((sum, section) => sum + section.complete, 0);
  const total = sections.reduce((sum, section) => sum + section.total, 0);
  return { percent: total ? Math.round((complete / total) * 100) : 0, sections, verifiedStoryCount: verifiedStories.length };
}

export async function geocodeUsResidentAddress(address, { fetchImpl = fetch } = {}) {
  const value = clean(address);
  if (value.length < 8) throw new InputError('Enter a complete U.S. street address');
  if (value.length > 500) throw new InputError('Address is too long');
  const params = new URLSearchParams({
    address: value,
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    format: 'json',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let response;
  try {
    response = await fetchImpl(`https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?${params}`, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'ApplyPilot/1.0 profile-location-verification' },
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Address lookup timed out');
    throw new Error('Address lookup service is unavailable');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error('Address lookup service returned an error');
  const data = await response.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match) throw new InputError('The address could not be matched. Check the street, city, state, and ZIP code.');
  const latitude = Number(match.coordinates?.y);
  const longitude = Number(match.coordinates?.x);
  const components = match.addressComponents || {};
  return {
    matchedAddress: clean(match.matchedAddress),
    city: clean(components.city),
    region: clean(components.state).toUpperCase(),
    postalCode: clean(components.zip),
    countryCode: 'US',
    coarseLatitude: Number.isFinite(latitude) ? roundCoordinate(latitude) : null,
    coarseLongitude: Number.isFinite(longitude) ? roundCoordinate(longitude) : null,
    locationProvider: 'US Census Geocoder',
    locationConfidence: clean(match.matchedAddress) ? 'matched' : 'approximate',
    locationVerifiedAt: new Date(),
  };
}

export function formatProfileIntelligence(row) {
  if (!row) return emptyProfileIntelligence();
  return {
    id: row.id,
    profileId: row.profileId,
    targetLevel: row.targetLevel || '',
    targetTitles: row.targetTitles || [],
    specializations: row.specializations || [],
    professionalSummary: row.professionalSummary || '',
    workAuthorization: row.workAuthorization || '',
    remotePreference: row.remotePreference || '',
    relocationPreference: row.relocationPreference || '',
    city: row.city || '',
    region: row.region || '',
    countryCode: row.countryCode || '',
    postalCode: row.postalCode || '',
    timezone: row.timezone || '',
    coarseLatitude: row.coarseLatitude ?? null,
    coarseLongitude: row.coarseLongitude ?? null,
    locationProvider: row.locationProvider || '',
    locationConfidence: row.locationConfidence || '',
    locationVerifiedAt: row.locationVerifiedAt || null,
    regionalContextNotes: row.regionalContextNotes || '',
    regionalContextSources: row.regionalContextSources || [],
    updatedAt: row.updatedAt || null,
  };
}

export function formatProfileStory(row) {
  return {
    id: row.id,
    profileId: row.profileId,
    title: row.title,
    situation: row.situation || '',
    responsibility: row.responsibility || '',
    actions: row.actions || '',
    result: row.result || '',
    metrics: row.metrics || '',
    lessons: row.lessons || '',
    competencies: row.competencies || [],
    verificationStatus: row.verificationStatus || 'draft',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function formatProfilePrepPlan(row) {
  return {
    id: row?.id || null,
    profileId: row?.profileId || null,
    status: row?.status || 'draft',
    competencyScores: row?.competencyScores || {},
    focusAreas: row?.focusAreas || [],
    notes: row?.notes || '',
    nextMockAt: row?.nextMockAt || null,
    updatedAt: row?.updatedAt || null,
  };
}

function emptyProfileIntelligence() {
  return {
    id: null,
    profileId: null,
    targetLevel: '',
    targetTitles: [],
    specializations: [],
    professionalSummary: '',
    workAuthorization: '',
    remotePreference: '',
    relocationPreference: '',
    city: '',
    region: '',
    countryCode: '',
    postalCode: '',
    timezone: '',
    coarseLatitude: null,
    coarseLongitude: null,
    locationProvider: '',
    locationConfidence: '',
    locationVerifiedAt: null,
    regionalContextNotes: '',
    regionalContextSources: [],
    updatedAt: null,
  };
}

function stringList(value, label, maxItems) {
  const values = Array.isArray(value) ? value : clean(value).split(',');
  const unique = [...new Set(values.map((item) => clean(item)).filter(Boolean))];
  if (unique.length > maxItems) throw new InputError(`${label} can contain at most ${maxItems} items`);
  if (unique.some((item) => item.length > 180)) throw new InputError(`${label} items must be 180 characters or fewer`);
  return unique;
}

function sourceList(value) {
  const values = Array.isArray(value) ? value : clean(value).split(/\r?\n/);
  const sources = values.map((source) => {
    if (typeof source === 'string') return { label: source, url: source };
    return { label: clean(source?.label || source?.url), url: clean(source?.url) };
  }).filter((source) => source.url);
  if (sources.length > 12) throw new InputError('Regional context can have at most 12 sources');
  for (const source of sources) {
    try {
      const url = new URL(source.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new InputError('Regional context sources must be valid HTTP or HTTPS URLs');
    }
  }
  return sources;
}

function countryCode(value) {
  const code = clean(value).toUpperCase();
  if (code && !/^[A-Z]{2}$/.test(code)) throw new InputError('Country code must use two letters, such as US');
  return code || null;
}

function nullableText(value, maxLength) {
  const text = clean(value);
  if (text.length > maxLength) throw new InputError(`Text must be ${maxLength.toLocaleString()} characters or fewer`);
  return text || null;
}

function dateOrNull(value, label) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new InputError(`${label} must be a valid date`);
  return date;
}

function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function completed(checks) {
  return checks.filter(Boolean).length;
}

function roundCoordinate(value) {
  return Math.round(value * 100) / 100;
}
