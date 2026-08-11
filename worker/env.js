import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: process.env.WORKER_ENV_FILE || join(workerDir, 'worker.env') });
dotenv.config({ path: join(workerDir, '.env') });

validateRequiredRabbitMqUrl('RABBITMQ_URL', process.env.RABBITMQ_URL);
validateOptionalUrl('R2_ENDPOINT', process.env.R2_ENDPOINT);

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TIMEOUT_SECONDS: Number(process.env.OPENAI_TIMEOUT_SECONDS || 300),
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5-mini',
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_REGION: process.env.R2_REGION || 'auto',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  // R2 bucket names can safely reuse the legacy S3 bucket setting during a
  // rolling migration of worker env files.
  R2_BUCKET: process.env.R2_BUCKET || process.env.AWS_S3_BUCKET,
  RABBITMQ_URL: process.env.RABBITMQ_URL,
  TAILORING_QUEUE_NAME: process.env.TAILORING_QUEUE_NAME || 'applypilot.tailoring',
};

function validateRequiredUrl(name, value) {
  if (!value) {
    throw new Error(`${name} is required for the tailoring worker`);
  }
  validateOptionalUrl(name, value);
}

function validateRequiredRabbitMqUrl(name, value) {
  validateRequiredUrl(name, value);
  const protocol = new URL(value).protocol;
  if (!['amqp:', 'amqps:'].includes(protocol)) {
    throw new Error(`${name} must use the amqp or amqps protocol`);
  }
}

function validateOptionalUrl(name, value) {
  if (!value) return;
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}
