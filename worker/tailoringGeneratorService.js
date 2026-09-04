import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import OpenAI from 'openai';
import { ENV } from './env.js';
import { InputError } from './errors.js';
import { createR2Client, missingR2Configuration } from './storage/r2Client.js';

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const US_STATE_ABBREVIATIONS = new Map([
  ['alabama', 'AL'],
  ['alaska', 'AK'],
  ['arizona', 'AZ'],
  ['arkansas', 'AR'],
  ['california', 'CA'],
  ['colorado', 'CO'],
  ['connecticut', 'CT'],
  ['delaware', 'DE'],
  ['florida', 'FL'],
  ['georgia', 'GA'],
  ['hawaii', 'HI'],
  ['idaho', 'ID'],
  ['illinois', 'IL'],
  ['indiana', 'IN'],
  ['iowa', 'IA'],
  ['kansas', 'KS'],
  ['kentucky', 'KY'],
  ['louisiana', 'LA'],
  ['maine', 'ME'],
  ['maryland', 'MD'],
  ['massachusetts', 'MA'],
  ['michigan', 'MI'],
  ['minnesota', 'MN'],
  ['mississippi', 'MS'],
  ['missouri', 'MO'],
  ['montana', 'MT'],
  ['nebraska', 'NE'],
  ['nevada', 'NV'],
  ['new hampshire', 'NH'],
  ['new jersey', 'NJ'],
  ['new mexico', 'NM'],
  ['new york', 'NY'],
  ['north carolina', 'NC'],
  ['north dakota', 'ND'],
  ['ohio', 'OH'],
  ['oklahoma', 'OK'],
  ['oregon', 'OR'],
  ['pennsylvania', 'PA'],
  ['rhode island', 'RI'],
  ['south carolina', 'SC'],
  ['south dakota', 'SD'],
  ['tennessee', 'TN'],
  ['texas', 'TX'],
  ['utah', 'UT'],
  ['vermont', 'VT'],
  ['virginia', 'VA'],
  ['washington', 'WA'],
  ['west virginia', 'WV'],
  ['wisconsin', 'WI'],
  ['wyoming', 'WY'],
  ['district of columbia', 'DC'],
]);
const RESUME_TEMPLATES = {
  classic: {
    headingColor: '111827',
    nameSize: 36,
    roleSize: 24,
    bodySize: 22,
    metaSize: 22,
    techSize: 22,
    sectionSize: 24,
    margin: 720,
    sectionBefore: 180,
    sectionAfter: 120,
    paragraphAfter: 100,
    bulletAfter: 50,
    experienceBefore: 220,
    experienceAfter: 180,
  },
  modern: {
    headingColor: '1E3A8A',
    nameSize: 38,
    roleSize: 24,
    bodySize: 22,
    metaSize: 22,
    techSize: 22,
    sectionSize: 24,
    margin: 720,
    sectionBefore: 160,
    sectionAfter: 130,
    paragraphAfter: 100,
    bulletAfter: 50,
    experienceBefore: 220,
    experienceAfter: 180,
  },
};

let openaiClient;
let r2Client;

export async function generateTailoredResume({ job, profile }) {
  if (!ENV.OPENAI_API_KEY) {
    throw new InputError('OPENAI_API_KEY is required to generate tailored resumes');
  }
  const missingStorageConfig = missingR2Configuration(ENV);
  if (missingStorageConfig.length) {
    throw new InputError(`${missingStorageConfig.join(', ')} required to store tailored resumes in Cloudflare R2`);
  }

  const jobDescription = buildTailorJobDescription(job);
  const profileResume = profile.resumeText || '';
  const generatedResume = await generateResumeJson({ jobDescription, profileResume });
  const resumeFile = await generateDocxAndUpload({ generatedResume, profile });

  return {
    generatedResume,
    cvData: resumeFile.cvData,
    filename: resumeFile.filename,
    r2Key: resumeFile.r2Key,
    r2Bucket: ENV.R2_BUCKET,
    r2: resumeFile.r2,
  };
}

