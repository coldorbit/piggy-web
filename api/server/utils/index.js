import { InputError } from './errors.js';

export function clean(value) {
  return String(value || '').trim();
}

export function parseJsonArray(value, label) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];

  let parsed;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    throw new InputError(`${label} must be valid JSON`);
  }
  if (!Array.isArray(parsed)) throw new InputError(`${label} must be a JSON array`);
  return parsed;
}
