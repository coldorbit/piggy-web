import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JOB_PROFILE_RANKING_MODEL_VERSION,
  buildProfileContext,
  rankJobsForProfile,
  scoreJobForProfile,
} from '../server/modules/bidding/application/jobProfileRankingService.js';

const now = new Date('2026-08-05T12:00:00.000Z');
const profile = {
  profileBadge: 'ML',
  yearsOfExperience: '8 years',
  resumeText: 'Senior machine learning engineer using Python, PyTorch, AWS, Docker, Kubernetes, and MLOps.',
};
const intelligence = {
  targetLevel: 'Senior',
  targetTitles: ['Senior Machine Learning Engineer', 'MLOps Engineer'],
  specializations: ['generative_ai', 'ml_engineer'],
  remotePreference: 'Remote',
};

test('ranks a matching ML job ahead of an unrelated frontend job', () => {
  const jobs = [
    {
      id: 1,
      title: 'Frontend Engineer',
      category: 'software',
      location: 'On-site',
      listingText: 'Build React interfaces with JavaScript and CSS.',
      postedAt: '2026-08-04T12:00:00.000Z',
    },
    {
      id: 2,
      title: 'Senior Machine Learning Engineer',
      category: 'ml_engineer',
      aiMlArea: 'generative_ai',
      location: 'Remote',
      listingText: 'Build production Python and PyTorch services on AWS using Docker, Kubernetes, and MLOps.',
      postedAt: '2026-08-03T12:00:00.000Z',
    },
  ];

  const ranked = rankJobsForProfile({ profile, intelligence, jobs, now });

  assert.equal(ranked[0].job.id, 2);
  assert.ok(ranked[0].match.score > ranked[1].match.score);
  assert.equal(ranked[0].match.modelVersion, JOB_PROFILE_RANKING_MODEL_VERSION);
  assert.ok(ranked[0].match.reasons.includes('Target title aligns'));
});

test('uses years of experience when no target level is available', () => {
  const profileContext = buildProfileContext(profile, { ...intelligence, targetLevel: '' });
  const match = scoreJobForProfile({
    profileContext,
    now,
    job: {
      id: 3,
      title: 'Senior MLOps Engineer',
      category: 'ml_engineer',
      listingText: 'Python AWS Docker Kubernetes machine learning platform.',
      postedAt: '2026-08-01T12:00:00.000Z',
    },
  });

  assert.equal(match.components.seniority, 1);
  assert.match(match.profileFingerprint, /^[a-f0-9]{64}$/);
  assert.match(match.jobFingerprint, /^[a-f0-9]{64}$/);
});

test('does not present an unconfigured profile as a strong match', () => {
  const profileContext = buildProfileContext({}, null);
  const match = scoreJobForProfile({
    profileContext,
    now,
    job: {
      id: 4,
      title: 'Senior Machine Learning Engineer',
      listingText: 'Python machine learning role.',
      postedAt: '2026-08-05T12:00:00.000Z',
    },
  });

  assert.ok(match.score < 0.4);
  assert.deepEqual(match.reasons, ['Add profile details to improve this ranking']);
});
