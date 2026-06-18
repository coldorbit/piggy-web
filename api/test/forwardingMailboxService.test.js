import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Op } from 'sequelize';
import {
  classifyMailboxMessageIntent,
  classifyForwardedMessage,
  calendarEventFromAttachments,
  forwardingMailboxApplicationSyncConfig,
  formatMailboxMessage,
  formatMailboxNotificationMessage,
  formatStoredMailboxMessage,
  parseIcsCalendarEvent,
  parseAddressList,
  profileMailboxMessageWhere,
  profileMailboxMatchers,
  storedMailboxMessageAttributes,
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

  it('builds profile email mailbox queries from stored match values', () => {
    const profile = {
      id: '9',
      email: 'MAYA@Example.com',
      forwardingEmail: 'service+maya@co-bounce.com',
    };

    assert.deepEqual(profileMailboxMatchers(profile), [
      { value: 'service+maya@co-bounce.com', source: 'forwardingEmail' },
      { value: 'maya@example.com', source: 'profileEmail' },
    ]);

    const where = profileMailboxMessageWhere(profile, { isRead: false });
    assert.equal(where.isRead, false);
    assert.deepEqual(where[Op.or][0], {
      matchValue: { [Op.in]: ['service+maya@co-bounce.com', 'maya@example.com'] },
    });
    assert.deepEqual(where[Op.or][1], {
      profileId: '9',
      [Op.or]: [
        { matchValue: { [Op.is]: null } },
        { matchValue: '' },
      ],
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
      calendarEvent: null,
    });
  });

  it('formats notification messages without HTML payloads', () => {
    const profile = {
      id: '9',
      name: 'Maya Patel',
      email: 'maya@example.com',
      forwardingEmail: 'service+maya@co-bounce.com',
    };

    assert.deepEqual(formatMailboxNotificationMessage({
      id: 'INBOX:42',
      subject: 'Next steps',
      from: { name: 'Recruiter', address: 'recruiter@example.com' },
      receivedAt: '2026-06-16T12:00:00Z',
      bodyPreview: 'Can you talk tomorrow?',
      bodyHtml: '<p>Can you talk tomorrow?</p>',
      mailboxPath: 'INBOX',
      isRead: false,
    }, profile, {
      value: 'service+maya@co-bounce.com',
      source: 'forwardingEmail:address',
    }), {
      id: 'INBOX:42',
      subject: 'Next steps',
      from: { name: 'Recruiter', address: 'recruiter@example.com' },
      receivedAt: '2026-06-16T12:00:00Z',
      bodyPreview: 'Can you talk tomorrow?',
      mailboxPath: 'INBOX',
      isRead: false,
      matchedProfile: {
        id: '9',
        name: 'Maya Patel',
        email: 'maya@example.com',
        forwardingEmail: 'service+maya@co-bounce.com',
      },
      match: {
        value: 'service+maya@co-bounce.com',
        source: 'forwardingEmail:address',
      },
      classification: null,
      calendarEvent: null,
    });
  });

  it('maps parsed messages into stored mailbox attributes', () => {
    const attrs = storedMailboxMessageAttributes({
      id: 'INBOX:42',
      subject: 'Next steps',
      from: { name: 'Recruiter', address: 'Recruiter@Example.com' },
      sender: { name: 'ATS', address: 'ATS@Example.com' },
      to: [{ name: 'Maya', address: 'MAYA@example.com' }],
      receivedAt: '2026-06-16T12:00:00Z',
      bodyPreview: 'Can you talk tomorrow?',
      bodyHtml: '<p>Can you talk tomorrow?</p>',
      bodyText: 'Can you talk tomorrow?',
      mailboxPath: 'INBOX',
      isRead: false,
      headers: new Map([['x-original-to', 'service+maya@co-bounce.com']]),
    }, {
      id: '9',
    }, {
      value: 'service+maya@co-bounce.com',
      source: 'forwardingEmail:address',
    }, {
      classification: { type: 'application_confirmation', label: 'Application confirmation' },
    });

    assert.equal(attrs.messageId, 'INBOX:42');
    assert.equal(attrs.mailboxPath, 'INBOX');
    assert.equal(attrs.mailboxUid, 42);
    assert.equal(attrs.profileId, '9');
    assert.equal(attrs.fromAddress, 'Recruiter@Example.com');
    assert.equal(attrs.senderAddress, 'ATS@Example.com');
    assert.deepEqual(attrs.toAddresses, [{ name: 'Maya', address: 'maya@example.com' }]);
    assert.deepEqual(attrs.headers, { 'x-original-to': 'service+maya@co-bounce.com' });
    assert.deepEqual(attrs.classification, { type: 'application_confirmation', label: 'Application confirmation' });
    assert.equal(attrs.calendarEvent, null);
  });

  it('formats stored mailbox messages for the inbox response shape', () => {
    assert.deepEqual(formatStoredMailboxMessage({
      messageId: 'INBOX:42',
      subject: 'Next steps',
      fromName: 'Recruiter',
      fromAddress: 'recruiter@example.com',
      senderName: 'Recruiter',
      senderAddress: 'recruiter@example.com',
      toAddresses: [{ name: 'Maya', address: 'maya@example.com' }],
      ccAddresses: [],
      bccAddresses: [],
      receivedAt: new Date('2026-06-16T12:00:00Z'),
      bodyPreview: 'Can you talk tomorrow?',
      bodyHtml: '<p>Can you talk tomorrow?</p>',
      bodyText: 'Can you talk tomorrow?',
      mailboxPath: 'INBOX',
      isRead: false,
      matchValue: 'service+maya@co-bounce.com',
      matchSource: 'forwardingEmail:address',
      classification: { type: 'application_confirmation', label: 'Application confirmation' },
      application: { status: 'applied' },
      profile: {
        id: '9',
        name: 'Maya Patel',
        email: 'maya@example.com',
        forwardingEmail: 'service+maya@co-bounce.com',
      },
    }), {
      id: 'INBOX:42',
      subject: 'Next steps',
      from: { name: 'Recruiter', address: 'recruiter@example.com' },
      receivedAt: '2026-06-16T12:00:00.000Z',
      bodyPreview: 'Can you talk tomorrow?',
      bodyHtml: '<p>Can you talk tomorrow?</p>',
      mailboxPath: 'INBOX',
      isRead: false,
      matchedProfile: {
        id: '9',
        name: 'Maya Patel',
        email: 'maya@example.com',
        forwardingEmail: 'service+maya@co-bounce.com',
      },
      match: {
        value: 'service+maya@co-bounce.com',
        source: 'forwardingEmail:address',
      },
      classification: { type: 'application_confirmation', label: 'Application confirmation' },
      application: { status: 'applied' },
      calendarEvent: null,
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

  it('parses ICS calendar attachments into interview event metadata', () => {
    const event = calendarEventFromAttachments([{
      filename: 'invite.ics',
      contentType: 'text/calendar; method=REQUEST',
      content: Buffer.from([
        'BEGIN:VCALENDAR',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        'UID:event-123',
        'SUMMARY:Technical Interview',
        'DTSTART;TZID=America/New_York:20260618T100000',
        'DTEND;TZID=America/New_York:20260618T110000',
        'LOCATION:https://meet.google.com/abc-defg-hij',
        'ORGANIZER;CN=Hiring Team:mailto:recruiter@example.com',
        'ATTENDEE;CN=Maya Patel;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:maya@example.com',
        'DESCRIPTION:Bring your portfolio\\\\nJoin: https://meet.google.com/abc-defg-hij',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n')),
    }]);

    assert.equal(event.summary, 'Technical Interview');
    assert.equal(event.method, 'REQUEST');
    assert.equal(event.start.local, '2026-06-18T10:00:00');
    assert.equal(event.start.timezone, 'America/New_York');
    assert.equal(event.end.local, '2026-06-18T11:00:00');
    assert.equal(event.conferenceUrl, 'https://meet.google.com/abc-defg-hij');
    assert.deepEqual(event.organizer, {
      name: 'Hiring Team',
      email: 'recruiter@example.com',
      role: null,
      status: null,
    });
    assert.deepEqual(event.attendees[0], {
      name: 'Maya Patel',
      email: 'maya@example.com',
      role: 'REQ-PARTICIPANT',
      status: 'NEEDS-ACTION',
    });
  });

  it('classifies ICS-backed emails as interview related', () => {
    const calendarEvent = parseIcsCalendarEvent([
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Recruiter screen',
      'DTSTART:20260618T170000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n'));

    assert.deepEqual(classifyMailboxMessageIntent({ calendarEvent }), {
      type: 'interview_related',
      label: 'Interview related',
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
