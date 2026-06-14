import { Op } from 'sequelize';
import {
  initializeWorkerModels,
  getBidProfileModel,
  getScrapedJobModel,
  getTailoredResumeModel,
} from './db.js';
import { ENV } from './env.js';
import {
  MAX_ATTEMPTS,
  TAILORING_CONCURRENCY,
  VISIBILITY_TIMEOUT_SECONDS,
} from './tailoring/queueConfig.js';
import {
  deleteQueueMessage,
  enqueueTailoredResumeRequest,
  receiveTailoringMessages,
} from './tailoring/sqsQueue.js';
import { generateTailoredResume } from './tailoringGeneratorService.js';

let shuttingDown = false;

if (!ENV.TAILORING_QUEUE_URL) {
  throw new Error('TAILORING_QUEUE_URL is required to run the tailoring worker');
}

process.on('SIGINT', requestShutdown);
process.on('SIGTERM', requestShutdown);

await initializeWorkerModels();
await runTailoringQueueWorker();

async function runTailoringQueueWorker() {
  console.log(`Tailoring SQS worker started with concurrency ${TAILORING_CONCURRENCY}.`);
  const inFlightMessages = new Set();

  while (!shuttingDown) {
    try {
      while (inFlightMessages.size >= TAILORING_CONCURRENCY && !shuttingDown) {
        await waitForInFlightMessage(inFlightMessages);
      }
      if (shuttingDown) break;

      const messageCapacity = TAILORING_CONCURRENCY - inFlightMessages.size;
      const response = await receiveTailoringMessages(messageCapacity);

      for (const message of response.Messages || []) {
        let messageTask;
        messageTask = processQueueMessage(message)
          .catch((error) => {
            console.error('Tailoring SQS message failed:', {
              messageId: message.MessageId || 'unknown',
              error,
            });
          })
          .finally(() => {
            inFlightMessages.delete(messageTask);
          });
        inFlightMessages.add(messageTask);
      }
    } catch (error) {
      console.error('Tailoring SQS worker failed:', error);
      await sleep(5000);
    }
  }

  await Promise.allSettled(inFlightMessages);
}

async function waitForInFlightMessage(inFlightMessages) {
  if (!inFlightMessages.size) return;
  await Promise.race(inFlightMessages);
}

async function processQueueMessage(message) {
  const receiptHandle = message.ReceiptHandle;
  if (!receiptHandle) return;

  const tailoredResumeId = parseTailoredResumeId(message.Body);
  if (!tailoredResumeId) {
    console.warn('Deleting invalid tailored resume SQS message:', message.MessageId || 'unknown');
    await deleteQueueMessage(receiptHandle);
    return;
  }

  const tailoredResume = await claimTailoringJob(tailoredResumeId);
  if (!tailoredResume) {
    await deleteQueueMessage(receiptHandle);
    return;
  }

  await processTailoredResume(tailoredResume);
  await deleteQueueMessage(receiptHandle);
}

async function claimTailoringJob(tailoredResumeId) {
  const TailoredResume = getTailoredResumeModel();
  const tailoredResume = await TailoredResume.findByPk(tailoredResumeId);
  if (!tailoredResume) return null;
  if (['ready', 'dead_letter', 'invalid', 'cancelled'].includes(tailoredResume.status)) return null;

  const attempts = Number(tailoredResume.attempts || 0);
  const staleProcessingBefore = new Date(Date.now() - VISIBILITY_TIMEOUT_SECONDS * 1000);
  const [claimedCount] = await TailoredResume.update(
    {
      status: 'processing',
      attempts: attempts + 1,
      maxAttempts: tailoredResume.maxAttempts || MAX_ATTEMPTS,
    },
    {
      where: {
        id: tailoredResumeId,
        attempts,
        [Op.or]: [
          { status: 'requested' },
          {
            status: 'processing',
            updatedAt: { [Op.lte]: staleProcessingBefore },
          },
        ],
      },
    },
  );

  if (!claimedCount) return null;
  await tailoredResume.reload();

  return tailoredResume;
}

async function processTailoredResume(tailoredResume) {
  try {
    const [storedJob, profile] = await Promise.all([
      tailoredResume.requestType === 'manual' ? Promise.resolve(null) : getScrapedJobModel().findOne({ where: { url: tailoredResume.jobUrl } }),
      getBidProfileModel().findByPk(tailoredResume.profileId),
    ]);
    const job = tailoredResume.requestType === 'manual' ? manualJobFromTailoredResume(tailoredResume) : storedJob;

    if (!job) throw new Error('Job not found for tailoring request');
    if (!profile) throw new Error('Profile not found for tailoring request');
    if ((profile.profileStatus || 'active') === 'legacy') {
      await tailoredResume.update({
        status: 'invalid',
        lastError: 'Legacy profiles cannot be used for tailoring',
        deadLetterAt: new Date(),
      });
      return;
    }

    const tailorResult = await generateTailoredResume({ job, profile, tailoredResume });
    await tailoredResume.reload();
    if (tailoredResume.status === 'cancelled') return;

    await tailoredResume.update({
      status: 'ready',
      filePath: tailorResult.s3Key,
      readyAt: new Date(),
      lastError: null,
      deadLetterAt: null,
    });
  } catch (error) {
    await failTailoredResume(tailoredResume, error);
  }
}

function manualJobFromTailoredResume(tailoredResume) {
  return {
    title: tailoredResume.manualRole,
    company: tailoredResume.manualCompany,
    location: '',
    listingText: tailoredResume.manualJobDescription,
    rawJob: {
      importType: 'manual_tailoring',
      jobUrl: tailoredResume.jobUrl,
    },
    url: tailoredResume.jobUrl,
  };
}

async function failTailoredResume(tailoredResume, error) {
  await tailoredResume.reload();
  if (tailoredResume.status === 'cancelled') return;

  const attempts = Number(tailoredResume.attempts || 0);
  const maxAttempts = Number(tailoredResume.maxAttempts || MAX_ATTEMPTS);
  const lastError = error.message || 'Tailoring service failed';
  const exhausted = attempts >= maxAttempts;
  const retryAt = exhausted ? null : nextRetryDate(attempts);

  console.error(`Tailoring request ${tailoredResume.id} failed on attempt ${attempts}/${maxAttempts}: ${lastError}`);

  await tailoredResume.update({
    status: exhausted ? 'dead_letter' : 'requested',
    lastError,
    deadLetterAt: exhausted ? new Date() : null,
  });

  if (retryAt) {
    const delaySeconds = Math.ceil((retryAt.getTime() - Date.now()) / 1000);
    await enqueueTailoredResumeRequest({ tailoredResumeId: tailoredResume.id, delaySeconds });
  }
}

function nextRetryDate(attempts) {
  const backoffSeconds = Math.min(2 ** Math.max(attempts - 1, 0) * 60, 15 * 60);
  return new Date(Date.now() + backoffSeconds * 1000);
}

function parseTailoredResumeId(body) {
  try {
    const payload = JSON.parse(body || '{}');
    return payload.tailoredResumeId ? String(payload.tailoredResumeId) : '';
  } catch {
    return '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requestShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Tailoring worker shutdown requested; waiting for in-flight messages.');
}
