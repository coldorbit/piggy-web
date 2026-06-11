import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: process.env.WORKER_ENV_FILE || join(workerDir, 'worker.env') });
dotenv.config({ path: join(workerDir, '.env') });

validateOptionalUrl('AWS_SQS_ENDPOINT', process.env.AWS_SQS_ENDPOINT);
validateRequiredUrl('TAILORING_QUEUE_URL', process.env.TAILORING_QUEUE_URL);

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TIMEOUT_SECONDS: Number(process.env.OPENAI_TIMEOUT_SECONDS || 300),
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5-mini',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_SQS_ENDPOINT: process.env.AWS_SQS_ENDPOINT,
  TAILORING_QUEUE_URL: process.env.TAILORING_QUEUE_URL,
};

function validateRequiredUrl(name, value) {
  if (!value) {
    throw new Error(`${name} is required for the tailoring worker`);
  }
  validateOptionalUrl(name, value);
}

function validateOptionalUrl(name, value) {
  if (!value) return;
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}
