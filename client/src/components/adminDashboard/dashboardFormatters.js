export const GRAIN_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export const CHART_COLORS = ['#0067C0', '#486860', '#C42B1C', '#7C3AED', '#C77700', '#0891B2', '#4F46E5', '#BE123C'];

export function number(value) {
  return Number(value || 0).toLocaleString();
}

export function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export function decimal(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function labelForGrain(value) {
  return GRAIN_OPTIONS.find((option) => option.value === value)?.label || 'Daily';
}

export function labelize(value) {
  return String(value || 'Unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
