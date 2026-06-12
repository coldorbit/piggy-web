import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { ENV } from '../env.js';
import {
  MAX_MESSAGES_PER_POLL,
  MAX_SQS_DELAY_SECONDS,
  RECEIVE_WAIT_TIME_SECONDS,
  VISIBILITY_TIMEOUT_SECONDS,
} from './queueConfig.js';

let sqsClient;

export async function receiveTailoringMessages(messageCapacity) {
  return getSqsClient().send(
    new ReceiveMessageCommand({
      QueueUrl: ENV.TAILORING_QUEUE_URL,
      MaxNumberOfMessages: Math.min(MAX_MESSAGES_PER_POLL, messageCapacity),
      WaitTimeSeconds: RECEIVE_WAIT_TIME_SECONDS,
      VisibilityTimeout: VISIBILITY_TIMEOUT_SECONDS,
    }),
  );
}

export async function deleteQueueMessage(receiptHandle) {
  await getSqsClient().send(
    new DeleteMessageCommand({
      QueueUrl: ENV.TAILORING_QUEUE_URL,
      ReceiptHandle: receiptHandle,
    }),
  );
}

export async function enqueueTailoredResumeRequest({ tailoredResumeId, delaySeconds = 0 }) {
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