async function generateResumeJson({ jobDescription, profileResume }) {
  if (!String(jobDescription || '').trim()) {
    throw new InputError('Job description is required to generate a tailored resume');
  }

  const prompt = buildResumePrompt(jobDescription, profileResume);
  const startedAt = performance.now();
  console.info(
    'resume_timing stage=openai_start model=%s prompt_chars=%s job_description_chars=%s profile_resume_chars=%s',
    ENV.OPENAI_MODEL,
    prompt.length,
    String(jobDescription || '').length,
    String(profileResume || '').length,
  );

  try {
    const response = await getOpenAIClient().responses.create({
      model: ENV.OPENAI_MODEL,
      input: prompt,
    });
    const outputText = response.output_text || extractOutputText(response);
    console.info('resume_timing stage=openai elapsed_ms=%s output_chars=%s', elapsedMs(startedAt), outputText.length);
    return outputText;
  } catch (error) {
    if (isOpenAITimeout(error)) {
      throw new InputError('OpenAI request timed out while generating the resume');
    }
    throw error;
  }
}

export function buildResumePrompt(jobDescription, profileResume) {
  let inferNote = '';
  let promptBody;

  if (profileResume && profileResume.trim()) {
    if (profileResume.trim().length < 400) {
      inferNote = [
        'The provided profile is brief (likely only name, years of experience, companies, and education).',
        'Infer reasonable accomplishment framing, measurable impact, and technologies only from these seeds.',
        'Never infer, invent, rewrite, upgrade, or embellish previous role titles or positions.',
        'Do not invent unverifiable company facts; keep achievements plausible and aligned with the job description.\n\n',
      ].join(' ');
    }
    promptBody = `Profile:\n${profileResume}\n\nJob Description:\n${jobDescription || 'N/A'}`;
  } else {
    promptBody = `Job Description:\n${jobDescription}`;
  }

  return `
You are an expert resume writer. Create a full, ATS-friendly resume using the information below.

${inferNote}${promptBody}

- Do not simply rewrite the existing resume or copy JD keywords into bullets. Reconstruct the resume around the strongest truthful professional identity for the target role.
- Internally follow this flow: understand the JD → determine the real capability mix of the role → define the target candidate thesis → extract factual candidate evidence → map evidence to JD requirements → prioritize the latest relevant role → design career progression → build complementary bullets → synchronize Summary, Skills, and Experience → remove weak, redundant, or unsupported claims.
- Never fabricate employers, historical titles, promotions, dates, education, certifications, technologies, projects, metrics, users, customers, teams, ownership, business workflows, regulations, or domain experience.
- Preserve historical company names and role titles exactly as supplied. The target JD title may be used as the resume headline, but never replace a historical title.
- Keep every project, technology, metric, achievement, responsibility, and domain claim under the company and role where it actually occurred. Never move evidence between employers to improve alignment.
- Preserve domain integrity. Fintech does not become healthcare; financial services does not automatically become market data or trading; SaaS does not automatically become ecommerce; healthcare does not automatically mean EHR or HIPAA experience.
- Transfer only real transferable capabilities across domains, such as backend engineering, APIs, distributed systems, data pipelines, ML systems, cloud infrastructure, reliability, observability, security, experimentation, retrieval, or frontend engineering.
- Change the camera angle of a real experience, not the underlying facts.
- Do not backdate technologies. Only place a technology in a historical role when it existed during that period, fits the role/domain, and is supported by the candidate background.
- Do not infer detailed implementation merely because a tool appears in Skills. A listed technology does not justify inventing specific SDKs, collectors, deployment patterns, architectures, schemas, or workflows.
- Do not treat adjacent capabilities as exact equivalents. Observability is not automatically synthetic monitoring; financial transaction systems are not market-data systems; vector search is not automatically RAG; async processing is not automatically real-time streaming.
- Interpret JD requirement logic correctly. When the JD says “X, Y, or Z,” “one of,” “equivalent,” or similar, satisfy it using the candidate’s strongest supported option. Do not force the other alternatives into the resume for ATS.
- If the JD requires C++, Go, or Rust and the candidate strongly supports Go, emphasize Go. Do not add Rust or C++ unless independently supported and useful.
- If a mandatory or preferred requirement is unsupported, do not fake it and do not rename a nearby capability to look equivalent. Strengthen the closest truthful transferable evidence and leave the exact missing requirement unsupported.
- Prefer deep, credible evidence for important supported requirements over shallow mention of every JD technology.
- Analyze the JD as a job, not as a keyword list. Identify the seniority, core responsibilities, mandatory requirements, important supporting skills, nice-to-haves, architecture expectations, product expectations, technical stack, domain requirements, leadership expectations, scale, reliability, performance, stakeholders, and business context.
- Infer the functional composition of the role. Determine how much of the job is backend, frontend, full-stack, AI/ML, data, infrastructure, distributed systems, MLOps, research, evaluation, reliability, product engineering, or leadership.
- Match the resume to the JD’s capability distribution, not merely its keyword distribution.
- If a Senior AI Engineer JD combines LLM/RAG, backend APIs, React, distributed systems, and cloud deployment, the resume should show that mix rather than becoming an AI-only resume.
- If a backend role centers on Go, PostgreSQL, Redis, Kubernetes, third-party APIs, microservices, and high-load systems, prioritize those supported backend capabilities instead of unrelated AI work.
- Internally define one concise target candidate thesis before writing. Summary, Skills, Experience, bullet selection, project grouping, and metrics must all reinforce that same identity.
- Treat Summary as the candidate identity and capability statement, Skills as technical claims and ATS vocabulary, Experience as proof, and metrics as credibility anchors.
- Map the JD to candidate evidence before generating bullets.
- Internally classify JD requirements as:
    - mandatory / role-defining,
    - important supporting,
    - nice-to-have / peripheral,        
    - domain/context requirements.
- Mandatory and role-defining skills should appear in Skills when supported and must have meaningful evidence in Experience.
- Important supporting skills should preferably have at least one contextual Experience proof.
- Peripheral skills may remain in Skills when genuinely supported and when additional bullet space would add little value.
- Never list unsupported JD technologies merely to increase ATS coverage.
- Main-stack technologies should be proven inside bullets. If React, Kubernetes, Go, FastAPI, Spring Boot, Angular, PyTorch, Kafka, RAG, AWS, GCP, PostgreSQL, Redis, or another technology is central to the role, show where and how it was used when candidate evidence supports it.
- Repetition across companies is valuable only when historically true. Do not insert a technology into older roles to create fake years of experience.
- Recency matters more than artificial repetition.
- Make the latest relevant company the primary evidence hub. When supported, it should prove most of the JD’s mandatory technologies, architecture, production maturity, ownership, collaboration, scale, and outcomes.
- The latest role should usually show where the candidate’s previously developed capabilities come together.
- Do not cram every JD keyword into the latest company. Aim for high-density, believable coverage.
- Use older roles to show foundations, continuity, technical progression, increasing scope, and evolution of specialization.
- Do not rewrite every previous company to resemble the target job.
- Preserve believable seniority progression. Early roles should generally emphasize implementation, debugging, experimentation, testing, data/model/component work, and collaboration. Mid-career roles may show service or feature ownership, productionization, system design, and broader execution. Senior/Staff/Lead roles may show architecture, end-to-end ownership, technical direction, cross-team influence, mentoring, standards, reliability, scale, and business impact when supported.
- Never make someone architect or own the entire system in an early-career role merely because the target JD asks for architecture experience.
- Treat generic titles such as Software Engineer, Senior Software Engineer, Staff Software Engineer, Member of Technical Staff, and Application Engineer as broad functional titles. Tailor their factual work toward the JD when supported.
- Treat specialized titles such as Machine Learning Engineer, AI Engineer, MLOps Engineer, Data Engineer, Frontend Engineer, Applied Scientist, Research Scientist, and Data Scientist more conservatively. Preserve their real functional identity while emphasizing relevant transferable work.
- Build a role-aligned bullet portfolio rather than generating bullets independently.
- The full bullet set for a company should collectively resemble the target role’s capability mix.
- Give each bullet a primary proof objective such as architecture, implementation, backend engineering, frontend engineering, AI/ML, data, infrastructure, scale, performance, reliability, security, evaluation, experimentation, product impact, business impact, ownership, or leadership.
- Neighboring bullets should add different evidence. Merge or remove bullets that repeatedly prove the same capability without adding greater scale, another subsystem, stronger technical depth, reliability, impact, or leadership.
- Strong bullets should naturally combine several useful elements: what was built or improved, technology or architecture, problem, scale or complexity, technical decision, and outcome.
- Do not force every bullet into the same sentence pattern.
- Avoid repeatedly writing “Developed X using Y resulting in Z.”
- Technologies must appear inside meaningful engineering context, not keyword dumps.
- Prefer “Built asynchronous Go services using Kafka and Redis for durable processing and recovery across distributed workflows” over “Used Go, Kafka, Redis, Kubernetes.”
- Make bullets technically defensible in an interview. Prefer concrete conversation hooks such as system design, APIs, retrieval, caching, concurrency, async workflows, model serving, tracing, reliability, scaling, deployment, testing, or integration when supported.
- Use metrics selectively, generally around 1–3 meaningful quantitative anchors per company when supported and useful.
- Metrics may represent users, customers, requests/day, transactions/day, data volume, throughput, latency, uptime, cost, revenue, savings, model quality, number of services/models/pipelines, team size, or time saved.
- Do not rely only on percentage metrics.
- Prefer different metric purposes within the same company, such as one scale metric, one performance metric, and one product/business metric.
- Do not repeat the same metric across multiple bullets unless necessary for context.
- Never invent metrics and never output placeholders such as [X%], XX users, [ADD METRIC], TODO, or similar markers. If no credible metric exists, write a strong natural bullet without one.
- Stakeholder emphasis should match the role when supported. Applied ML may emphasize Product, Marketing, Finance, Analytics, or domain experts; MLOps may emphasize Data Science, Data Engineering, Platform, Infrastructure, or SRE; AI Engineering may emphasize Product, Backend, Platform, Security, and ML teams; backend/platform roles may emphasize Product, Infrastructure, SRE, Security, and architecture teams.
- The Summary should sit one abstraction level above Skills.
- Use the Summary to establish seniority, years of experience when useful, target identity, major capability areas, architecture/system scope, production experience, relevant domain strengths, and leadership.
- Do not turn the Summary into a framework list.
- Keep the Summary concise, usually 3–5 lines.
- Build Skills dynamically from the JD and candidate evidence.
- Use categories appropriate to the target role, such as Languages, Backend & APIs, Frontend, Distributed Systems, AI/ML, LLM & Agent Systems, Data & Retrieval, Cloud & Infrastructure, MLOps, Observability, Databases, Testing & Delivery, or Core Competencies.
- Prioritize supported JD-relevant skills and de-emphasize unrelated legacy technologies.
- Do not force a fixed number of skills or categories.
- Optimize for strong ATS coverage using exact JD terminology when it accurately represents real candidate experience.
- Do not target an arbitrary keyword count. Prioritize supported mandatory skills, role-defining technologies, responsibilities, architecture concepts, and relevant domain terminology.
- Do not claim or guarantee a specific ATS score.
- Allocate resume space dynamically using relevance, evidence strength, recency, distinctiveness, tenure, and user-provided bullet limits.
- If the user specifies a bullet budget such as 12 / 10 / 6 / 4, follow it exactly.
- If no bullet budget is supplied, give the most space to the newest highly relevant role and progressively less space to older or less relevant roles.
- If the latest role contains several clearly different supported work areas, group it into concise functional project/capability sections. Do not invent branded or confidential project names.
- Before finalizing, verify whole-resume coherence: Summary claims must be supported by Skills and Experience; major Skills must have contextual proof; the latest role must be the strongest evidence for the target identity; older roles must show believable progression.
- Verify career realism: ownership grows naturally, technologies are historically plausible, specialized titles still match their bullets, domains remain accurate, and every claim can be defended in an interview.    
- Use an ATS-safe, linear, single-column structure with ordinary selectable text and standard section headings.
- Use this structure:
    
NAME  
Target Professional Headline  
City/Region | Phone | Email | LinkedIn

SUMMARY

SKILLS

PROFESSIONAL EXPERIENCE
Company | Role  
Location | MMM yyyy – MMM yyyy  
• Bullets

EDUCATION
Optional Certifications, Projects, Publications, or Patents only when supplied and useful.
- Use Company | Role consistently for experience headings.
- Put Location | Dates on the next line.
- Preserve each real position separately when the candidate had multiple roles at the same company.
- Use consistent MMM yyyy – MMM yyyy dates and use Present only for genuinely current roles.
- Use single-column formatting only.
- Do not use sidebars, tables for primary resume content, text boxes, floating elements, skill bars, charts, decorative timelines, images containing resume text, icon-only contact information, hidden keywords, or manually spaced pseudo-columns.
- Keep critical information in normal body text, not only in headers or footers.
- If all formatting were removed and the resume converted to plain text, it must still read correctly from top to bottom.
- Use concise, technically credible, professional language.
- Avoid generic filler such as “results-driven,” “highly motivated,” “passionate,” “dynamic professional,” or “team player.”
- Avoid exaggerated ownership, corporate filler, keyword stuffing, artificial metrics, repetitive verbs, and repetitive sentence structures.
- Before output, verify that supported mandatory JD requirements are easy to find, main technologies are both listed and proven, the latest role carries the strongest relevant evidence, unsupported requirements have not been fabricated, and no claim depends on visual formatting.
- Return only the completed tailored resume.
- Do not output reasoning, JD analysis, fit scores, ATS scores, competency matrices, evidence maps, missing-skill reports, tailoring notes, warnings, placeholders, or explanations.    
- Perform all analysis, evidence mapping, requirement-gap handling, ATS optimization, and validation internally.
- The JSON must match this shape:
{
  "name": "",
  "target_company": "",
  "role": "",
  "linkedin_profile": "",
  "summary": "",
  "work_experience": [
    {
      "company": "",
      "location": "",
      "headquarters_location": "",
      "position": "",
      "work_mode": "",
      "start_date": "",
      "end_date": "",
      "projects": [
        {
          "name": "",
          "description": "",
          "bullets": ["", ""]
        }
      ]
    }
  ],
  "education": [
    {
      "degree": "",
      "area": "",
      "institution": "",
      "start_date": "",
      "end_date": ""
    }
  ],
  "skills": {
    "Languages": ["", ""],
    "Frameworks": ["", ""],
    "Cloud Platforms": ["", ""],
    "Messaging/Queueing": ["", ""],
    "Orchestration": ["", ""],
    "VCS/Project Management": ["", ""],
    "Leadership & Collaboration": ["", ""],
    "Core Competencies": ["", ""]
  }
}
`;
}

