export function readPersistedFilters(storageKey, defaults, keys) {
  if (typeof window === 'undefined') return defaults;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    return mergeKnownFilters(defaults, parsed, keys);
  } catch {
    return defaults;
  }
}

export function writePersistedFilters(storageKey, filters, keys) {
  if (typeof window === 'undefined') return;

  const payload = {};
  keys.forEach((key) => {
    payload[key] = filters[key];
  });
  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function mergeKnownFilters(defaults, overrides, keys) {
  const next = { ...defaults };
  keys.forEach((key) => {
    const value = overrides?.[key];
    if (value !== undefined && value !== null && String(value) !== '') {
      next[key] = key === 'page' || key === 'limit' ? positiveNumber(value, defaults[key]) : normalizeFilterValue(key, value);
    }
  });
  return next;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeFilterValue(key, value) {
  if (key !== 'since') return value;

  const legacyDateFilters = {
    '24h': 'today',
    '3d': 'this_week',
    '7d': 'this_week',
    '30d': 'all',
  };
  return legacyDateFilters[value] || value;
}
