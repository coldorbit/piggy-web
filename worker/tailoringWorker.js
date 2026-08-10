import { Op } from 'sequelize';
import {
  initializeWorkerModels,
  getBidProfileModel,
  getScrapedJobModel,
  getTailoredResumeModel,
} from './db.js';
import {
  MAX_ATTEMPTS,
  STALE_PROCESSING_SECONDS,
  TAILORING_CONCURRENCY,
} from './tailoring/queueConfig.js';
import { createRabbitMqQueue } from './tailoring/rabbitMqQueue.js';
import { generateTailoredResume } from './tailoringGeneratorService.js';

const RETRY_STALE_CLAIM = Symbol('retry-stale-claim');
const INFRASTRUCTURE_RETRY_SECONDS = 5;
let shuttingDown = false;
let resolveShutdown;
const shutdownRequested = new Promise((resolve) => {
  resolveShutdown = resolve;
});

process.on('SIGINT', requestShutdown);
process.on('SIGTERM', requestShutdown);

await initializeWorkerModels();
await runTailoringQueueWorker();

async function runTailoringQueueWorker() {
  console.log(`Tailoring RabbitMQ worker started with concurrency ${TAILORING_CONCURRENCY}.`);
  const inFlightMessages = new Set();

  while (!shuttingDown) {
    let queue;
    try {
      queue = await createRabbitMqQueue();
      await queue.consume((message) => {
        if (!message) return;
        let messageTask;
        messageTask = processQueueMessage(queue, message)
          .catch(async (error) => {
            console.error('Tailoring RabbitMQ message failed:', {
              messageId: message.properties?.messageId || 'unknown',
              error,
            });
            await retryFailedQueueMessage(queue, message);
          })
          .finally(() => {
            inFlightMessages.delete(messageTask);
          });
        inFlightMessages.add(messageTask);
      }, { prefetch: TAILORING_CONCURRENCY });

      await Promise.race([queue.waitForClose(), shutdownRequested]);
      if (!shuttingDown) {
        console.warn('Tailoring RabbitMQ connection closed; reconnecting.');
      }
    } catch (error) {
      console.error('Tailoring RabbitMQ worker failed:', error);
    } finally {
      if (shuttingDown) {
        if (queue) await queue.cancel().catch(() => {});
      }
      await Promise.allSettled(inFlightMessages);
      if (queue) await queue.close().catch(() => {});
    }

    if (!shuttingDown) await sleep(5000);
  }
}

async function processQueueMessage(queue, message) {
  const tailoredResumeId = parseTailoredResumeId(message.content?.toString('utf8'));
  if (!tailoredResumeId) {
    console.warn('Acknowledging invalid tailored resume RabbitMQ message:', message.properties?.messageId || 'unknown');
    queue.ack(message);
    return;
  }

  const tailoredResume = await claimTailoringJob(tailoredResumeId);
  if (tailoredResume === RETRY_STALE_CLAIM) {
    await queue.publish({
      tailoredResumeId,
      delaySeconds: Math.min(STALE_PROCESSING_SECONDS, 60),
    });
    queue.ack(message);
    return;
  }
  if (!tailoredResume) {
    queue.ack(message);
    return;
  }

  await processTailoredResume(queue, tailoredResume);
  queue.ack(message);
}

async function claimTailoringJob(tailoredResumeId) {
  const TailoredResume = getTailoredResumeModel();
  const tailoredResume = await TailoredResume.findByPk(tailoredResumeId);
  if (!tailoredResume) return null;
  if (['ready', 'dead_letter', 'invalid', 'cancelled'].includes(tailoredResume.status)) return null;

  const attempts = Number(tailoredResume.attempts || 0);
  const staleProcessingBefore = new Date(Date.now() - STALE_PROCESSING_SECONDS * 1000);
  if (tailoredResume.status === 'processing' && tailoredResume.updatedAt > staleProcessingBefore) {
    return RETRY_STALE_CLAIM;
  }
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

  if (!claimedCount) return RETRY_STALE_CLAIM;
  await tailoredResume.reload();

  return tailoredResume;
}

async function processTailoredResume(queue, tailoredResume) {
  try {
    const [storedJob, profile] = await Promise.all([
      tailoredResume.requestType === 'manual' ? Promise.resolve(null) : getScrapedJobModel().findOne({ where: { url: tailoredResume.jobUrl } }),
      getBidProfileModel().findByPk(tailoredResume.profileId),
    ]);
    const job = tailoredResume.requestType === 'manual' ? manualJobFromTailoredResume(tailoredResume) : storedJob;

    if (!job) throw new Error('Job not found for tailoring request');
    if (!profile) throw new Error('Profile not found for tailoring request');
    if (['draft', 'legacy'].includes(profile.profileStatus || 'active')) {
      await tailoredResume.update({
        status: 'invalid',
        lastError: 'Draft and legacy profiles cannot be used for tailoring',
        deadLetterAt: new Date(),
      });
      return;
    }

    const tailorResult = await generateTailoredResume({ job, profile, tailoredResume });
    await tailoredResume.reload();
    if (tailoredResume.status === 'cancelled') return;

    await tailoredResume.update({
      status: 'ready',
      filePath: tailorResult.r2Key,
      cvData: tailorResult.cvData,
      readyAt: new Date(),
      lastError: null,
      deadLetterAt: null,
    });
  } catch (error) {
    await failTailoredResume(queue, tailoredResume, error);
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

async function failTailoredResume(queue, tailoredResume, error) {
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
    await queue.publish({ tailoredResumeId: tailoredResume.id, delaySeconds });
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
  resolveShutdown();
  console.log('Tailoring worker shutdown requested; waiting for in-flight messages.');
}

async function retryFailedQueueMessage(queue, message) {
  const tailoredResumeId = parseTailoredResumeId(message.content?.toString('utf8'));
  try {
    if (!tailoredResumeId) {
      queue.ack(message);
      return;
    }
    await queue.publish({
      tailoredResumeId,
      delaySeconds: INFRASTRUCTURE_RETRY_SECONDS,
    });
    queue.ack(message);
  } catch {
    try {
      queue.nack(message, true);
    } catch {
      // A closed connection automatically requeues unacknowledged deliveries.
    }
  }
}