function buildTailorJobDescription(job) {
  const parts = [
    job.title ? `Title: ${job.title}` : '',
    job.company ? `Company: ${job.company}` : '',
    job.location ? `Location: ${job.location}` : '',
    job.listingText || '',
  ].filter(Boolean);

  if (parts.length) return parts.join('\n\n');
  if (job.rawJob) return typeof job.rawJob === 'string' ? job.rawJob : JSON.stringify(job.rawJob, null, 2);
  return [job.title, job.company, job.location].filter(Boolean).join(' - ');
}

async function generateDocxAndUpload({ generatedResume, profile }) {
  const startedAt = performance.now();
  let data;
  try {
    data = JSON.parse(generatedResume);
  } catch (error) {
    throw new InputError(`Generated resume was not valid JSON: ${error.message}`);
  }
  validateGeneratedWorkExperienceProjects(data);

  const { r2Key, filename } = buildResumeR2Key(profile, data, '.docx');
  const docxBuffer = await renderResumeDocx(data, profile || {});
  const uploadResult = await uploadResumeToR2(docxBuffer, r2Key, filename);

  console.info('resume_timing stage=docx_and_upload_total elapsed_ms=%s filename=%s', elapsedMs(startedAt), filename);
  return { filename, r2Key, r2: uploadResult, cvData: data };
}

