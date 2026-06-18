const truthyFlagValues = new Set(['1', 'true', 'yes', 'on', 'enabled']);

export const FEATURE_FLAGS = Object.freeze({
  maintenanceMode: Object.freeze({
    key: import.meta.env.VITE_GROWTHBOOK_MAINTENANCE_FLAG || 'maintenance-mode',
    fallbackEnv: 'VITE_LOCAL_MAINTENANCE_MODE',
  }),
});

export function getGrowthBookConfig() {
  const apiHost = normalizeUrl(import.meta.env.VITE_GROWTHBOOK_API_HOST);
  const clientKey = import.meta.env.VITE_GROWTHBOOK_CLIENT_KEY;

  if (!apiHost || !clientKey) return null;

  return {
    apiHost,
    clientKey,
    decryptionKey: import.meta.env.VITE_GROWTHBOOK_DECRYPTION_KEY || undefined,
    enableDevMode: parseFlagValue(import.meta.env.VITE_GROWTHBOOK_DEV_MODE),
    subscribeToChanges: parseFlagValue(import.meta.env.VITE_GROWTHBOOK_SUBSCRIBE_TO_CHANGES),
    attributes: {
      environment: import.meta.env.VITE_GROWTHBOOK_ENVIRONMENT || 'development',
    },
  };
}

export function getGrowthBookInitOptions() {
  return {
    timeout: Number(import.meta.env.VITE_GROWTHBOOK_INIT_TIMEOUT_MS || 2000),
  };
}

export function hasGrowthBookConfig() {
  return Boolean(getGrowthBookConfig());
}

export function isLocalMaintenanceModeEnabled() {
  return parseFlagValue(import.meta.env[FEATURE_FLAGS.maintenanceMode.fallbackEnv]);
}

function parseFlagValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;

  return truthyFlagValues.has(value.trim().toLowerCase());
}

function normalizeUrl(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/$/, '');
}
