import '../env.js';
import {
  ensureWebModels,
  getMarketplaceCallerProfileModel,
  getMarketplaceInterviewOpportunityModel,
  getMarketplaceMatchModel,
  getMarketplaceParticipantModel,
  getSequelize,
  getWebUserModel,
} from '../db.js';
import { hashPassword } from '../auth.js';

const MOCK_PASSWORD = 'Password123!';

async function main() {
  await ensureWebModels({ runBackfills: false });

  const users = await seedUsers();
  const participants = await seedParticipants(users);
  const interviews = await seedInterviews(users);
  const callers = await seedCallers(users);
  const matches = await seedMatches({ users, interviews, callers });

  console.log('Marketplace mock data seeded.');
  console.log(`Users: ${Object.keys(users).length}`);
  console.log(`Participants: ${participants.length}`);
  console.log(`Interview opportunities: ${interviews.length}`);
  console.log(`Caller profiles: ${callers.length}`);
  console.log(`Matches: ${matches.length}`);
  console.log('');
  console.log('Mock login accounts all use password:', MOCK_PASSWORD);
  console.log('Internal reviewer:', users.internal.username);
  console.log('Interview owners:', users.interviewOwnerA.username, users.interviewOwnerB.username);
  console.log('Caller owners:', users.callerOwnerA.username, users.callerOwnerB.username);
}

async function seedUsers() {
  const WebUser = getWebUserModel();
  const specs = {
    internal: { username: 'marketplace.internal', role: 'internal' },
    interviewOwnerA: { username: 'interview.owner.ava', role: 'user' },
    interviewOwnerB: { username: 'interview.owner.noah', role: 'user' },
    callerOwnerA: { username: 'caller.owner.mia', role: 'user' },
    callerOwnerB: { username: 'caller.owner.liam', role: 'user' },
  };

  const users = {};
  for (const [key, spec] of Object.entries(specs)) {
    const [user] = await WebUser.findOrCreate({
      where: { username: spec.username },
      defaults: {
        username: spec.username,
        role: spec.role,
        passwordHash: hashPassword(MOCK_PASSWORD),
      },
    });
    if (user.role !== spec.role) await user.update({ role: spec.role });
    users[key] = user;
  }
  return users;
}

async function seedParticipants(users) {
  const Participant = getMarketplaceParticipantModel();
  const now = new Date();
  const specs = [
    {
      user: users.internal,
      participantRole: 'both',
      displayName: 'Internal Marketplace Desk',
      timezone: 'America/Los_Angeles',
      reviewStatus: 'approved',
      riskStatus: 'normal',
      publicNotes: 'Internal team account for matching and schedule control.',
    },
    {
      user: users.interviewOwnerA,
      participantRole: 'interview_owner',
      displayName: 'Ava Interview Pipeline',
      timezone: 'America/New_York',
      reviewStatus: 'approved',
      riskStatus: 'normal',
      publicNotes: 'Has several active technical interview slots and needs reliable callers.',
    },
    {
      user: users.interviewOwnerB,
      participantRole: 'interview_owner',
      displayName: 'Noah Interview Queue',
      timezone: 'America/Chicago',
      reviewStatus: 'pending',
      riskStatus: 'watch',
      publicNotes: 'New interview owner waiting for internal review.',
    },
    {
      user: users.callerOwnerA,
      participantRole: 'caller_owner',
      displayName: 'Mia Caller Bench',
      timezone: 'America/Los_Angeles',
      reviewStatus: 'approved',
      riskStatus: 'normal',
      publicNotes: 'Caller bench with strong recruiter screen and behavioral interview coverage.',
    },
    {
      user: users.callerOwnerB,
      participantRole: 'caller_owner',
      displayName: 'Liam Caller Operations',
      timezone: 'America/Denver',
      reviewStatus: 'needs_info',
      riskStatus: 'normal',
      publicNotes: 'Caller owner needs to provide clearer availability before approval.',
    },
  ];

  const rows = [];
  for (const spec of specs) {
    const [row] = await Participant.findOrCreate({
      where: { userId: spec.user.id },
      defaults: {
        userId: spec.user.id,
        participantRole: spec.participantRole,
        displayName: spec.displayName,
        timezone: spec.timezone,
        reviewStatus: spec.reviewStatus,
        riskStatus: spec.riskStatus,
        publicNotes: spec.publicNotes,
        internalNotes: `Mock participant seeded for ${spec.displayName}.`,
        reviewedByUserId: users.internal.id,
        reviewedAt: spec.reviewStatus === 'pending' ? null : now,
      },
    });
    await row.update({
      participantRole: spec.participantRole,
      displayName: spec.displayName,
      timezone: spec.timezone,
      reviewStatus: spec.reviewStatus,
      riskStatus: spec.riskStatus,
      publicNotes: spec.publicNotes,
      internalNotes: `Mock participant seeded for ${spec.displayName}.`,
      reviewedByUserId: users.internal.id,
      reviewedAt: spec.reviewStatus === 'pending' ? null : now,
    });
    rows.push(row);
  }
  return rows;
}

