import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calendarEventsForInterviews,
  canDeleteInterviewCall,
  canWriteInterviewForProfile,
  bidStatusFromInterviewStatus,
  groupedBidJobs,
  interviewStatusFromAttrs,
  interviewOccurrenceLogFromSnapshot,
  shouldRegisterInterviewCallForStage,
  shouldRegisterInterviewCallForStageChange,
} from '../server/modules/bidding/presentation/biddingController.js';
import { ROLES } from '../server/utils/roles.js';

describe('groupedBidJobs', () => {
  it('uses a stable group id while promoting the tailored representative', () => {
    const firstRows = groupedBidJobs([
      bidJob({ id: 101, location: 'Austin, TX' }),
      bidJob({ id: 202, location: 'Remote', tailoredResume: { id: 55, status: 'requested' } }),
    ]);
    const secondRows = groupedBidJobs([
      bidJob({ id: 202, location: 'Remote', tailoredResume: { id: 55, status: 'requested' } }),
      bidJob({ id: 101, location: 'Austin, TX' }),
    ]);

    assert.equal(firstRows.length, 1);
    assert.equal(firstRows[0].groupId, secondRows[0].groupId);
    assert.equal(firstRows[0].id, 202);
    assert.equal(firstRows[0].representativeJobId, 202);
    assert.deepEqual(
      firstRows[0].locationOptions.map((option) => option.id),
      [101, 202],
    );
  });

  it('chooses a deterministic representative when no row has tailoring activity', () => {
    const [group] = groupedBidJobs([
      bidJob({ id: 101, location: 'Austin, TX', scrapedAt: '2026-01-01T00:00:00.000Z' }),
      bidJob({ id: 202, location: 'Remote', scrapedAt: '2026-01-02T00:00:00.000Z' }),
    ]);

    assert.equal(group.id, 202);
    assert.equal(group.representativeJobId, 202);
    assert.equal(group.groupId, 'bid-job-group:builtin::software engineer::built in');
  });

  it('does not collapse matching title and company rows from different source values', () => {
    const rows = groupedBidJobs([
      bidJob({ id: 101, source: 'builtin', location: 'Austin, TX' }),
      bidJob({ id: 202, source: 'Built In', location: 'Remote' }),
    ]);

    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.groupId),
      ['bid-job-group:builtin::software engineer::built in', 'bid-job-group:built in::software engineer::built in'],
    );
  });
});

describe('canWriteInterviewForProfile', () => {
  it('allows user role owners to modify their interviews', () => {
    assert.equal(
      canWriteInterviewForProfile({ id: 7, role: ROLES.user }, { userId: 7 }),
      true,
    );
  });

  it('allows admins to modify interviews across profiles', () => {
    assert.equal(
      canWriteInterviewForProfile({ id: 1, role: ROLES.admin }, { userId: 7 }),
      true,
    );
  });

  it('blocks non-owner user role users', () => {
    assert.equal(
      canWriteInterviewForProfile({ id: 8, role: ROLES.user }, { userId: 7 }),
      false,
    );
  });

  it('blocks callers and bidder roles from direct interview writes', () => {
    assert.equal(
      canWriteInterviewForProfile({ id: 7, role: ROLES.caller }, { userId: 7 }),
      false,
    );
    assert.equal(
      canWriteInterviewForProfile({ id: 7, role: ROLES.editableBidder }, { userId: 7 }),
      false,
    );
  });
});