async function renderResumeDocx(data, profile) {
  const children = [];
  const template = resumeTemplateForContent(data, profile);

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: profile.name || data.name || 'Resume', bold: true, size: template.nameSize })],
    }),
  );
  const contact = contactParagraph(profile, data, template);
  if (contact) children.push(contact);
  if (data.role) children.push(centeredText(data.role, template, { bold: true, size: template.roleSize, after: 160 }));

  addSection(children, 'Summary', template);
  addText(children, data.summary, {}, template);

  addSection(children, 'Work Experience', template);
  for (const exp of workExperienceEntries(data)) {
    const period = workExperienceDateRange(exp);
    const projects = workExperienceProjects(exp);

    addText(children, workExperienceTitle(exp), { bold: true, before: template.experienceBefore, after: 30 }, template);
    addWorkExperienceCompanyLine(children, exp, template);
    addText(children, period, { size: template.metaSize, after: 60 }, template);
    if (projects.some((project) => project.structured)) {
      for (const project of projects) {
        addProjectHeading(children, project, template);
        for (const bullet of project.bullets) addBullet(children, bullet, template);
      }
    } else {
      for (const bullet of workExperienceBullets(exp)) addBullet(children, bullet, template);
    }
    addSpacer(children, template.experienceAfter);
  }

  addSection(children, 'Education', template);
  for (const ed of data.education || []) {
    addText(children, [ed.degree, ed.area].filter(Boolean).join(', '), { bold: true, after: 40 }, template);
    addText(children, [ed.institution, [ed.start_date, ed.end_date].filter(Boolean).join(' - ')].filter(Boolean).join(' | '), {
      size: template.metaSize,
      after: 80,
    }, template);
  }

  addSection(children, 'Skills', template);
  for (const [label, items] of Object.entries(data.skills || {})) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: template.metaSize }),
          new TextRun({ text: Array.isArray(items) ? items.join(', ') : String(items || ''), size: template.metaSize }),
        ],
      }),
    );
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: template.margin, right: template.margin, bottom: template.margin, left: template.margin },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

