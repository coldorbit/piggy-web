import { clean } from '../../../utils/index.js';

export const AI_ML_ROLE_CATEGORIES = [
  'ml_engineer',
  'data_scientist',
  'applied_scientist',
  'research_scientist',
  'other_ai_ml',
];

export const AI_ML_AREA_CATEGORIES = [
  'computer_vision',
  'nlp',
  'speech_audio_ml',
  'recommendation_systems',
  'time_series_forecasting',
  'anomaly_fraud_detection',
  'graph_ml',
  'robotics_control',
  'generative_ai',
  'multimodal_ml',
  'tabular_ml',
  'other_ai_ml',
];

const JOB_ROLE_CATEGORIES = new Set(['software', 'data', 'ai_ml', ...AI_ML_ROLE_CATEGORIES]);
const AI_ML_AREA_CATEGORY_SET = new Set(AI_ML_AREA_CATEGORIES);
const AI_ML_ROLE_CATEGORY_SET = new Set(['ai_ml', ...AI_ML_ROLE_CATEGORIES]);
const ROLE_ALIASES = new Map([
  ['software_engineering', 'software'],
  ['software_engineer', 'software'],
  ['data_engineering', 'data'],
  ['data_engineer', 'data'],
  ['machine_learning_engineer', 'ml_engineer'],
  ['machine_learning_engineering', 'ml_engineer'],
]);
const AREA_ALIASES = new Map([
  ['natural_language_processing', 'nlp'],
  ['speech_and_audio_ml', 'speech_audio_ml'],
  ['time_series_and_forecasting', 'time_series_forecasting'],
  ['anomaly_and_fraud_detection', 'anomaly_fraud_detection'],
  ['robotics_and_control', 'robotics_control'],
  ['gen_ai', 'generative_ai'],
  ['other_ai_ml_area', 'other_ai_ml'],
]);

const JOB_ROLE_RULES = [
  { category: 'applied_scientist', patterns: [/\bapplied scientist\b/] },
  {
    category: 'research_scientist',
    patterns: [
      /\bresearch scientist\b/,
      /\b(?:ai|machine learning|deep learning) researcher\b/,
      /\b(?:ai|machine learning|deep learning|computer vision|nlp) research engineer\b/,
    ],
  },
  { category: 'data_scientist', patterns: [/\bdata scientist\b/, /\bdecision scientist\b/] },
  {
    category: 'ml_engineer',
    patterns: [
      /\bmachine learning engineer\b/,
      /\bmachine learning\s*\(ml\)\s*engineer\b/,
      /\bml engineer\b/,
      /\bai engineer\b/,
      /\bartificial intelligence engineer\b/,
      /\bdeep learning engineer\b/,
      /\bcomputer vision engineer\b/,
      /\bnlp engineer\b/,
      /\bmlops engineer\b/,
    ],
  },
  { category: 'data', patterns: [/\bdata engineer\b/, /\banalytics engineer\b/] },
];

const AI_ML_AREA_RULES = [
  {
    area: 'multimodal_ml',
    patterns: [/\bmultimodal\b/, /\bvision[- ]language model\b/, /\bvlm\b/, /\bimage[- ]text\b/, /\bclip model\b/],
  },
  {
    area: 'speech_audio_ml',
    patterns: [
      /\bspeech recognition\b/,
      /\bautomatic speech recognition\b/,
      /\btext[- ]to[- ]speech\b/,
      /\bspeech[- ]to[- ]text\b/,
      /\bvoice ai\b/,
      /\baudio (?:machine learning|ml|modeling|models)\b/,
      /\basr\b/,
      /\btts\b/,
    ],
  },
  {
    area: 'robotics_control',
    patterns: [
      /\brobotics?\b/,
      /\bautonomous (?:vehicle|driving|navigation|system)\b/,
      /\bmotion planning\b/,
      /\breinforcement learning\b/,
      /\bcontrol systems?\b/,
    ],
  },
  {
    area: 'computer_vision',
    patterns: [
      /\bcomputer vision\b/,
      /\bobject detection\b/,
      /\bimage (?:classification|segmentation|recognition|processing)\b/,
      /\bvideo analytics\b/,
      /\bvisual perception\b/,
      /\boptical character recognition\b/,
      /\bocr\b/,
    ],
  },
  {
    area: 'recommendation_systems',
    patterns: [
      /\brecommendation systems?\b/,
      /\brecommender systems?\b/,
      /\bpersonalization (?:model|models|system|systems|algorithm|algorithms)\b/,
      /\blearning to rank\b/,
      /\branking models?\b/,
    ],
  },
  {
    area: 'time_series_forecasting',
    patterns: [
      /\btime[- ]series\b/,
      /\bforecasting\b/,
      /\bdemand forecast\b/,
      /\btemporal model(?:ing|s)?\b/,
    ],
  },
  {
    area: 'anomaly_fraud_detection',
    patterns: [
      /\bfraud detection\b/,
      /\banomaly detection\b/,
      /\boutlier detection\b/,
      /\brisk scoring\b/,
      /\banti[- ]fraud\b/,
    ],
  },
  {
    area: 'graph_ml',
    patterns: [
      /\bgraph neural networks?\b/,
      /\bgraph machine learning\b/,
      /\bknowledge graphs?\b/,
      /\bgraph embeddings?\b/,
      /\bgnn\b/,
    ],
  },
  {
    area: 'generative_ai',
    patterns: [
      /\bgenerative ai\b/,
      /\blarge language models?\b/,
      /\blanguage model(?:ing|s)?\b/,
      /\bllms?\b/,
      /\bretrieval[- ]augmented generation\b/,
      /\brag\b/,
      /\brag pipeline\b/,
      /\bagentic ai\b/,
      /\bai agents?\b/,
      /\bprompt engineer(?:ing)?\b/,
      /\bprompt optimization\b/,
      /\bfoundation models?\b/,
      /\bdiffusion models?\b/,
      /\bvector databases?\b/,
      /\bgpt-?\d*\b/,
    ],
  },
  {
    area: 'nlp',
    patterns: [
      /\bnatural language processing\b/,
      /\bcomputational linguistics\b/,
      /\btext classification\b/,
      /\bnamed entity recognition\b/,
      /\binformation extraction\b/,
      /\bsentiment analysis\b/,
      /\bnlp\b/,
      /\bner\b/,
    ],
  },
  {
    area: 'tabular_ml',
    patterns: [
      /\btabular (?:data|machine learning|ml|models?)\b/,
      /\bxgboost\b/,
      /\blightgbm\b/,
      /\bcatboost\b/,
      /\bgradient[- ]boosted trees?\b/,
      /\brandom forests?\b/,
    ],
  },
];

