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

export function readSavedViews(storageKey, defaultViews = []) {
  if (typeof window === 'undefined') return defaultViews;

  try {
    const storedViews = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(storedViews)) return defaultViews;
    return [...defaultViews, ...storedViews.filter(isSavedView)];
  } catch {
    return defaultViews;
  }
}

export function writeSavedViews(storageKey, views = [], defaultViews = []) {
  if (typeof window === 'undefined') return;

  const defaultIds = new Set(defaultViews.map((view) => view.id));
  const userViews = views.filter((view) => isSavedView(view) && !defaultIds.has(view.id));
  window.localStorage.setItem(storageKey, JSON.stringify(userViews));
}

export function createSavedViewId(label) {
  return `${Date.now()}-${String(label || 'view').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'view'}`;
}

function isSavedView(view) {
  return Boolean(view?.id && view?.label && view?.payload && typeof view.payload === 'object');
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