function addSection(children, title, template) {
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: template.sectionBefore, after: template.sectionAfter },
      children: [new TextRun({ text: title, bold: true, size: template.sectionSize, color: template.headingColor })],
    }),
  );
}

function addText(children, value, { after, before = 0, bold = false, italics = false, size } = {}, template = RESUME_TEMPLATES.classic) {
  if (!value) return;
  children.push(
    new Paragraph({
      spacing: { before, after: after ?? template.paragraphAfter },
      children: [new TextRun({ text: String(value), bold, italics, size: size ?? template.bodySize })],
    }),
  );
}

function addWorkExperienceCompanyLine(children, exp, template) {
  const companyLine = workExperienceCompanyLine(exp);
  if (!companyLine) return;

  children.push(
    new Paragraph({
      spacing: { after: 25 },
      children: [new TextRun({ text: companyLine, bold: true, size: template.metaSize })],
    }),
  );
}

function addProjectHeading(children, project, template) {
  const name = project.name || 'Project';
  const description = project.description ? ` - ${project.description}` : '';
  children.push(
    new Paragraph({
      spacing: { before: 40, after: 35 },
      children: [
        new TextRun({ text: `Project: ${name}`, bold: true, size: template.metaSize }),
        new TextRun({ text: description, italics: true, size: template.metaSize }),
      ],
    }),
  );
}

