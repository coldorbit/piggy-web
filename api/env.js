import 'dotenv/config';

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  WEB_PORT: Number(process.env.WEB_PORT || process.env.PORT || 3000),
  WEB_SESSION_SECRET: process.env.WEB_SESSION_SECRET || 'dev-only-change-me',
  WEB_USERS: process.env.WEB_USERS,
  WEB_USERNAME: process.env.WEB_USERNAME,
  WEB_PASSWORD: process.env.WEB_PASSWORD,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL,
  TAILOR_SERVICE_URL: process.env.TAILOR_SERVICE_URL || 'http://resume-tailor:5000',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_SQS_ENDPOINT: process.env.AWS_SQS_ENDPOINT,
  TAILORING_QUEUE_URL: process.env.TAILORING_QUEUE_URL,
};

export function isProduction() {
  return ENV.NODE_ENV === 'production';
}

export function isDevelopment() {
  return ENV.NODE_ENV === 'development';
}
