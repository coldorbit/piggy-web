import { S3Client } from '@aws-sdk/client-s3';

export function r2ClientOptions(config) {
  return {
    region: config.R2_REGION || 'auto',
    endpoint: String(config.R2_ENDPOINT || '').replace(/\/+$/, ''),
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  };
}

export function missingR2Configuration(config) {
  return [
    ['R2_ENDPOINT', config.R2_ENDPOINT],
    ['R2_ACCESS_KEY_ID', config.R2_ACCESS_KEY_ID],
    ['R2_SECRET_ACCESS_KEY', config.R2_SECRET_ACCESS_KEY],
    ['R2_BUCKET', config.R2_BUCKET],
  ].filter(([, value]) => !String(value || '').trim()).map(([name]) => name);
}

export function createR2Client(config) {
  return new S3Client(r2ClientOptions(config));
}