function addBullet(children, bullet, template) {
  children.push(
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: template.bulletAfter },
      children: [new TextRun({ text: String(bullet || ''), size: template.metaSize })],
    }),
  );
}

export function workExperienceCompanyLine(exp) {
  const company = String(exp.company || '').trim();
  const workPlace = workExperienceDisplayPlace(exp);
  return [company, workPlace].filter(Boolean).join(' - ');
}

function addSpacer(children, after) {
  children.push(
    new Paragraph({
      spacing: { after },
      children: [],
    }),
  );
}

function centeredText(value, template, { after = 80, bold = false, size } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after },
    children: [new TextRun({ text: String(value), bold, size: size ?? template.bodySize })],
  });
}

function formatHeadquartersLocation(value) {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isCountryLocationPart(part));
  if (!parts.length) return '';

  if (parts.length >= 2) {
    const city = parts[0];
    const state = normalizeStateLocationPart(parts[1]);
    return [city, state].filter(Boolean).join(', ');
  }

  return normalizeStateLocationPart(parts[0]);
}

function isCountryLocationPart(value) {
  const normalized = String(value || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return ['united states', 'united states of america', 'usa', 'us', 'u s', 'canada'].includes(normalized);
}

function normalizeStateLocationPart(value) {
  const trimmed = String(value || '').trim();
  const normalized = trimmed.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  return US_STATE_ABBREVIATIONS.get(normalized) || trimmed;
}

function normalizedWorkMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'remote') return 'Remote';
  if (raw === 'onsite' || raw === 'on-site' || raw === 'on site') return 'Onsite';
  if (raw === 'hybrid') return 'Hybrid';
  return '';
}

function workExperienceTitle(exp) {
  return String(exp.position || '').trim() || 'Role not provided';
}

function workExperienceDisplayPlace(exp) {
  const workMode = normalizedWorkMode(exp.work_mode);
  if (workMode) return workMode;

  const location = String(exp.location || '').trim();
  if (!location) return '';

  const formattedLocation = formatHeadquartersLocation(location);
  const formattedHeadquarters = formatHeadquartersLocation(exp.headquarters_location || '');
  if (formattedHeadquarters && formattedLocation.toLowerCase() === formattedHeadquarters.toLowerCase()) return '';

  return location;
}

function workExperienceDateRange(exp) {
  return [exp.start_date, exp.end_date]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' – ');
}

