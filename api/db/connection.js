import { Sequelize } from 'sequelize';
import { createExplainAnalyzeProfiler } from './queryProfiler.js';

let sequelize;
let queryProfiler;
const DEFAULT_SLOW_QUERY_MS = 250;

export function getSequelize() {
  if (!sequelize) {
    const databaseUrl = requiredDatabaseUrl('web app');

    sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      benchmark: true,
      logging: logQuery,
      timezone: '+00:00',
      dialectOptions: databaseDialectOptions(),
      hooks: {
        afterConnect: setUtcSessionTimezone,
      },
      pool: {
        max: numberEnv('DATABASE_POOL_MAX', 5),
        min: numberEnv('DATABASE_POOL_MIN', 0),
        acquire: numberEnv('DATABASE_POOL_ACQUIRE_MS', 30000),
        idle: numberEnv('DATABASE_POOL_IDLE_MS', 10000),
      },
    });
    queryProfiler = createExplainAnalyzeProfiler({
      getSequelize: () => sequelize,
      enabled: explainAnalyzeEnabled(),
      minimumDurationMs: nonNegativeNumberEnv('DATABASE_EXPLAIN_MIN_MS', 0),
      explainOnce: booleanEnv('DATABASE_EXPLAIN_ONCE', true),
      maxQueueSize: numberEnv('DATABASE_EXPLAIN_QUEUE_MAX', 100),
      output: String(process.env.DATABASE_EXPLAIN_OUTPUT || 'summary').toLowerCase(),
    });
  }

  return sequelize;
}

function logQuery(sql, durationMs) {
  logSlowQuery(sql, durationMs);
  queryProfiler?.capture(sql, durationMs);
}

function logSlowQuery(sql, durationMs) {
  const threshold = numberEnv('DATABASE_SLOW_QUERY_MS', DEFAULT_SLOW_QUERY_MS);
  if (!Number.isFinite(durationMs) || durationMs < threshold) return;
  const summary = String(sql).replace(/\s+/g, ' ').slice(0, 500);
  console.warn(`Slow SQL ${durationMs.toFixed(1)}ms ${summary}`);
}

async function setUtcSessionTimezone(connection) {
  await connection.query("SET TIME ZONE 'UTC'");
}

function requiredDatabaseUrl(serviceName) {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(`DATABASE_URL is required for the ${serviceName}`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid postgres:// or postgresql:// URL');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must start with postgres:// or postgresql://');
  }

  return value;
}

function databaseDialectOptions() {
  const options = {
    connectionTimeoutMillis: numberEnv('DATABASE_CONNECT_TIMEOUT_MS', 10000),
  };

  if (booleanEnv('DATABASE_SSL')) {
    options.ssl = {
      require: true,
      rejectUnauthorized: booleanEnv('DATABASE_SSL_REJECT_UNAUTHORIZED'),
    };
  }

  return options;
}

function booleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function explainAnalyzeEnabled() {
  if (!booleanEnv('DATABASE_EXPLAIN_ANALYZE')) return false;
  return process.env.NODE_ENV !== 'production' || booleanEnv('DATABASE_EXPLAIN_ALLOW_PRODUCTION');
}
