import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.TAILORING_QUEUE_URL ||= 'https://sqs.us-east-1.amazonaws.com/123456789012/applypilot-tailoring';

const {
  renderedResumeTextParts,
  workExperienceBullets,
  workExperienceCompanyLine,
} = await import('../tailoringGeneratorService.js');

describe('tailoring resume ATS formatting', () => {
  const reefPointExperience = {
    company: 'ReefPoint Group',
    work_mode: 'Remote',
    position: 'Senior Data Engineer',
    start_date: 'Aug 2025',
    end_date: 'Jun 2026',
    projects: ['Data Platform Modernization', 'Analytics & Reporting Enablement'],
    bullets: ['Built reliable data pipelines for reporting and operational analytics.'],
  };

  it('uses a clear company/location separator for company names with spaces', () => {
    assert.equal(workExperienceCompanyLine(reefPointExperience), 'ReefPoint Group - Remote');
  });

  it('renders project names as bullet content instead of a standalone Projects line', () => {
    assert.deepEqual(workExperienceBullets(reefPointExperience), [
      'Project focus included Data Platform Modernization and Analytics & Reporting Enablement.',
      'Built reliable data pipelines for reporting and operational analytics.',
    ]);
  });

  it('keeps rendered resume text ATS-safe around work dates and projects', () => {
    const parts = renderedResumeTextParts({
      name: 'Candidate',
      role: 'Senior Data Engineer',
      summary: 'Data engineer with platform and analytics experience.',
      work_experience: [reefPointExperience],
      education: [],
      skills: {},
    }, {});

    assert.equal(parts.includes('ReefPoint Group - Remote'), true);
    assert.equal(parts.includes('Projects: Data Platform Modernization, Analytics & Reporting Enablement'), false);
    assert.equal(parts.includes('Project focus included Data Platform Modernization and Analytics & Reporting Enablement.'), true);
  });
});
