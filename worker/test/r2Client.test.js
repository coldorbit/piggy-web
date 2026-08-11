import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { missingR2Configuration, r2ClientOptions } from '../storage/r2Client.js';

process.env.RABBITMQ_URL ||= 'amqp://rabbitmq.test';

const { uploadResumeToR2 } = await import('../tailoringGeneratorService.js');

describe('Cloudflare R2 client configuration', () => {
  it('uses the account endpoint, auto region, and explicit R2 credentials', () => {
    assert.deepEqual(r2ClientOptions({
      R2_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com/',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
    }), {
      region: 'auto',
      endpoint: 'https://account-id.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
      },
    });
  });

  it('reports every missing required storage value', () => {
    assert.deepEqual(missingR2Configuration({}), [
      'R2_ENDPOINT',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET',
    ]);
  });

  it('accepts the legacy bucket variable during an R2 env migration', () => {
    assert.deepEqual(missingR2Configuration({
      R2_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      AWS_S3_BUCKET: 'resumes',
    }), []);
  });

  it('uploads a persistent object and verifies it with a head request', async () => {
    const commands = [];
    const client = {
      async send(command) {
        commands.push(command);
        return commands.length === 2 ? { ContentLength: 4, ETag: '"etag-value"' } : {};
      },
    };

    const result = await uploadResumeToR2(
      Buffer.from('docx'),
      'Profile/20260810/resume.docx',
      'resume.docx',
      { client, bucket: 'resumes' },
    );

    assert.equal(commands[0].constructor.name, 'PutObjectCommand');
    assert.deepEqual(commands[0].input, {
      Bucket: 'resumes',
      Key: 'Profile/20260810/resume.docx',
      Body: Buffer.from('docx'),
      ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ContentDisposition: 'attachment; filename="resume.docx"',
    });
    assert.equal(commands[1].constructor.name, 'HeadObjectCommand');
    assert.deepEqual(commands[1].input, {
      Bucket: 'resumes',
      Key: 'Profile/20260810/resume.docx',
    });
    assert.deepEqual(result, {
      bucket: 'resumes',
      key: 'Profile/20260810/resume.docx',
      uri: 'r2://resumes/Profile/20260810/resume.docx',
      size: 4,
      etag: 'etag-value',
    });
  });
});
