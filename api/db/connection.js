import { Sequelize } from 'sequelize';

let sequelize;

export function getSequelize() {
  if (!sequelize) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for the web app');
    }

    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: databaseDialectOptions(),
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
