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
import {
  DOCX_JSON_DELIVERY_CONTRACT,
  RESUME_TAILORING_INSTRUCTIONS,
} from './tailoring/resumePrompt.js';

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const RESUME_TEMPLATES = {
  classic: {
    headingColor: '111827',
    nameSize: 36,
    roleSize: 24,
    bodySize: 22,
    metaSize: 22,
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

// Keep the response contract at the API boundary. Prompt instructions alone can
// regress when the resume-writing guidance is edited.
export const TAILORED_RESUME_TEXT_FORMAT = Object.freeze({ type: 'json_object' });

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
      text: { format: TAILORED_RESUME_TEXT_FORMAT },
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
  const candidateInput = String(profileResume || '').trim() || 'No candidate profile was supplied.';
  const targetJobDescription = String(jobDescription || '').trim();

  return `${RESUME_TAILORING_INSTRUCTIONS}

CANDIDATE INPUT

${candidateInput}

TARGET JOB DESCRIPTION

${targetJobDescription}

${DOCX_JSON_DELIVERY_CONTRACT}`;
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
  validateGeneratedResume(data);

  const { r2Key, filename } = buildResumeR2Key(profile, data, '.docx');
  const docxBuffer = await renderResumeDocx(data, profile || {});
  const uploadResult = await uploadResumeToR2(docxBuffer, r2Key, filename);

  console.info('resume_timing stage=docx_and_upload_total elapsed_ms=%s filename=%s', elapsedMs(startedAt), filename);
  return { filename, r2Key, r2: uploadResult, cvData: data };
}

export async function renderResumeDocx(data, profile) {
  const children = [];
  const template = resumeTemplateForContent(data, profile);

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: profile.name || data.name || 'Resume', bold: true, size: template.nameSize })],
    }),
  );
  if (data.role) children.push(centeredText(data.role, template, { bold: true, size: template.roleSize }));
  const contact = contactParagraph(profile, data, template);
  if (contact) children.push(contact);

  addSection(children, 'SUMMARY', template);
  addText(children, data.summary, {}, template);

  addSkillsSection(children, data.skills, template);

  addSection(children, 'PROFESSIONAL EXPERIENCE', template);
  for (const exp of workExperienceEntries(data)) {
    addText(children, workExperienceHeading(exp), { bold: true, before: template.experienceBefore, after: 30 }, template);
    addText(children, workExperienceMetaLine(exp), { size: template.metaSize, after: 60 }, template);
    const capabilitySections = workExperienceCapabilitySections(exp);
    if (capabilitySections.length) {
      for (const section of capabilitySections) {
        addCapabilityHeading(children, section.name, template);
        for (const bullet of section.bullets) addBullet(children, bullet, template);
      }
    } else {
      for (const bullet of workExperienceBullets(exp)) addBullet(children, bullet, template);
    }
    addSpacer(children, template.experienceAfter);
  }

  addSection(children, 'EDUCATION', template);
  for (const ed of data.education || []) {
    addText(children, [ed.degree, ed.area].filter(Boolean).join(', '), { bold: true, after: 40 }, template);
    addText(children, [ed.institution, [ed.start_date, ed.end_date].filter(Boolean).join(' – ')].filter(Boolean).join(' | '), {
      size: template.metaSize,
      after: 80,
    }, template);
  }

  addOptionalResumeSections(children, data, template);

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

function addSkillsSection(children, skills, template) {
  const entries = Object.entries(skills || {}).filter(([, items]) => normalizedList(items).length);
  addSection(children, 'SKILLS', template);
  for (const [label, items] of entries) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: template.metaSize }),
          new TextRun({ text: normalizedList(items).join(', '), size: template.metaSize }),
        ],
      }),
    );
  }
}

function addOptionalResumeSections(children, data, template) {
  const sections = [
    ['CERTIFICATIONS', data.certifications],
    ['PROJECTS', data.projects],
    ['PUBLICATIONS', data.publications],
    ['PATENTS', data.patents],
  ];

  for (const [title, items] of sections) {
    const renderedItems = normalizedList(items).map(optionalResumeItemText).filter(Boolean);
    if (!renderedItems.length) continue;
    addSection(children, title, template);
    for (const item of renderedItems) addBullet(children, item, template);
  }
}

function optionalResumeItemText(item) {
  if (typeof item !== 'object' || item === null) return String(item || '').trim();
  return [item.name || item.title, item.issuer || item.publisher || item.organization, item.date, item.description]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' | ');
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

function addBullet(children, bullet, template) {
  children.push(
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: template.bulletAfter },
      children: [new TextRun({ text: String(bullet || ''), size: template.metaSize })],
    }),
  );
}

function addCapabilityHeading(children, value, template) {
  addText(children, value, { bold: true, before: 40, after: 35, size: template.metaSize }, template);
}

export function workExperienceHeading(exp) {
  const company = String(exp.company || '').trim();
  return [company, workExperienceTitle(exp)].filter(Boolean).join(' | ');
}

