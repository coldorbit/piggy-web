export const AI_ML_ROLE_CATEGORIES = [
  'ml_engineer',
  'data_scientist',
  'applied_scientist',
  'research_scientist',
  'other_ai_ml',
];

export const JOB_ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'software', label: 'Software engineering' },
  { value: 'data', label: 'Data engineering' },
  { value: 'ai_ml', label: 'All AI/ML roles' },
  { value: 'ml_engineer', label: 'ML engineer' },
  { value: 'data_scientist', label: 'Data scientist' },
  { value: 'applied_scientist', label: 'Applied scientist' },
  { value: 'research_scientist', label: 'Research scientist' },
  { value: 'other_ai_ml', label: 'Other AI/ML' },
];

export const AI_ML_AREA_OPTIONS = [
  { value: 'all', label: 'All AI/ML areas' },
  { value: 'computer_vision', label: 'Computer vision' },
  { value: 'nlp', label: 'Natural language processing' },
  { value: 'speech_audio_ml', label: 'Speech & audio ML' },
  { value: 'recommendation_systems', label: 'Recommendation systems' },
  { value: 'time_series_forecasting', label: 'Time series & forecasting' },
  { value: 'anomaly_fraud_detection', label: 'Anomaly & fraud detection' },
  { value: 'graph_ml', label: 'Graph ML' },
  { value: 'robotics_control', label: 'Robotics & control' },
  { value: 'generative_ai', label: 'Generative AI' },
  { value: 'multimodal_ml', label: 'Multimodal ML' },
  { value: 'tabular_ml', label: 'Tabular ML' },
  { value: 'other_ai_ml', label: 'Other AI/ML area' },
];

const AI_ML_ROLE_CATEGORY_SET = new Set(['ai_ml', ...AI_ML_ROLE_CATEGORIES]);

export function matchesJobRole(job, roleFamily = 'all') {
  if (!roleFamily || roleFamily === 'all') return true;
  if (roleFamily === 'ai_ml') return AI_ML_ROLE_CATEGORY_SET.has(job?.category);
  return job?.category === roleFamily;
}

export function matchesAiMlArea(job, aiMlArea = 'all') {
  return !aiMlArea || aiMlArea === 'all' || job?.aiMlArea === aiMlArea;
}
