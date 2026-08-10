import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

process.env.RABBITMQ_URL ||= 'amqp://rabbitmq.test';

const { createRabbitMqQueue } = await import('../tailoring/rabbitMqQueue.js');

test('RabbitMQ consumer uses durable messages, manual acknowledgements, and prefetch', async () => {
  const channel = fakeChannel();
  const connection = fakeConnection(channel);
  const queue = await createRabbitMqQueue({
    url: 'amqp://rabbitmq.test',
    queueName: 'applypilot.tailoring',
    connect: async (url) => {
      assert.equal(url, 'amqp://rabbitmq.test');
      return connection;
    },
  });
  const handler = () => {};

  await queue.consume(handler, { prefetch: 4 });
  const message = { content: Buffer.from('{}') };
  queue.ack(message);
  queue.nack(message, true);

  assert.deepEqual(channel.assertions[0], ['applypilot.tailoring', { durable: true }]);
  assert.equal(channel.prefetchCount, 4);
  assert.deepEqual(channel.consumer, {
    queue: 'applypilot.tailoring',
    handler,
    options: { noAck: false },
  });
  assert.deepEqual(channel.acked, [message]);
  assert.deepEqual(channel.nacked, [{ message, allUpTo: false, requeue: true }]);

  await queue.cancel();
  await queue.close();
  assert.deepEqual(channel.cancelled, ['consumer-1']);
  assert.equal(connection.closed, true);
});

test('RabbitMQ retries use durable TTL queues that dead-letter to the main queue', async () => {
  const channel = fakeChannel();
  const queue = await createRabbitMqQueue({
    url: 'amqp://rabbitmq.test',
    queueName: 'applypilot.tailoring',
    connect: async () => fakeConnection(channel),
  });

  await queue.publish({ tailoredResumeId: 17, delaySeconds: 60 });

  assert.deepEqual(channel.assertions[1], [
    'applypilot.tailoring.retry.60s',
    {
      durable: true,
      arguments: {
        'x-message-ttl': 60000,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'applypilot.tailoring',
        'x-expires': 3600000,
      },
    },
  ]);
  assert.equal(channel.sent[0].queue, 'applypilot.tailoring.retry.60s');
  assert.equal(channel.sent[0].options.persistent, true);
  assert.deepEqual(JSON.parse(channel.sent[0].body.toString()), {
    type: 'tailored-resume-requested',
    tailoredResumeId: '17',
  });
  assert.equal(channel.confirmCount, 1);
});

function fakeConnection(channel) {
  const connection = new EventEmitter();
  connection.closed = false;
  connection.createConfirmChannel = async () => channel;
  connection.close = async () => {
    connection.closed = true;
  };
  return connection;
}

function fakeChannel() {
  const channel = new EventEmitter();
  channel.assertions = [];
  channel.sent = [];
  channel.acked = [];
  channel.nacked = [];
  channel.cancelled = [];
  channel.confirmCount = 0;
  channel.assertQueue = async (...args) => {
    channel.assertions.push(args);
  };
  channel.prefetch = async (count) => {
    channel.prefetchCount = count;
  };
  channel.consume = async (queue, handler, options) => {
    channel.consumer = { queue, handler, options };
    return { consumerTag: 'consumer-1' };
  };
  channel.ack = (message) => channel.acked.push(message);
  channel.nack = (message, allUpTo, requeue) => channel.nacked.push({ message, allUpTo, requeue });
  channel.cancel = async (consumerTag) => channel.cancelled.push(consumerTag);
  channel.sendToQueue = (queue, body, options) => {
    channel.sent.push({ queue, body, options });
    return true;
  };
  channel.waitForConfirms = async () => {
    channel.confirmCount += 1;
  };
  channel.close = async () => {};
  return channel;
}