async function seedInterviews(users) {
  const Interview = getMarketplaceInterviewOpportunityModel();
  const now = new Date();
  const specs = [
    {
      ownerUserId: users.interviewOwnerA.id,
      title: 'Senior Frontend Engineer',
      company: 'Northstar Health',
      stage: 'technical_interview',
      format: 'Zoom',
      timezone: 'America/New_York',
      availabilityWindows: 'Tue 10am-1pm ET; Thu 2pm-5pm ET',
      requiredSkills: 'React, TypeScript, system design, calm client communication',
      budget: '$350 per completed interview',
      jobUrl: 'https://example.com/jobs/northstar-frontend',
      notes: 'Caller should be comfortable with component architecture and accessibility questions.',
      reviewStatus: 'approved',
      matchStatus: 'matched',
    },
    {
      ownerUserId: users.interviewOwnerA.id,
      title: 'Data Platform Engineer',
      company: 'Atlas Metrics',
      stage: 'recruiter_screen',
      format: 'Phone',
      timezone: 'America/New_York',
      availabilityWindows: 'Mon/Wed/Fri mornings ET',
      requiredSkills: 'Data engineering, SQL, Python, compensation discussion',
      budget: '$225 per completed screen',
      jobUrl: 'https://example.com/jobs/atlas-data-platform',
      notes: 'Recruiter screen with likely salary and relocation questions.',
      reviewStatus: 'approved',
      matchStatus: 'scheduled',
    },
    {
      ownerUserId: users.interviewOwnerB.id,
      title: 'AI Product Engineer',
      company: 'Orbit Labs',
      stage: 'onsite_loop',
      format: 'Google Meet',
      timezone: 'America/Chicago',
      availabilityWindows: 'Needs confirmation',
      requiredSkills: 'AI product sense, full-stack, product communication',
      budget: '$600 for full loop',
      jobUrl: 'https://example.com/jobs/orbit-ai-product',
      notes: 'Pending review. Internal team should verify opportunity quality first.',
      reviewStatus: 'pending',
      matchStatus: 'submitted',
    },
  ];

  return upsertByTitle(Interview, specs, now, users.internal.id);
}

async function seedCallers(users) {
  const Caller = getMarketplaceCallerProfileModel();
  const now = new Date();
  const specs = [
    {
      ownerUserId: users.callerOwnerA.id,
      callerName: 'Mia Bench - Frontend Specialist',
      skills: 'React, TypeScript, behavioral interviews, recruiter screens',
      languages: 'English',
      experience: '5 years frontend engineering interview support',
      timezone: 'America/Los_Angeles',
      availabilityWindows: 'Tue/Thu 7am-3pm PT',
      preferredCategories: 'software, frontend, SaaS',
      rateExpectation: '$250-$400 per interview',
      constraints: 'No fintech compliance calls',
      reviewStatus: 'approved',
      availabilityStatus: 'matched',
      performanceNotes: 'Strong mock score. Good signal quality.',
    },
    {
      ownerUserId: users.callerOwnerA.id,
      callerName: 'Mia Bench - Data Caller',
      skills: 'SQL, Python, analytics engineering, recruiter screens',
      languages: 'English, Spanish',
      experience: 'Data engineering interview support and salary negotiation',
      timezone: 'America/Los_Angeles',
      availabilityWindows: 'Mon/Wed/Fri 8am-2pm PT',
      preferredCategories: 'data, analytics, platform',
      rateExpectation: '$200-$300 per screen',
      constraints: '',
      reviewStatus: 'approved',
      availabilityStatus: 'scheduled',
      performanceNotes: 'Reliable availability and clear post-call notes.',
    },
    {
      ownerUserId: users.callerOwnerB.id,
      callerName: 'Liam Caller - Product AI',
      skills: 'AI product, roadmap discussion, full-stack architecture',
      languages: 'English',
      experience: 'Needs additional verification',
      timezone: 'America/Denver',
      availabilityWindows: 'Not yet verified',
      preferredCategories: 'ai_ml, product engineering',
      rateExpectation: '$500 per loop',
      constraints: 'Availability pending',
      reviewStatus: 'needs_info',
      availabilityStatus: 'unavailable',
      performanceNotes: 'Ask for references before approving.',
    },
  ];

  return upsertByCallerName(Caller, specs, now, users.internal.id);
}

