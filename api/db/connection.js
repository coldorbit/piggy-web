import { Sequelize } from 'sequelize';

let sequelize;

export function getSequelize() {
  if (!sequelize) {
    const databaseUrl = requiredDatabaseUrl('web app');

    sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false,
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
  }

  return sequelize;
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

function booleanEnv(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').toLowerCase());
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
