import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.RABBITMQ_URL ||= 'amqp://rabbitmq.test';

const {
  buildResumePrompt,
  renderedResumeTextParts,
  workExperienceBullets,
  workExperienceCompanyLine,
  workExperienceProjects,
  validateGeneratedWorkExperienceProjects,
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

  it('keeps structured projects and their bullets under the correct experience', () => {
    const experience = {
      ...reefPointExperience,
      projects: [
        {
          name: 'Data Platform Modernization',
          description: 'Modernized batch ingestion and data-quality checks for analytics datasets.',
          bullets: [
            'Modernized batch ingestion workflows and strengthened data-quality checks for analytics datasets used by reporting teams.',
          ],
        },
        {
          name: 'Analytics Enablement',
          description: 'Improved governed reporting datasets and stakeholder delivery.',
          bullets: [
            'Improved governed reporting datasets and delivery practices for stakeholders consuming operational analytics.',
          ],
        },
      ],
      bullets: undefined,
    };

    assert.deepEqual(workExperienceProjects(experience).map(({ name, description, bullets }) => ({ name, description, bullets })), experience.projects);
    assert.deepEqual(workExperienceBullets(experience), [
      'Modernized batch ingestion workflows and strengthened data-quality checks for analytics datasets used by reporting teams.',
      'Improved governed reporting datasets and delivery practices for stakeholders consuming operational analytics.',
    ]);

    const parts = renderedResumeTextParts({
      work_experience: [experience],
      education: [],
      skills: {},
    }, {});
    assert.equal(parts.includes('Project: Data Platform Modernization'), true);
    assert.equal(parts.includes('Modernized batch ingestion and data-quality checks for analytics datasets.'), true);
    assert.equal(parts.includes('Project: Analytics Enablement'), true);
  });

  it('requires project-grounded bullets in the tailoring prompt and JSON shape', () => {
    const prompt = buildResumePrompt('Senior Data Engineer role', 'Senior Data Engineer at ReefPoint Group');

    assert.match(prompt, /Every bullet must be traceable to the description of the project that contains it/);
    assert.match(prompt, /Never create a work-experience bullet from the target job description alone/);
    assert.match(prompt, /Put every achievement bullet inside its supporting project's "bullets" array/);
    assert.match(prompt, /"description": ""/);
  });

  it('rejects generated experience bullets that are not nested under a described project', () => {
    assert.throws(
      () => validateGeneratedWorkExperienceProjects({
        work_experience: [{
          company: 'ReefPoint Group',
          projects: ['Data Platform Modernization'],
          bullets: ['A role-level bullet without a supporting project description.'],
        }],
      }),
      /must contain structured projects/,
    );
  });
});
