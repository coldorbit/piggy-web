import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import {
  createRabbitMqPublisher,
  tailoredResumeEventWhere,
} from '../server/modules/bidding/application/tailoringQueueService.js';

test('RabbitMQ publisher declares a durable queue and confirms persistent messages', async () => {
  const channel = fakeChannel();
  const connection = fakeConnection(channel);
  const publisher = createRabbitMqPublisher({
    url: 'amqp://rabbitmq.test',
    queueName: 'applypilot.tailoring',
    connect: async (url) => {
      assert.equal(url, 'amqp://rabbitmq.test');
      return connection;
    },
  });

  await publisher.publish({ tailoredResumeId: 42 });

  assert.deepEqual(channel.assertions[0], ['applypilot.tailoring', { durable: true }]);
  assert.equal(channel.sent[0].queue, 'applypilot.tailoring');
  assert.deepEqual(JSON.parse(channel.sent[0].body.toString()), {
    type: 'tailored-resume-requested',
    tailoredResumeId: '42',
  });
  assert.equal(channel.sent[0].options.persistent, true);
  assert.equal(channel.sent[0].options.contentType, 'application/json');
  assert.equal(channel.confirmCount, 1);

  await publisher.close();
  assert.equal(channel.closed, true);
  assert.equal(connection.closed, true);
});

test('RabbitMQ publisher routes delayed messages through a dead-letter retry queue', async () => {
  const channel = fakeChannel();
  const publisher = createRabbitMqPublisher({
    url: 'amqp://rabbitmq.test',
    queueName: 'applypilot.tailoring',
    connect: async () => fakeConnection(channel),
  });

  await publisher.publish({ tailoredResumeId: 'resume-7', delaySeconds: 901 });

  assert.deepEqual(channel.assertions[1], [
    'applypilot.tailoring.retry.900s',
    {
      durable: true,
      arguments: {
        'x-message-ttl': 900000,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'applypilot.tailoring',
        'x-expires': 3600000,
      },
    },
  ]);
  assert.equal(channel.sent[0].queue, 'applypilot.tailoring.retry.900s');
});

test('profile tailoring streams include updates from owners and requesters', () => {
  const where = tailoredResumeEventWhere({
    userId: 11,
    profileId: '29',
    lastSeenAt: new Date('2026-08-05T15:00:00.000Z'),
  });

  assert.equal(where.profileId, '29');
  assert.equal(Object.hasOwn(where, 'userId'), false);
});

test('unscoped tailoring streams remain limited to the requester', () => {
  const where = tailoredResumeEventWhere({
    userId: 11,
    profileId: '',
    lastSeenAt: new Date('2026-08-05T15:00:00.000Z'),
  });

  assert.equal(where.userId, 11);
  assert.equal(Object.hasOwn(where, 'profileId'), false);
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
  channel.confirmCount = 0;
  channel.closed = false;
  channel.assertQueue = async (...args) => {
    channel.assertions.push(args);
  };
  channel.sendToQueue = (queue, body, options) => {
    channel.sent.push({ queue, body, options });
    return true;
  };
  channel.waitForConfirms = async () => {
    channel.confirmCount += 1;
  };
  channel.close = async () => {
    channel.closed = true;
  };
  return channel;
}
