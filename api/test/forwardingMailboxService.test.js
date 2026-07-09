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
      classification: {
        type: 'recruiter_reply',
        label: 'Recruiter reply',
        suggestedAction: 'Review the reply and choose the next follow-up or scheduling step.',
        confidence: 0.72,
      },
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

  it('rechecks stored assessment classifications before formatting inbox messages', () => {
    const formatted = formatStoredMailboxMessage({
      messageId: 'INBOX:43',
      subject: 'Complete your candidate profile',
      fromName: 'Recruiter',
      fromAddress: 'recruiter@example.com',
      senderName: 'Recruiter',
      senderAddress: 'recruiter@example.com',
      toAddresses: [{ name: 'Maya', address: 'maya@example.com' }],
      ccAddresses: [],
      bccAddresses: [],
      receivedAt: new Date('2026-06-16T12:05:00Z'),
      bodyPreview: 'Please complete your profile.',
      bodyHtml: '<p>Please complete your profile and review <a href="https://example.com/careers/testimonials">testimonials</a>.</p>',
      bodyText: 'Please complete your profile and review testimonials: https://example.com/careers/testimonials',
      mailboxPath: 'INBOX',
      isRead: false,
      matchValue: 'service+maya@co-bounce.com',
      matchSource: 'forwardingEmail:address',
      classification: { type: 'assessment_link', label: 'Assessment link' },
      application: null,
      profile: {
        id: '9',
        name: 'Maya Patel',
        email: 'maya@example.com',
        forwardingEmail: 'service+maya@co-bounce.com',
      },
    });

    assert.equal(formatted.classification, null);
  });

  it('rechecks stored declined classifications before formatting inbox messages', () => {
    const formatted = formatStoredMailboxMessage({
      messageId: 'INBOX:44',
      subject: 'Thank You for Submitting Your Resume/CV',
      fromName: 'Talent Acquisition',
      fromAddress: 'talent@example.com',
      senderName: 'Talent Acquisition',
      senderAddress: 'talent@example.com',
      toAddresses: [{ name: 'Maya', address: 'maya@example.com' }],
      ccAddresses: [],
      bccAddresses: [],
      receivedAt: new Date('2026-06-16T12:10:00Z'),
      bodyPreview: 'Your application for Data Scientist & Engineer',
      bodyHtml: '',
      bodyText: [
        'Your application for Data Scientist & Engineer',
        'IMPORTANT: If you did not proceed to the final step of the application process earlier, please complete this form now to be considered for employment.',
        "We're always looking for great people and we really appreciate the time you've taken to apply.",
        'Our team will reach out after they have a moment to review your application.',
        'If you did not apply to this job and feel that you have received this email in error, please click here to remove yourself.',
      ].join('\n'),
      mailboxPath: 'INBOX',
      isRead: false,
      matchValue: 'service+maya@co-bounce.com',
      matchSource: 'forwardingEmail:address',
      classification: { type: 'declined', label: 'Declined email' },
      application: null,
      profile: {
        id: '9',
        name: 'Maya Patel',
        email: 'maya@example.com',
        forwardingEmail: 'service+maya@co-bounce.com',
      },
    });

    assert.deepEqual(formatted.classification, {
      type: 'application_confirmation',
      label: 'Application confirmation',
      suggestedAction: 'Confirm the matching application is submitted.',
      confidence: 0.88,
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
      suggestedAction: 'Mark the application lost or stale and stop follow-ups.',
      confidence: 0.9,
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
      suggestedAction: 'Confirm the matching application is submitted.',
      confidence: 0.88,
    });
  });

  it('does not classify conditional final-step instructions as declined emails', () => {
    const classification = classifyMailboxMessageIntent({
      subject: 'Thank You for Submitting Your Resume/CV',
      bodyText: [
        'Your application for Data Scientist & Engineer',
        'IMPORTANT: If you did not proceed to the final step of the application process earlier, please complete this form now to be considered for employment.',
        "We're always looking for great people and we really appreciate the time you've taken to apply.",
        'Our team will reach out after they have a moment to review your application.',
        'You can withdraw your application at any time by visiting the link below and retrieving your Candidate Profile by entering your email address.',
        'If you did not apply to this job and feel that you have received this email in error, please click here to remove yourself.',
        'NYU Langone Health Talent Acquisition Team',
        'You received this email based on your application with NYU Langone Health.',
      ].join('\n'),
    });

    assert.deepEqual(classification, {
      type: 'application_confirmation',
      label: 'Application confirmation',
      suggestedAction: 'Confirm the matching application is submitted.',
      confidence: 0.88,
    });
  });

  it('does not classify generic linked emails as assessments', () => {
    const classification = classifyMailboxMessageIntent({
      subject: 'Complete your candidate profile',
      bodyText: [
        'Please complete your profile and review our company pages.',
        'Learn more from our testimonials: https://example.com/careers/testimonials',
      ].join('\n'),
    });

    assert.equal(classification, null);
  });

  it('classifies explicit assessment emails', () => {
    const classification = classifyMailboxMessageIntent({
      subject: 'Technical assessment for Software Engineer',
      bodyText: 'Please complete the technical assessment by Friday: https://example.com/assessment',
    });

    assert.deepEqual(classification, {
      type: 'assessment_link',
      label: 'Assessment link',
      suggestedAction: 'Create an assessment item and complete it before expiration.',
      confidence: 0.86,
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

  it('classifies ICS-backed emails as interview invites', () => {
    const calendarEvent = parseIcsCalendarEvent([
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Recruiter screen',
      'DTSTART:20260618T170000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n'));

    assert.deepEqual(classifyMailboxMessageIntent({ calendarEvent }), {
      type: 'interview_invite',
      label: 'Interview invite',
      suggestedAction: 'Add or confirm the interview time, meeting link, and caller assignment.',
      confidence: 0.95,
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
