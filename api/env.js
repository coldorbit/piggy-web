import 'dotenv/config';

validateOptionalUrl('AWS_SQS_ENDPOINT', process.env.AWS_SQS_ENDPOINT);
validateOptionalUrl('TAILORING_QUEUE_URL', process.env.TAILORING_QUEUE_URL);

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  WEB_PORT: Number(process.env.WEB_PORT || process.env.PORT || 3000),
  WEB_SESSION_SECRET: process.env.WEB_SESSION_SECRET || 'dev-only-change-me',
  WEB_USERS: process.env.WEB_USERS,
  WEB_USERNAME: process.env.WEB_USERNAME,
  WEB_PASSWORD: process.env.WEB_PASSWORD,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TIMEOUT_SECONDS: Number(process.env.OPENAI_TIMEOUT_SECONDS || 300),
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5-mini',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_SQS_ENDPOINT: process.env.AWS_SQS_ENDPOINT,
  TAILORING_QUEUE_URL: process.env.TAILORING_QUEUE_URL,
  MAILBOX_EMAIL: process.env.MAILBOX_EMAIL,
  MAILBOX_PASSWORD: process.env.MAILBOX_PASSWORD,
  MAILBOX_IMAP_HOST: process.env.MAILBOX_IMAP_HOST || 'mail.privateemail.com',
  MAILBOX_IMAP_PORT: process.env.MAILBOX_IMAP_PORT || '993',
  MAILBOX_IMAP_SECURE: process.env.MAILBOX_IMAP_SECURE || 'true',
  MAILBOX_SYNC_ENABLED: process.env.MAILBOX_SYNC_ENABLED || 'true',
  MAILBOX_SYNC_INTERVAL_MS: process.env.MAILBOX_SYNC_INTERVAL_MS || '300000',
  MAILBOX_SYNC_MESSAGE_LIMIT: process.env.MAILBOX_SYNC_MESSAGE_LIMIT || '100',
};

export function isProduction() {
  return ENV.NODE_ENV === 'production';
}

export function isDevelopment() {
  return ENV.NODE_ENV === 'development';
}

function validateOptionalUrl(name, value) {
  if (!value) return;
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}
