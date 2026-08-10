import amqp from 'amqplib';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { ENV } from '../env.js';
import { MAX_RETRY_DELAY_SECONDS } from './queueConfig.js';

export async function createRabbitMqQueue({
  url = ENV.RABBITMQ_URL,
  queueName = ENV.TAILORING_QUEUE_NAME,
  connect = amqp.connect,
} = {}) {
  const connection = await connect(url);
  const channel = await connection.createConfirmChannel();
  let consumerTag;
  let resolveClosed;
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });

  connection.on?.('error', () => {});
  channel.on?.('error', () => {});
  connection.once?.('close', resolveClosed);
  channel.once?.('close', resolveClosed);
  await channel.assertQueue(queueName, { durable: true });

  async function consume(handler, { prefetch }) {
    await channel.prefetch(prefetch);
    const consumer = await channel.consume(queueName, handler, { noAck: false });
    consumerTag = consumer.consumerTag;
  }

  function ack(message) {
    channel.ack(message);
  }

  function nack(message, requeue = true) {
    channel.nack(message, false, requeue);
  }

  async function publish({ tailoredResumeId, delaySeconds = 0 }) {
    const delay = clampDelaySeconds(delaySeconds);
    const destination = delay
      ? await assertRetryQueue(channel, queueName, delay)
      : queueName;
    const body = Buffer.from(JSON.stringify({
      type: 'tailored-resume-requested',
      tailoredResumeId: String(tailoredResumeId),
    }));
    const writable = channel.sendToQueue(destination, body, {
      persistent: true,
      contentType: 'application/json',
      messageId: randomUUID(),
      type: 'tailored-resume-requested',
    });

    if (!writable) await once(channel, 'drain');
    await channel.waitForConfirms();
  }

  async function cancel() {
    if (!consumerTag) return;
    const activeConsumerTag = consumerTag;
    consumerTag = undefined;
    await channel.cancel(activeConsumerTag);
  }

  async function close() {
    resolveClosed();
    await channel.close().catch(() => {});
    await connection.close().catch(() => {});
  }

  return {
    ack,
    cancel,
    close,
    consume,
    nack,
    publish,
    waitForClose: () => closed,
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
