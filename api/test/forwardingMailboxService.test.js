import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyForwardedMessage,
  formatMailboxMessage,
  parseAddressList,
} from '../server/modules/bidding/application/forwardingMailboxService.js';

describe('forwarding mailbox helpers', () => {
  it('parses address lists from mailparser output', () => {
    assert.deepEqual(parseAddressList({
      value: [
        { name: 'Recruiter', address: 'Recruiter@Example.com' },
        { address: 'candidate@example.com' },
      ],
    }), [
      { name: 'Recruiter', address: 'recruiter@example.com' },
      { name: '', address: 'candidate@example.com' },
    ]);
  });

  it('classifies forwarded messages by profile forwarding alias', () => {
    const profile = {
      id: '7',
      name: 'Ethan Wang',
      email: 'ethan.wang.dev94@gmail.com',
      forwardingEmail: 'service+ethan@co-bounce.com',
    };
    const row = classifyForwardedMessage({
      to: [{ address: 'service+ethan@co-bounce.com' }],
      headers: new Map(),
    }, [profile]);

    assert.equal(row.profile, profile);
    assert.deepEqual(row.match, {
      value: 'service+ethan@co-bounce.com',
      source: 'forwardingEmail:address',
    });
  });

  it('classifies forwarded messages by original profile email in headers', () => {
    const profile = {
      id: '1',
      name: 'Daniel Decola',
      email: 'daniel.decola89@outlook.com',
      forwardingEmail: '',
    };
    const row = classifyForwardedMessage({
      to: [{ address: 'service@co-bounce.com' }],
      headers: new Map([
        ['x-original-to', 'daniel.decola89@outlook.com'],
      ]),
    }, [profile]);

    assert.equal(row.profile, profile);
    assert.deepEqual(row.match, {
      value: 'daniel.decola89@outlook.com',
      source: 'profileEmail:header',
    });
  });

  it('classifies Outlook-style forwarded messages by alias in the body', () => {
    const profile = {
      id: '8',
      name: 'Tiep Nguyen',
      email: 'tiep@example.com',
      forwardingEmail: 'service+tiep@co-bounce.com',
    };
    const row = classifyForwardedMessage({
      to: [{ address: 'service@co-bounce.com' }],
      headers: new Map(),
      bodyText: [
        'From: Recruiter <recruiter@example.com>',
        'Sent: Tuesday, June 16, 2026 9:01 AM',
        'To: service+tiep@co-bounce.com',
        'Subject: Senior Data Engineer',
      ].join('\n'),
    }, [profile]);

    assert.equal(row.profile, profile);
    assert.deepEqual(row.match, {
      value: 'service+tiep@co-bounce.com',
      source: 'forwardingEmail:body',
    });
  });

  it('formats mailbox messages without exposing the raw payload', () => {
    assert.deepEqual(formatMailboxMessage({
      id: 'message-1',
      subject: 'Interview',
      from: { name: 'Recruiter', address: 'recruiter@example.com' },
      receivedAt: '2026-06-16T12:00:00Z',
      bodyPreview: 'Can you talk tomorrow?',
      mailboxPath: null,
      isRead: false,
    }), {
      id: 'message-1',
      subject: 'Interview',
      from: { name: 'Recruiter', address: 'recruiter@example.com' },
      receivedAt: '2026-06-16T12:00:00Z',
      bodyPreview: 'Can you talk tomorrow?',
      mailboxPath: null,
      isRead: false,
      matchedProfile: null,
      match: null,
    });
  });
});
