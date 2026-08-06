import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordManualTailoringApplication } from '../server/modules/bidding/presentation/biddingTailoringController.js';

test('creates a manual job and tailoring application for the selected profile', async () => {
  const now = new Date('2026-08-05T14:30:00.000Z');
  const transaction = { id: 'manual-tailoring-transaction' };
  const createdJobs = [];
  const createdBids = [];
  const ScrapedJob = {
    findOne: async () => null,
    create: async (attributes, options) => {
      createdJobs.push({ attributes, options });
      return { id: 41, ...attributes };
    },
  };
  const JobBid = {
    findOne: async () => null,
    create: async (attributes, options) => {
      createdBids.push({ attributes, options });
      return attributes;
    },
  };

  await recordManualTailoringApplication({
    attrs: {
      company: 'Example Labs',
      role: 'Machine Learning Engineer',
      jobUrl: 'https://example.com/jobs/ml-engineer',
      jobDescription: 'Build and deploy machine learning systems.',
    },
    profileId: 17,
    userId: 9,
    transaction,
    now,
    ScrapedJob,
    JobBid,
  });

  assert.equal(createdJobs.length, 1);
  assert.deepEqual(createdJobs[0].options, { transaction });
  assert.equal(createdJobs[0].attributes.source, 'Manual');
  assert.equal(createdJobs[0].attributes.rawJob.importType, 'manual_tailoring');
  assert.equal(createdJobs[0].attributes.rawJob.isManualImport, true);
  assert.deepEqual(createdBids, [{
    attributes: {
      userId: 9,
      profileId: 17,
      jobId: 41,
      status: 'tailoring',
      bidAt: now,
      updatedAt: now,
    },
    options: { transaction },
  }]);
});

test('reuses an existing job while associating it only with the selected profile', async () => {
  const transaction = { id: 'existing-job-transaction' };
  const bidLookups = [];
  const createdBids = [];
  const ScrapedJob = {
    findOne: async (query) => {
      assert.equal(query.transaction, transaction);
      assert.deepEqual(query.where, { url: 'https://example.com/jobs/shared' });
      return { id: 73 };
    },
    create: async () => assert.fail('An existing job must not be recreated'),
  };
  const JobBid = {
    findOne: async (query) => {
      bidLookups.push(query);
      return null;
    },
    create: async (attributes) => createdBids.push(attributes),
  };

  await recordManualTailoringApplication({
    attrs: {
      company: 'Example Labs',
      role: 'Data Engineer',
      jobUrl: 'https://example.com/jobs/shared',
      jobDescription: 'Build reliable data pipelines.',
    },
    profileId: 29,
    userId: 11,
    transaction,
    ScrapedJob,
    JobBid,
  });

  assert.deepEqual(bidLookups[0].where, { profileId: 29, jobId: 73 });
  assert.equal(createdBids[0].profileId, 29);
  assert.equal(createdBids[0].jobId, 73);
  assert.equal(createdBids[0].status, 'tailoring');
});

test('moves an existing pending profile application to the Tailored status', async () => {
  const now = new Date('2026-08-05T15:00:00.000Z');
  const updates = [];
  const existingBid = {
    status: 'tailoring',
    update: async (attributes, options) => updates.push({ attributes, options }),
  };
  const transaction = { id: 'pending-bid-transaction' };

  await recordManualTailoringApplication({
    attrs: {
      company: 'Example Labs',
      role: 'Data Engineer',
      jobUrl: 'https://example.com/jobs/data-engineer',
      jobDescription: 'Build reliable data pipelines.',
    },
    profileId: 29,
    userId: 11,
    transaction,
    now,
    ScrapedJob: { findOne: async () => ({ id: 73 }) },
    JobBid: {
      findOne: async () => existingBid,
      create: async () => assert.fail('An existing profile application must not be duplicated'),
    },
  });

  assert.deepEqual(updates, [{
    attributes: { status: 'tailoring', userId: 11, updatedAt: now },
    options: { transaction },
  }]);
});