const GENERAL_AI_ML_PATTERNS = [
  /\bartificial intelligence\b/,
  /\bmachine learning\b/,
  /\bdeep learning\b/,
  /\bneural networks?\b/,
  /\bpredictive model(?:ing|s)?\b/,
  /\bai\b/,
  /\bml\b/,
];

export function normalizeJobCategory(value) {
  const normalized = normalizeClassificationValue(value);
  if (!normalized || normalized === 'all') return '';
  if (JOB_ROLE_CATEGORIES.has(normalized)) return normalized;
  if (['ai', 'ml', 'aiml'].includes(normalized)) return 'ai_ml';
  if (normalized.includes('data')) return 'data';
  return ROLE_ALIASES.get(normalized) || '';
}

export function normalizeAiMlArea(value) {
  const normalized = normalizeClassificationValue(value);
  if (!normalized || normalized === 'all') return '';
  if (AI_ML_AREA_CATEGORY_SET.has(normalized)) return normalized;
  return AREA_ALIASES.get(normalized) || '';
}

export function classifyJob({ title, listingText, category, aiMlArea } = {}) {
  const normalizedCategory = normalizeJobCategory(category) || inferJobCategory(title);
  const normalizedArea = isAiMlJobCategory(normalizedCategory)
    ? normalizeAiMlArea(aiMlArea) || inferAiMlArea({ title, listingText, category: normalizedCategory })
    : '';

  return {
    category: normalizedCategory || 'software',
    aiMlArea: normalizedArea || null,
  };
}

export function isAiMlJobCategory(value) {
  return AI_ML_ROLE_CATEGORY_SET.has(normalizeJobCategory(value));
}

export function inferJobCategory(title) {
  const normalizedTitle = classificationText(title);
  const matchedRule = JOB_ROLE_RULES.find((rule) => matchesAny(normalizedTitle, rule.patterns));
  if (matchedRule) return matchedRule.category;
  if (AI_ML_AREA_RULES.some((rule) => matchesAny(normalizedTitle, rule.patterns))) return 'other_ai_ml';
  if (matchesAny(normalizedTitle, GENERAL_AI_ML_PATTERNS)) return 'other_ai_ml';
  return 'software';
}

export function inferAiMlArea({ title, listingText, category } = {}) {
  const roleCategory = normalizeJobCategory(category) || inferJobCategory(title);
  if (!isAiMlJobCategory(roleCategory)) return '';

  const titleText = classificationText(title);
  const titleRule = AI_ML_AREA_RULES.find((rule) => matchesAny(titleText, rule.patterns));
  if (titleRule) return titleRule.area;

  const listingTextValue = classificationText(listingText);
  const matchedRule = AI_ML_AREA_RULES.find((rule) => matchesAny(listingTextValue, rule.patterns));
  if (matchedRule) return matchedRule.area;
  if (
    isAiMlJobCategory(roleCategory)
    || matchesAny(`${titleText} ${listingTextValue}`, GENERAL_AI_ML_PATTERNS)
  ) {
    return 'other_ai_ml';
  }
  return '';
}

function normalizeClassificationValue(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function classificationText(value) {
  return clean(String(value || '').slice(0, 50_000))
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ');
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}
