import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fetchTailoredResumeFromR2,
  getConfiguredR2Details,
  getExplicitR2Details,
  getTailoredResumeStorageCandidates,
} from '../server/modules/bidding/presentation/biddingApplicationsController.js';
import { missingR2Configuration, r2ClientOptions } from '../server/utils/r2Client.js';

describe('Cloudflare R2 storage configuration', () => {
  it('builds an SDK configuration using the R2 endpoint and credentials', () => {
    assert.deepEqual(r2ClientOptions({
      R2_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com/',
      R2_REGION: 'auto',
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

  it('reports incomplete R2 configuration', () => {
    assert.deepEqual(missingR2Configuration({ R2_BUCKET: 'resumes' }), [
      'R2_ENDPOINT',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ]);
  });

  it('resolves R2 URIs and migrated legacy object paths', () => {
    assert.deepEqual(getExplicitR2Details('r2://resumes/Profile/resume.docx'), {
      bucket: 'resumes',
      key: 'Profile/resume.docx',
    });
    assert.deepEqual(getConfiguredR2Details('s3://old-bucket/Profile/resume.docx', 'resumes'), [{
      bucket: 'resumes',
      key: 'Profile/resume.docx',
    }]);
    assert.deepEqual(getConfiguredR2Details('Profile/resume.docx', 'resumes'), [{
      bucket: 'resumes',
      key: 'Profile/resume.docx',
    }]);
  });

  it('maps legacy S3 locations directly into the configured R2 bucket', () => {
    assert.deepEqual(
      getTailoredResumeStorageCandidates('s3://old-bucket/Profile/resume.docx', 'resumes'),
      [{ bucket: 'resumes', key: 'Profile/resume.docx' }],
    );
    assert.deepEqual(
      getTailoredResumeStorageCandidates(
        'https://old-bucket.s3.us-east-1.amazonaws.com/Profile/resume.docx',
        'resumes',
      ),
      [{ bucket: 'resumes', key: 'Profile/resume.docx' }],
    );
    assert.deepEqual(
      getTailoredResumeStorageCandidates(
        'https://s3.us-east-1.amazonaws.com/old-bucket/Profile/resume.docx',
        'resumes',
      ),
      [{ bucket: 'resumes', key: 'Profile/resume.docx' }],
    );
  });

  it('keeps an explicit R2 location while deduplicating the configured candidate', () => {
    assert.deepEqual(
      getTailoredResumeStorageCandidates('r2://resumes/Profile/resume.docx', 'resumes'),
      [{ bucket: 'resumes', key: 'Profile/resume.docx' }],
    );
  });

  it('downloads private R2 objects through the API storage client', async () => {
    let command;
    const client = {
      async send(nextCommand) {
        command = nextCommand;
        return {
          Body: Buffer.from('resume'),
          ContentType: 'application/test-docx',
        };
      },
    };

    const result = await fetchTailoredResumeFromR2(
      'resumes',
      'Profile/resume.docx',
      { client },
    );

    assert.equal(command.constructor.name, 'GetObjectCommand');
    assert.deepEqual(command.input, {
      Bucket: 'resumes',
      Key: 'Profile/resume.docx',
    });
    assert.deepEqual(result, {
      filename: 'resume.docx',
      contentType: 'application/test-docx',
      data: Buffer.from('resume'),
    });
  });
});
