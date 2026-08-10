import amqp from 'amqplib';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Op } from 'sequelize';
import {
  ensureWebModels,
  getTailoredResumeModel,
} from '../../../../db.js';
import { ENV } from '../../../../env.js';
import { formatTailoredResume } from './biddingService.js';
import { accessibleProfile, currentDbUser } from './profilesService.js';

const MAX_RETRY_DELAY_SECONDS = 15 * 60;
const EVENT_POLL_INTERVAL_MS = 5000;
let rabbitMqPublisher;

export async function enqueueTailoredResumeRequest({ tailoredResumeId, delaySeconds = 0 }) {
  if (!ENV.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL is required to enqueue tailored resume requests');
  }

  rabbitMqPublisher ||= createRabbitMqPublisher({
    url: ENV.RABBITMQ_URL,
    queueName: ENV.TAILORING_QUEUE_NAME,
  });
  await rabbitMqPublisher.publish({ tailoredResumeId, delaySeconds });
}

export function createRabbitMqPublisher({ url, queueName, connect = amqp.connect }) {
  let connection;
  let channel;
  let channelPromise;

  async function getChannel() {
    if (channel) return channel;
    if (channelPromise) return channelPromise;

    channelPromise = (async () => {
      const nextConnection = await connect(url);
      const nextChannel = await nextConnection.createConfirmChannel();
      await nextChannel.assertQueue(queueName, { durable: true });

      connection = nextConnection;
      channel = nextChannel;
      nextConnection.on?.('error', () => {});
      nextChannel.on?.('error', () => {});
      nextConnection.once?.('close', () => {
        if (connection === nextConnection) {
          connection = undefined;
          channel = undefined;
          channelPromise = undefined;
        }
      });
      return nextChannel;
    })();

    try {
      return await channelPromise;
    } catch (error) {
      channelPromise = undefined;
      throw error;
    }
  }

  async function publish({ tailoredResumeId, delaySeconds = 0 }) {
    const activeChannel = await getChannel();
    try {
      const delay = clampDelaySeconds(delaySeconds);
      const destination = delay
        ? await assertRetryQueue(activeChannel, queueName, delay)
        : queueName;
      const body = Buffer.from(JSON.stringify({
        type: 'tailored-resume-requested',
        tailoredResumeId: String(tailoredResumeId),
      }));
      const writable = activeChannel.sendToQueue(destination, body, {
        persistent: true,
        contentType: 'application/json',
        messageId: randomUUID(),
        type: 'tailored-resume-requested',
      });

      if (!writable) await once(activeChannel, 'drain');
      await activeChannel.waitForConfirms();
    } catch (error) {
      channel = undefined;
      channelPromise = undefined;
      const failedConnection = connection;
      connection = undefined;
      if (activeChannel?.close) await activeChannel.close().catch(() => {});
      if (failedConnection?.close) await failedConnection.close().catch(() => {});
      throw error;
    }
  }

  async function close() {
    const activeChannel = channel;
    const activeConnection = connection;
    channel = undefined;
    connection = undefined;
    channelPromise = undefined;
    if (activeChannel?.close) await activeChannel.close().catch(() => {});
    if (activeConnection?.close) await activeConnection.close().catch(() => {});
  }

  return { publish, close };
}

export async function subscribeTailoredResumeEvents(req, res, next) {
  let userId;
  let profileId;
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    userId = user.id;
    const requestedProfileId = req.query.profileId ? String(req.query.profileId) : '';
    if (requestedProfileId) {
      const profile = await accessibleProfile(req, requestedProfileId);
      profileId = String(profile.id);
    }
  } catch (error) {
    next(error);
    return;
  }

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
    where: tailoredResumeEventWhere({ userId, profileId, lastSeenAt }),
    order: [['updatedAt', 'ASC']],
    limit: 50,
  });
}

export function tailoredResumeEventWhere({ userId, profileId, lastSeenAt }) {
  return {
    ...(profileId ? { profileId } : { userId }),
    updatedAt: { [Op.gt]: lastSeenAt },
  };
}

async function assertRetryQueue(channel, queueName, delaySeconds) {
  const delayMilliseconds = delaySeconds * 1000;
  const retryQueueName = `${queueName}.retry.${delaySeconds}s`;
  await channel.assertQueue(retryQueueName, {
    durable: true,
    arguments: {
      'x-message-ttl': delayMilliseconds,
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': queueName,
      'x-expires': Math.max(delayMilliseconds * 2, 60 * 60 * 1000),
    },
  });
  return retryQueueName;
}

function clampDelaySeconds(value) {
  return Math.max(0, Math.min(Math.ceil(Number(value) || 0), MAX_RETRY_DELAY_SECONDS));
}

function maxDate(left, right) {
  const leftDate = left instanceof Date ? left : new Date(left);
  const rightDate = right instanceof Date ? right : new Date(right);
  return rightDate > leftDate ? rightDate : leftDate;
}
