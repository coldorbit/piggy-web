import 'dotenv/config';

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
