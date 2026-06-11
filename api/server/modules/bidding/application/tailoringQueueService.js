import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Op } from 'sequelize';
import {
  ensureWebModels,
  getTailoredResumeModel,
  repositories,
} from '../../../../db.js';
import { ENV } from '../../../../env.js';
import { formatTailoredResume } from './biddingService.js';

const MAX_SQS_DELAY_SECONDS = 15 * 60;
const EVENT_POLL_INTERVAL_MS = 5000;
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

  let lastSeenAt = new Date(Date.now() - 1000);
  let closed = false;

  const poll = async () => {
    if (closed) return;
    try {
      const updates = await recentTailoredResumeUpdates({ userId, profileId, lastSeenAt });
      for (const tailoredResume of updates) {
        res.write(`event: tailored-resume\ndata: ${JSON.stringify({
          tailoredResume: formatTailoredResume(tailoredResume),
          userId: tailoredResume.userId,
          profileId: tailoredResume.profileId,
        })}\n\n`);
        lastSeenAt = maxDate(lastSeenAt, tailoredResume.updatedAt);
      }
    } catch (error) {
      console.error('Tailored resume event poll failed:', error);
    }
  };

  await poll();

  const pollInterval = setInterval(poll, EVENT_POLL_INTERVAL_MS);
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    closed = true;
    clearInterval(pollInterval);
    clearInterval(heartbeat);
    res.end();
  });
}

async function recentTailoredResumeUpdates({ userId, profileId, lastSeenAt }) {
  return getTailoredResumeModel().findAll({
    where: {
      userId,
      updatedAt: { [Op.gt]: lastSeenAt },
      ...(profileId ? { profileId } : {}),
    },
    order: [['updatedAt', 'ASC']],
    limit: 50,
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

function clampDelaySeconds(value) {
  return Math.max(0, Math.min(Number(value) || 0, MAX_SQS_DELAY_SECONDS));
}

function maxDate(left, right) {
  const leftDate = left instanceof Date ? left : new Date(left);
  const rightDate = right instanceof Date ? right : new Date(right);
  return rightDate > leftDate ? rightDate : leftDate;
}
