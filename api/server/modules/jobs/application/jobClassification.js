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
const ROLE_ALIASES = new Map([
  ['software_engineering', 'software'],
  ['software_engineer', 'software'],
  ['data_engineering', 'data'],
  ['data_engineer', 'data'],
  ['machine_learning_engineer', 'ml_engineer'],
  ['machine_learning_engineering', 'ml_engineer'],
]);

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
  return AI_ML_AREA_CATEGORY_SET.has(normalized) ? normalized : '';
}

function normalizeClassificationValue(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
