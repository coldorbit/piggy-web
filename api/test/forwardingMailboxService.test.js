import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyMailboxMessageIntent,
  classifyForwardedMessage,
  forwardingMailboxApplicationSyncConfig,
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
      bodyHtml: '<p>Can you talk tomorrow?</p>',
      mailboxPath: null,
      isRead: false,
    }), {
      id: 'message-1',
      subject: 'Interview',
      from: { name: 'Recruiter', address: 'recruiter@example.com' },
      receivedAt: '2026-06-16T12:00:00Z',
      bodyPreview: 'Can you talk tomorrow?',
      bodyHtml: '<p>Can you talk tomorrow?</p>',
      mailboxPath: null,
      isRead: false,
      matchedProfile: null,
      match: null,
      classification: null,
      application: null,
    });
  });

  it('classifies declined emails', () => {
    const classification = classifyMailboxMessageIntent({
      subject: 'Your application for Software Engineer',
      bodyText: 'Unfortunately, we will not be moving forward with your application at this time.',
    });

    assert.deepEqual(classification, {
      type: 'declined',
      label: 'Declined email',
    });
  });

  it('classifies application confirmation emails', () => {
    const classification = classifyMailboxMessageIntent({
      subject: 'Application received',
      bodyText: 'Thank you for applying to the Senior Data Engineer role. We received your application.',
    });

    assert.deepEqual(classification, {
      type: 'application_confirmation',
      label: 'Application confirmation',
    });
  });

  it('normalizes background application sync configuration', () => {
    assert.deepEqual(forwardingMailboxApplicationSyncConfig({
      enabled: false,
      mailboxConfigured: true,
      intervalMs: 1,
      messageLimit: 500,
    }), {
      enabled: false,
      reason: 'disabled',
      intervalMs: 30000,
      messageLimit: 200,
    });

    assert.deepEqual(forwardingMailboxApplicationSyncConfig({
      enabled: 'true',
      mailboxConfigured: false,
      intervalMs: 60000,
      messageLimit: 25,
    }), {
      enabled: false,
      reason: 'not_configured',
      intervalMs: 60000,
      messageLimit: 25,
    });
  });
});