describe('interview scheduled occurrences', () => {
  it('stores newly moved application interviews as todo rows', () => {
    assert.equal(interviewStatusFromAttrs({ status: 'interviewing', interviewStage: 'todo' }), 'todo');
    assert.equal(interviewStatusFromAttrs({ status: 'interviewing', interviewStage: 'screening' }), 'interviewing');
    assert.equal(interviewStatusFromAttrs({ status: 'won', interviewStage: 'final' }), 'won');
    assert.equal(bidStatusFromInterviewStatus('todo'), 'interviewing');
    assert.equal(bidStatusFromInterviewStatus('lost'), 'lost');
  });

  it('registers scheduled calls for non-todo active stages only', () => {
    assert.equal(shouldRegisterInterviewCallForStage('todo'), false);
    assert.equal(shouldRegisterInterviewCallForStage('screening'), true);
    assert.equal(shouldRegisterInterviewCallForStage('technical_interview', 'lost'), false);
    assert.equal(shouldRegisterInterviewCallForStage('lost'), false);
    assert.equal(shouldRegisterInterviewCallForStageChange('todo', 'screening'), true);
    assert.equal(shouldRegisterInterviewCallForStageChange('screening', 'hiring_manager'), true);
    assert.equal(shouldRegisterInterviewCallForStageChange('screening', 'technical_interview', 'lost'), false);
    assert.equal(shouldRegisterInterviewCallForStageChange('screening', 'technical_interview', 'failed'), false);
  });

  it('captures the previous scheduled stage when an interview progresses', () => {
    const log = interviewOccurrenceLogFromSnapshot(
      {
        interviewStage: 'screening',
        interviewNextAt: new Date('2026-06-20T17:00:00.000Z'),
        interviewDurationMinutes: 30,
        interviewNotes: 'Screening notes',
        stageNotes: { screening: 'Recruiter screen went well' },
        stageMeetingLinks: { screening: 'https://meet.example.com/screen' },
      },
      { interviewStage: 'technical_interview' },
    );

    assert.equal(log.eventType, 'interview_occurrence');
    assert.equal(log.toValue, '2026-06-20T17:00:00.000Z');
    assert.deepEqual(log.metadata, {
      stage: 'screening',
      scheduledAt: '2026-06-20T17:00:00.000Z',
      durationMinutes: 30,
      progressedToStage: 'technical_interview',
      notes: 'Recruiter screen went well',
      meetingLink: 'https://meet.example.com/screen',
    });
  });

  it('flattens historical occurrences and the active step for calendar counting', () => {
    const interview = interviewRow({
      id: 77,
      interviewStage: 'technical_interview',
      interviewNextAt: new Date('2026-06-25T18:00:00.000Z'),
      logs: [
        {
          id: 501,
          eventType: 'interview_occurrence',
          toValue: '2026-06-20T17:00:00.000Z',
          metadata: {
            stage: 'screening',
            scheduledAt: '2026-06-20T17:00:00.000Z',
            durationMinutes: 30,
            meetingLink: 'https://meet.example.com/screen',
          },
          createdAt: new Date('2026-06-21T12:00:00.000Z'),
        },
      ],
    });

    const events = calendarEventsForInterviews([interview]);

    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((event) => [event.calendarEventId, event.parentInterviewId, event.interviewStage, event.interviewNextAt.toISOString()]),
      [
        ['interview-77-occurrence-501', 77, 'screening', '2026-06-20T17:00:00.000Z'],
        ['interview-77-current', 77, 'technical_interview', '2026-06-25T18:00:00.000Z'],
      ],
    );
  });

  it('keeps historical occurrences when the current progressed step is unscheduled', () => {
    const interview = interviewRow({
      id: 88,
      interviewStage: 'technical_interview',
      interviewNextAt: null,
      logs: [
        {
          id: 601,
          eventType: 'interview_occurrence',
          toValue: '2026-06-20T17:00:00.000Z',
          metadata: {
            stage: 'screening',
            scheduledAt: '2026-06-20T17:00:00.000Z',
          },
          createdAt: new Date('2026-06-21T12:00:00.000Z'),
        },
      ],
    });

    const events = calendarEventsForInterviews([interview]);

    assert.equal(events.length, 1);
    assert.equal(events[0].calendarEventId, 'interview-88-occurrence-601');
    assert.equal(events[0].interviewStage, 'screening');
  });

  it('uses durable call rows instead of moving the previous calendar event', () => {
    const interview = interviewRow({
      id: 99,
      callerUserId: 900,
      interviewStage: 'hiring_manager',
      interviewNextAt: new Date('2026-06-25T18:00:00.000Z'),
      calls: [
        interviewCall({ id: 701, interviewStage: 'screening', scheduledAt: new Date('2026-06-22T16:00:00.000Z') }),
        interviewCall({ id: 702, callerUserId: 901, interviewStage: 'hiring_manager', scheduledAt: new Date('2026-06-25T18:00:00.000Z') }),
      ],
    });

    const events = calendarEventsForInterviews([interview]);

    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((event) => [event.calendarEventId, event.parentInterviewId, event.interviewStage, event.interviewNextAt.toISOString()]),
      [
        ['interview-99-call-701', 99, 'screening', '2026-06-22T16:00:00.000Z'],
        ['interview-99-call-702', 99, 'hiring_manager', '2026-06-25T18:00:00.000Z'],
      ],
    );
    assert.deepEqual(
      events.map((event) => event.callerUserId),
      [900, 901],
    );
  });
});

describe('canDeleteInterviewCall', () => {
  it('allows the call owner, interview owner, and superadmin to delete a call', () => {
    const call = interviewCall({ userId: 20 });
    const interview = interviewRow({ userId: 30 });

    assert.equal(canDeleteInterviewCall({ id: 20, role: ROLES.user }, call, interview), true);
    assert.equal(canDeleteInterviewCall({ id: 30, role: ROLES.user }, call, interview), true);
    assert.equal(canDeleteInterviewCall({ id: 99, role: ROLES.superadmin }, call, interview), true);
  });

  it('blocks non-owner admins and other users from deleting a call', () => {
    const call = interviewCall({ userId: 20 });
    const interview = interviewRow({ userId: 30 });

    assert.equal(canDeleteInterviewCall({ id: 99, role: ROLES.admin }, call, interview), false);
    assert.equal(canDeleteInterviewCall({ id: 99, role: ROLES.user }, call, interview), false);
  });
});

function bidJob(overrides = {}) {
  return {
    id: 1,
    title: 'Software Engineer',
    company: 'Built In',
    location: 'Remote',
    postedAt: null,
    scrapedAt: '2026-01-01T00:00:00.000Z',
    url: `https://builtin.com/jobs/${overrides.id || 1}`,
    source: 'builtin',
    tailoredResume: null,
    ...overrides,
  };
}

function interviewRow(overrides = {}) {
  return {
    id: 1,
    profileId: 10,
    userId: 20,
    callerUserId: null,
    jobId: 30,
    jobBidId: 40,
    title: 'Senior Data Engineer',
    company: 'ReefPoint Group',
    location: 'Remote',
    jobUrl: 'https://example.com/jobs/30',
    status: 'interviewing',
    interviewStage: 'screening',
    interviewNextAt: new Date('2026-06-20T17:00:00.000Z'),
    interviewDurationMinutes: 60,
    interviewNotes: '',
    stageNotes: {},
    stageMeetingLinks: {},
    logs: [],
    calls: [],
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...overrides,
  };
}

function interviewCall(overrides = {}) {
  return {
    id: 1,
    interviewId: 1,
    userId: 20,
    callerUserId: null,
    interviewStage: 'screening',
    scheduledAt: new Date('2026-06-22T16:00:00.000Z'),
    durationMinutes: 60,
    meetingLink: '',
    notes: '',
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...overrides,
  };
}