export function workExperienceMetaLine(exp) {
  return [workExperienceDisplayPlace(exp), workExperienceDateRange(exp)].filter(Boolean).join(' | ');
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

function normalizedWorkMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'remote') return 'Remote';
  if (raw === 'onsite' || raw === 'on-site' || raw === 'on site') return 'Onsite';
  if (raw === 'hybrid') return 'Hybrid';
  return '';
}

function workExperienceTitle(exp) {
  return String(exp.position || '').trim();
}

function workExperienceDisplayPlace(exp) {
  const location = String(exp.location || '').trim();
  const workMode = normalizedWorkMode(exp.work_mode);
  if (!location) return workMode;
  if (!workMode || location.toLowerCase().includes(workMode.toLowerCase())) return location;
  return `${location} (${workMode})`;
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

export function workExperienceCapabilitySections(exp) {
  if (!Array.isArray(exp.capability_sections)) return [];
  return exp.capability_sections
    .filter((section) => section && typeof section === 'object' && !Array.isArray(section))
    .map((section) => ({
      name: String(section.name || '').trim(),
      bullets: normalizedList(section.bullets),
    }))
    .filter((section) => section.name && section.bullets.length);
}

export function validateGeneratedResume(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new InputError('Generated resume must be a JSON object');
  }

  for (const [experienceIndex, experience] of workExperienceEntries(data).entries()) {
    const roleLabel = String(experience.company || experience.position || `#${experienceIndex + 1}`).trim();
    const bullets = roleBullets(experience);
    const sections = Array.isArray(experience.capability_sections) ? experience.capability_sections : [];
    if (bullets.length && sections.length) {
      throw new InputError(`Generated work experience ${roleLabel} cannot duplicate content across bullets and capability sections`);
    }
    if (!bullets.length && !sections.length) {
      throw new InputError(`Generated work experience ${roleLabel} requires bullets or capability sections`);
    }
    for (const [sectionIndex, section] of sections.entries()) {
      const validSection = section
        && typeof section === 'object'
        && !Array.isArray(section)
        && String(section.name || '').trim()
        && normalizedList(section.bullets).length;
      if (!validSection) {
        throw new InputError(`Generated capability section #${sectionIndex + 1} for ${roleLabel} requires a name and bullets`);
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
  const bullets = roleBullets(exp);
  if (bullets.length) return bullets;

  const projects = workExperienceProjects(exp);
  if (projects.some((project) => project.structured)) return projects.flatMap((project) => project.bullets);
  const projectBullet = workExperienceProjectBullet(exp);
  return [projectBullet].filter(Boolean);
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
  for (const value of [profile.location, profile.phone, profile.email].filter(Boolean)) {
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

function normalizedList(value) {
  if (!Array.isArray(value)) return value === undefined || value === null || value === '' ? [] : [value];
  return value.map((item) => typeof item === 'string' ? item.trim() : item).filter(Boolean);
}

function addContactSeparator(runs, template = RESUME_TEMPLATES.classic) {
  if (runs.length) runs.push(new TextRun({ text: ' | ', size: template.bodySize }));
}

function resumeTemplateForContent(data, profile) {
  return randomTemplate(['classic', 'modern']);
}

export function renderedResumeTextParts(data, profile) {
  const parts = [
    profile.name || data.name || 'Resume',
    data.role,
    profile.location,
    profile.phone,
    profile.email,
    profile.linkedin || data.linkedin_profile,
    'SUMMARY',
    data.summary,
  ];

  parts.push('SKILLS');
  for (const [label, items] of Object.entries(data.skills || {})) {
    parts.push(label, normalizedList(items).join(', '));
  }

  parts.push('PROFESSIONAL EXPERIENCE');
  for (const exp of workExperienceEntries(data)) {
    parts.push(
      workExperienceHeading(exp),
      workExperienceMetaLine(exp),
    );
    const capabilitySections = workExperienceCapabilitySections(exp);
    if (capabilitySections.length) {
      for (const section of capabilitySections) {
        parts.push(section.name, ...section.bullets);
      }
    } else {
      parts.push(...workExperienceBullets(exp));
    }
  }

  parts.push('EDUCATION');
  for (const ed of data.education || []) {
    const degree = [ed.degree, ed.area].filter(Boolean).join(', ');
    const dates = [ed.start_date, ed.end_date].filter(Boolean).join(' – ');
    parts.push(degree, [ed.institution, dates].filter(Boolean).join(' | '));
  }

  for (const [title, items] of [
    ['CERTIFICATIONS', data.certifications],
    ['PROJECTS', data.projects],
    ['PUBLICATIONS', data.publications],
    ['PATENTS', data.patents],
  ]) {
    const renderedItems = normalizedList(items).map(optionalResumeItemText).filter(Boolean);
    if (renderedItems.length) parts.push(title, ...renderedItems);
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