export function workExperienceProjects(exp) {
  const values = Array.isArray(exp.projects) ? exp.projects : Array.isArray(exp.project_names) ? exp.project_names : [];
  return values
    .map(normalizedProject)
    .filter((project) => project.name || project.description || project.bullets.length)
    .slice(0, 3);
}

export function validateGeneratedWorkExperienceProjects(data) {
  for (const [experienceIndex, experience] of workExperienceEntries(data).entries()) {
    const projects = Array.isArray(experience.projects) ? experience.projects : [];
    const roleLabel = String(experience.company || experience.position || `#${experienceIndex + 1}`).trim();

    if (!projects.length || projects.some((project) => !project || typeof project !== 'object' || Array.isArray(project))) {
      throw new InputError(`Generated work experience ${roleLabel} must contain structured projects`);
    }
    if (Array.isArray(experience.bullets) && experience.bullets.length) {
      throw new InputError(`Generated work experience ${roleLabel} must keep bullets inside projects`);
    }

    for (const [projectIndex, project] of projects.entries()) {
      const name = String(project.name || '').trim();
      const description = String(project.description || '').trim();
      const bullets = Array.isArray(project.bullets)
        ? project.bullets.map((bullet) => String(bullet || '').trim()).filter(Boolean)
        : [];
      if (!name || !description || !bullets.length) {
        throw new InputError(`Generated project #${projectIndex + 1} for ${roleLabel} requires a name, description, and bullets`);
      }
    }
  }
}

function normalizedProject(project) {
  if (typeof project === 'string') {
    return {
      name: project.trim(),
      description: '',
      bullets: [],
      structured: false,
    };
  }

  if (!project || typeof project !== 'object') {
    return { name: '', description: '', bullets: [], structured: false };
  }

  return {
    name: String(project.name || project.title || project.project_name || '').trim(),
    description: String(project.description || project.project_description || project.summary || '').trim(),
    bullets: Array.isArray(project.bullets)
      ? project.bullets.map((bullet) => String(bullet || '').trim()).filter(Boolean)
      : [],
    structured: true,
  };
}

function projectNames(exp) {
  return workExperienceProjects(exp)
    .map((project) => project.name)
    .filter(Boolean);
}

function roleBullets(exp) {
  return Array.isArray(exp.bullets)
    ? exp.bullets.map((bullet) => String(bullet || '').trim()).filter(Boolean)
    : [];
}

export function workExperienceBullets(exp) {
  const projects = workExperienceProjects(exp);
  if (projects.some((project) => project.structured)) {
    return projects.flatMap((project) => project.bullets);
  }

  const projectBullet = workExperienceProjectBullet(exp);
  return [
    projectBullet,
    ...roleBullets(exp),
  ].filter(Boolean);
}

function workExperienceProjectBullet(exp) {
  const projects = projectNames(exp);
  if (!projects.length) return '';

  return `Project focus included ${sentenceList(projects)}.`;
}

function sentenceList(values) {
  if (values.length <= 1) return values[0] || '';
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

function contactParagraph(profile, data, template) {
  const runs = [];
  for (const value of [profile.location, profile.email, profile.phone].filter(Boolean)) {
    addContactSeparator(runs, template);
    runs.push(new TextRun({ text: String(value), size: template.bodySize }));
  }

  const linkedin = normalizedLinkedInUrl(profile.linkedin || data.linkedin_profile || linkedinFromProfileResume(profile.resumeText));
  if (linkedin) {
    addContactSeparator(runs, template);
    runs.push(
      new ExternalHyperlink({
        link: linkedin,
        children: [new TextRun({ text: linkedinDisplayText(linkedin), style: 'Hyperlink', size: template.bodySize })],
      }),
    );
  }

  return runs.length
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: runs,
      })
    : null;
}

function addContactSeparator(runs, template = RESUME_TEMPLATES.classic) {
  if (runs.length) runs.push(new TextRun({ text: ' | ', size: template.bodySize }));
}

function resumeTemplateForContent(data, profile) {
  return randomTemplate(['classic', 'modern']);
}

function renderedResumeTextLength(data, profile) {
  return renderedResumeTextParts(data, profile).join(' ').length;
}

