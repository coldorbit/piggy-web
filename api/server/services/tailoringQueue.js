import { EventEmitter } from 'node:events';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import {
  ensureWebModels,
  getBidProfileModel,
  getScrapedJobModel,
  getTailoredResumeModel,
  repositories,
} from '../../db.js';
import { ENV } from '../../env.js';
import { formatTailoredResume, generateTailoredResumeWithService } from './bids.js';

const events = new EventEmitter();
const MAX_ATTEMPTS = 3;
const RECEIVE_WAIT_TIME_SECONDS = 20;
const VISIBILITY_TIMEOUT_SECONDS = 10 * 60;
const MAX_SQS_DELAY_SECONDS = 15 * 60;
let workerStarted = false;
let sqsClient;

export async function enqueueTailoredResumeRequest({ tailoredResumeId, delaySeconds = 0 }) {
  if (!ENV.TAILORING_QUEUE_URL) {
    throw new Error('TAILORING_QUEUE_URL is required to enqueue tailored resume requests');
  }

  await getSqsClient().send(
    new SendMessageCommand({
      QueueUrl: ENV.TAILORING_QUEUE_URL,
      DelaySeconds: clampDelaySeconds(delaySeconds),
      MessageBody: JSON.stringify({
        type: 'tailored-resume-requested',
        tailoredResumeId: String(tailoredResumeId),
      }),
    }),
  );
}

export function startTailoringQueueWorker() {
  if (workerStarted) return;
  workerStarted = true;
  if (!ENV.TAILORING_QUEUE_URL) {
    console.warn('TAILORING_QUEUE_URL is not set; tailored resume SQS worker is disabled.');
    return;
  }
  void runTailoringQueueWorker();
}

export async function subscribeTailoredResumeEvents(req, res, next) {
  let userId;
  try {
    await ensureWebModels();
    const user = await repositories.findUserByUsername(req.user.username);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    userId = user.id;
  } catch (error) {
    next(error);
    return;
  }

  const profileId = req.query.profileId ? String(req.query.profileId) : '';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: ready\ndata: {}\n\n');

  const onUpdate = (payload) => {
    if (String(payload.userId) !== String(userId)) return;
    if (profileId && String(payload.profileId) !== profileId) return;
    res.write(`event: tailored-resume\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  events.on('tailored-resume', onUpdate);
  req.on('close', () => {
    clearInterval(heartbeat);
    events.off('tailored-resume', onUpdate);
    res.end();
  });
}

async function runTailoringQueueWorker() {
  console.log('Tailoring SQS worker started.');

  while (true) {
    try {
      await ensureWebModels();
      const response = await getSqsClient().send(
        new ReceiveMessageCommand({
          QueueUrl: ENV.TAILORING_QUEUE_URL,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: RECEIVE_WAIT_TIME_SECONDS,
          VisibilityTimeout: VISIBILITY_TIMEOUT_SECONDS,
        }),
      );

      for (const message of response.Messages || []) {
        await processQueueMessage(message);
      }
    } catch (error) {
      console.error('Tailoring SQS worker failed:', error);
      await sleep(5000);
    }
  }
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
  if (tailoredResume.status === 'ready' || tailoredResume.status === 'dead_letter') return null;

  await tailoredResume.update({
    status: 'processing',
    attempts: Number(tailoredResume.attempts || 0) + 1,
    maxAttempts: tailoredResume.maxAttempts || MAX_ATTEMPTS,
  });

  return tailoredResume;
}

async function processTailoredResume(tailoredResume) {
  try {
    const [job, profile] = await Promise.all([
      getScrapedJobModel().findOne({ where: { url: tailoredResume.jobUrl } }),
      getBidProfileModel().findByPk(tailoredResume.profileId),
    ]);

    if (!job) throw new Error('Job not found for tailoring request');
    if (!profile) throw new Error('Profile not found for tailoring request');

    const tailorResult = await generateTailoredResumeWithService({ job, profile });
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

  emitTailoredResumeEvent(tailoredResume);
}

async function failTailoredResume(tailoredResume, error) {
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

function emitTailoredResumeEvent(tailoredResume) {
  events.emit('tailored-resume', {
    tailoredResume: formatTailoredResume(tailoredResume),
    userId: tailoredResume.userId,
    profileId: tailoredResume.profileId,
  });
}

function getSqsClient() {
  if (sqsClient) return sqsClient;
  sqsClient = new SQSClient({
    region: ENV.AWS_REGION,
    endpoint: ENV.AWS_SQS_ENDPOINT || undefined,
  });
  return sqsClient;
}

async function deleteQueueMessage(receiptHandle) {
  await getSqsClient().send(
    new DeleteMessageCommand({
      QueueUrl: ENV.TAILORING_QUEUE_URL,
      ReceiptHandle: receiptHandle,
    }),
  );
}

function parseTailoredResumeId(body) {
  try {
    const payload = JSON.parse(body || '{}');
    return payload.tailoredResumeId ? String(payload.tailoredResumeId) : '';
  } catch {
    return '';
  }
}

function clampDelaySeconds(value) {
  return Math.max(0, Math.min(Number(value) || 0, MAX_SQS_DELAY_SECONDS));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
