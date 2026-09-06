import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.RABBITMQ_URL ||= 'amqp://rabbitmq.test';

const {
  TAILORED_RESUME_TEXT_FORMAT,
  buildResumePrompt,
  renderedResumeTextParts,
  renderResumeDocx,
  validateGeneratedResume,
  workExperienceBullets,
  workExperienceCapabilitySections,
  workExperienceHeading,
  workExperienceMetaLine,
  workExperienceProjects,
} = await import('../tailoringGeneratorService.js');

describe('tailored resume prompt and DOCX formatting', () => {
  const reefPointExperience = {
    company: 'ReefPoint Group',
    location: 'Boston, MA',
    work_mode: 'Remote',
    position: 'Senior Data Engineer',
    start_date: 'Aug 2025',
    end_date: 'Jun 2026',
    bullets: ['Built reliable data pipelines for reporting and operational analytics.'],
  };

  it('uses the requested company, role, location, and date line structure', () => {
    assert.equal(workExperienceHeading(reefPointExperience), 'ReefPoint Group | Senior Data Engineer');
    assert.equal(workExperienceMetaLine(reefPointExperience), 'Boston, MA (Remote) | Aug 2025 – Jun 2026');
  });

  it('keeps the requested ATS section order in the rendered document text', () => {
    const parts = renderedResumeTextParts({
      name: 'Candidate',
      role: 'Senior Data Engineer',
      summary: 'Data engineer with platform and analytics experience.',
      work_experience: [reefPointExperience],
      education: [{ degree: 'BS', area: 'Computer Science', institution: 'State University' }],
      skills: { Languages: ['Python', 'SQL'] },
    }, {
      location: 'Seattle, WA',
      phone: '555-0100',
      email: 'candidate@example.com',
    });

    const summaryIndex = parts.indexOf('SUMMARY');
    const skillsIndex = parts.indexOf('SKILLS');
    const experienceIndex = parts.indexOf('PROFESSIONAL EXPERIENCE');
    const educationIndex = parts.indexOf('EDUCATION');
    assert.equal(summaryIndex < skillsIndex && skillsIndex < experienceIndex && experienceIndex < educationIndex, true);
    assert.equal(parts.includes('ReefPoint Group | Senior Data Engineer'), true);
    assert.equal(parts.includes('Boston, MA (Remote) | Aug 2025 – Jun 2026'), true);
    assert.equal(parts.indexOf('555-0100') < parts.indexOf('candidate@example.com'), true);
  });

  it('renders optional capability groups only when supplied', () => {
    const experience = {
      ...reefPointExperience,
      bullets: [],
      capability_sections: [
        {
          name: 'Data Platform Modernization',
          bullets: ['Modernized batch ingestion and data-quality checks.'],
        },
        {
          name: 'Analytics Enablement',
          bullets: ['Improved governed reporting datasets for stakeholders.'],
        },
      ],
    };

    assert.deepEqual(workExperienceCapabilitySections(experience), experience.capability_sections);
    const parts = renderedResumeTextParts({
      work_experience: [experience],
      education: [],
      skills: {},
    }, {});
    assert.equal(parts.includes('Data Platform Modernization'), true);
    assert.equal(parts.includes(experience.capability_sections[0].bullets[0]), true);
  });

  it('continues to flatten legacy structured projects into ATS-safe bullets', () => {
    const experience = {
      ...reefPointExperience,
      projects: [{
        name: 'Data Platform Modernization',
        description: 'Modernized data workflows.',
        bullets: ['Modernized batch ingestion workflows.'],
      }],
      bullets: undefined,
    };

    assert.deepEqual(
      workExperienceProjects(experience).map(({ name, description, bullets }) => ({ name, description, bullets })),
      experience.projects,
    );
    assert.deepEqual(workExperienceBullets(experience), ['Modernized batch ingestion workflows.']);
  });

  it('uses the supplied senior technical resume tailoring prompt', () => {
    const prompt = buildResumePrompt('Senior Data Engineer role', 'Brief profile');

    assert.match(prompt, /You are an expert technical resume generator for senior software, AI, ML, platform, SRE/);
    assert.match(prompt, /Aim for roughly 85 to 90 percent coverage/);
    assert.match(prompt, /did what, using what, for what, so what\./);
    assert.match(prompt, /you may draft a conservative, realistic metric/);
    assert.match(prompt, /approximately 15 bullets for the most recent company, 10 for the second, 8 for the third, and 6 for the fourth/);
  });

  it('defines a dynamic JSON transport contract for DOCX rendering', () => {
    const prompt = buildResumePrompt('Senior Data Engineer role', 'Senior Data Engineer at ReefPoint Group');

    assert.deepEqual(TAILORED_RESUME_TEXT_FORMAT, { type: 'json_object' });
    assert.match(prompt, /DOCX DELIVERY CONTRACT/);
    assert.match(prompt, /Return only one valid JSON object/);
    assert.match(prompt, /Use direct role-level bullets/);
    assert.match(prompt, /"<JD-relevant category>": \["", ""\]/);
    assert.equal(prompt.indexOf('CANDIDATE INPUT') < prompt.indexOf('TARGET JOB DESCRIPTION'), true);
    assert.equal(prompt.indexOf('TARGET JOB DESCRIPTION') < prompt.indexOf('DOCX DELIVERY CONTRACT'), true);
  });

  it('accepts direct bullets and rejects duplicated grouped bullets', () => {
    assert.doesNotThrow(() => validateGeneratedResume({
      work_experience: [reefPointExperience],
    }));
    assert.throws(
      () => validateGeneratedResume({
        work_experience: [{
          ...reefPointExperience,
          capability_sections: [{ name: 'Data Platform', bullets: ['Improved ingestion.'] }],
        }],
      }),
      /cannot duplicate content across bullets and capability sections/,
    );
  });

  it('creates a DOCX package from the structured resume', async () => {
    const buffer = await renderResumeDocx({
      name: 'Candidate',
      role: 'Senior Data Engineer',
      summary: 'Data engineer with platform experience.',
      work_experience: [reefPointExperience],
      education: [],
      skills: { Languages: ['Python', 'SQL'] },
    }, {});

    assert.equal(Buffer.isBuffer(buffer), true);
    assert.equal(buffer.subarray(0, 2).toString('ascii'), 'PK');
  });
});