export function renderedResumeTextParts(data, profile) {
  const parts = [
    profile.name || data.name || 'Resume',
    profile.location,
    profile.email,
    profile.phone,
    profile.linkedin || data.linkedin_profile,
    data.role,
    'Summary',
    data.summary,
    'Work Experience',
  ];

  for (const exp of workExperienceEntries(data)) {
    const projects = workExperienceProjects(exp);
    parts.push(
      workExperienceTitle(exp),
      workExperienceCompanyLine(exp),
      workExperienceDateRange(exp),
    );
    if (projects.some((project) => project.structured)) {
      for (const project of projects) {
        parts.push(
          `Project: ${project.name || 'Project'}`,
          project.description,
          ...project.bullets,
        );
      }
    } else {
      parts.push(...workExperienceBullets(exp));
    }
  }

  parts.push('Education');
  for (const ed of data.education || []) {
    parts.push(ed.degree, ed.area, ed.institution, ed.start_date, ed.end_date);
  }

  parts.push('Skills');
  for (const [label, items] of Object.entries(data.skills || {})) {
    parts.push(label, Array.isArray(items) ? items.join(', ') : items);
  }

  return parts.filter(Boolean).map(String);
}

function randomTemplate(names) {
  const templates = names.map((name) => RESUME_TEMPLATES[name]).filter(Boolean);
  return templates[Math.floor(Math.random() * templates.length)] || RESUME_TEMPLATES.classic;
}

function linkedinFromProfileResume(value) {
  const match = String(value || '').match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%.-]+\/?/i);
  return match?.[0] || '';
}

function normalizedLinkedInUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : raw.startsWith('/in/')
      ? `https://www.linkedin.com${raw}`
      : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname !== 'linkedin.com' || !url.pathname.startsWith('/in/')) return '';
    url.protocol = 'https:';
    url.hostname = 'www.linkedin.com';
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function linkedinDisplayText(value) {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname}`.replace(/\/$/, '');
  } catch {
    return value;
  }
}

function workExperienceEntries(data) {
  return Array.isArray(data.work_experience) ? data.work_experience : data.experience || [];
}

function buildResumeR2Key(profile, generatedData, extension) {
  const profileFolder = compactPathPart(profile?.name, 'Profile');
  const dateFolder = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const role = generatedData.role || 'Resume';
  const company = generatedData.target_company || inferCompanyFromGeneratedName(generatedData.name, role);
  const filename = `${filenamePathPart(company, 'Company')}_${filenamePathPart(role, 'Job_Title')}_resume${extension}`;
  return { r2Key: `${profileFolder}/${dateFolder}/${filename}`, filename };
}

export async function uploadResumeToR2(
  buffer,
  r2Key,
  filename,
  { client = getR2Client(), bucket = ENV.R2_BUCKET } = {},
) {
  const startedAt = performance.now();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: DOCX_CONTENT_TYPE,
      ContentDisposition: `attachment; filename="${filename}"`,
    }),
  );
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
  console.info('resume_timing stage=r2_upload elapsed_ms=%s size=%s', elapsedMs(startedAt), head.ContentLength);
  return {
    bucket,
    key: r2Key,
    uri: `r2://${bucket}/${r2Key}`,
    size: head.ContentLength,
    etag: String(head.ETag || '').replaceAll('"', ''),
  };
}

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({
    apiKey: ENV.OPENAI_API_KEY,
    timeout: ENV.OPENAI_TIMEOUT_SECONDS * 1000,
  });
  return openaiClient;
}

function getR2Client() {
  if (r2Client) return r2Client;
  r2Client = createR2Client(ENV);
  return r2Client;
}

const compactPathPart = (value, fallback) => String(value || '').replace(/[^A-Za-z0-9]+/g, '') || fallback;

function filenamePathPart(value, fallback) {
  const cleaned = String(value || '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || fallback;
}

function inferCompanyFromGeneratedName(name, role) {
  if (!name) return 'Company';
  let withoutRole = String(name).trim();
  if (role) withoutRole = withoutRole.replace(new RegExp(String(role).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
  withoutRole = withoutRole.replace(/\b\d{1,3}\b/g, '').trim();
  return withoutRole ? withoutRole.split(/\s+/)[0] : String(name).split(/\s+/)[0];
}

function extractOutputText(response) {
  let outputText = '';
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text') outputText += content.text || '';
    }
  }
  return outputText;
}

function isOpenAITimeout(error) {
  return error?.name === 'APIConnectionTimeoutError' || error?.name === 'APITimeoutError' || error?.code === 'ETIMEDOUT';
}

function elapsedMs(startedAt) {
  return Number((performance.now() - startedAt).toFixed(1));
}