async function seedMatches({ users, interviews, callers }) {
  const Match = getMarketplaceMatchModel();
  const frontend = interviews.find((row) => row.title === 'Senior Frontend Engineer');
  const data = interviews.find((row) => row.title === 'Data Platform Engineer');
  const frontendCaller = callers.find((row) => row.callerName === 'Mia Bench - Frontend Specialist');
  const dataCaller = callers.find((row) => row.callerName === 'Mia Bench - Data Caller');
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const specs = [
    {
      interviewOpportunityId: frontend.id,
      callerProfileId: frontendCaller.id,
      assignedInternalUserId: users.internal.id,
      status: 'offer_tracking',
      callerConfirmationStatus: 'confirmed',
      interviewConfirmationStatus: 'confirmed',
      scheduledAt: tomorrow,
      meetingLink: 'https://meet.example.com/mock-frontend',
      internalNotes: 'Mock successful match. Offer is being tracked by internal team.',
      interviewOwnerNotes: 'Owner confirmed caller fit for React/system design.',
      callerOwnerNotes: 'Caller confirmed and completed prep.',
      outcomeStatus: 'offer_received',
      offerStatus: 'pending',
      offerAmount: '$165,000 base + equity',
      offerTerms: 'Start date flexible. Internal team reviewing final acceptance path.',
      platformFee: '$3,500',
      callerPayout: '$900',
      paymentStatus: 'requested',
      payoutStatus: 'pending',
    },
    {
      interviewOpportunityId: data.id,
      callerProfileId: dataCaller.id,
      assignedInternalUserId: users.internal.id,
      status: 'scheduled',
      callerConfirmationStatus: 'confirmed',
      interviewConfirmationStatus: 'confirmed',
      scheduledAt: nextWeek,
      meetingLink: 'https://meet.example.com/mock-data-screen',
      internalNotes: 'Scheduled mock recruiter screen. Internal team owns meeting link visibility.',
      interviewOwnerNotes: 'Interview owner prefers salary discussion to stay conservative.',
      callerOwnerNotes: 'Caller can handle SQL/Python recruiter screen.',
      outcomeStatus: 'pending',
      offerStatus: 'none',
      paymentStatus: 'not_started',
      payoutStatus: 'not_started',
    },
  ];

  const rows = [];
  for (const spec of specs) {
    const [row] = await Match.findOrCreate({
      where: {
        interviewOpportunityId: spec.interviewOpportunityId,
        callerProfileId: spec.callerProfileId,
      },
      defaults: spec,
    });
    await row.update(spec);
    rows.push(row);
  }
  return rows;
}

async function upsertByTitle(Model, specs, now, reviewerId) {
  const rows = [];
  for (const spec of specs) {
    const [row] = await Model.findOrCreate({
      where: { title: spec.title, ownerUserId: spec.ownerUserId },
      defaults: { ...spec, internalNotes: `Mock interview seeded for ${spec.company}.`, reviewedByUserId: reviewerId, reviewedAt: now },
    });
    await row.update({ ...spec, internalNotes: `Mock interview seeded for ${spec.company}.`, reviewedByUserId: reviewerId, reviewedAt: now });
    rows.push(row);
  }
  return rows;
}

async function upsertByCallerName(Model, specs, now, reviewerId) {
  const rows = [];
  for (const spec of specs) {
    const [row] = await Model.findOrCreate({
      where: { callerName: spec.callerName, ownerUserId: spec.ownerUserId },
      defaults: { ...spec, internalNotes: `Mock caller seeded for ${spec.callerName}.`, reviewedByUserId: reviewerId, reviewedAt: now },
    });
    await row.update({ ...spec, internalNotes: `Mock caller seeded for ${spec.callerName}.`, reviewedByUserId: reviewerId, reviewedAt: now });
    rows.push(row);
  }
  return rows;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSequelize().close();
  });
