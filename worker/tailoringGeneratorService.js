import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let openaiClient;
let s3Client;

export async function generateTailoredResume({ job, profile }) {
  if (!ENV.OPENAI_API_KEY) {
    throw new InputError('OPENAI_API_KEY is required to generate tailored resumes');
  }
  if (!ENV.AWS_S3_BUCKET) {
    throw new InputError('AWS_S3_BUCKET is required to store tailored resumes');
  }

  const jobDescription = buildTailorJobDescription(job);
  const profileResume = profile.resumeText || '';
  const generatedResume = await generateResumeJson({ jobDescription, profileResume });
  const resumeFile = await generateDocxAndUpload({ generatedResume, profile });

  return {
    generatedResume,
    filename: resumeFile.filename,
    s3Key: resumeFile.s3Key,
    s3Bucket: ENV.AWS_S3_BUCKET,
    s3: resumeFile.s3,
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

function buildResumePrompt(jobDescription, profileResume) {
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

Hard truthfulness rules:
- NEVER fabricate previous roles, previous titles, promotions, seniority, employers, education, certifications, dates, or employment history.
- Preserve every provided company and work experience position/title exactly as written. Do not change "Developer" into "Senior Developer", "Lead", "Architect", "Manager", or any other title unless that exact title is present in the profile.
- Every work_experience entry must show a visible "position". If a role/title is provided in the profile, copy it exactly. If no role/title is provided, use "Role not provided" and do not invent a title.
- You may tailor wording, achievements, metrics, and technology emphasis only when they remain plausible for the provided role/company and do not imply a different title or responsibility level.
- The top-level "role" field is the target resume headline. It may match the exact job-posting title for ATS visibility, but it must not be used as a previous experience title unless the profile already has that title.
- Do not backdate technologies. Before adding any technology, tool, framework, model, API, platform, or vendor to a work_experience bullet or "tech" field, verify it plausibly existed and was publicly usable during that role's start/end dates and fits that role's domain. If unsure, omit it from that work_experience entry.
- Newer target-job keywords may appear in Summary, Core Skills, or Skills when they reflect current candidate positioning, but do not place them inside older work_experience entries unless the profile explicitly supports that usage.

ATS optimization rules:
- Match the exact job title from the posting in the top-level "role" field when available.
- Weave in 25-35 relevant, role-specific keywords copied exactly from the job description across summary, core_skills, bullets, tech, and skills, while respecting historical validity for work_experience.
- Do not keyword-stuff, hide keywords, repeat unnatural keyword lists, or add irrelevant terms.
- Prefer exact terms from the job description over synonyms or abbreviations unless the posting itself uses the abbreviation.
- Use standard resume section concepts only: Summary, Core Skills, Work Experience, Education, Skills.
- Use plain text content only: no icons, emojis, decorative symbols, tables, columns, headers, footers, or graphics.
- Use consistent date formatting everywhere: "Month Year" or "Present" for current roles.
- Preserve the provided LinkedIn profile as an actual URL in "linkedin_profile". Use the display format "linkedin.com/in/profile-slug". If no LinkedIn profile is provided, leave it blank. Never invent a LinkedIn URL.
- Normalize noisy target job titles before setting the top-level "role": remove locations, remote/hybrid tags, agency/recruiter names, team names, department labels, requisition IDs, contract labels, and parenthetical clutter. Keep the plain role name commonly used in job postings, such as "Software Engineer", "Senior Data Engineer", or "Product Manager".

Instructions:
- If a full resume/profile is provided, base the output on that content.
- If only a minimal profile is provided, infer accomplishment framing, metrics, and technologies that fit the provided companies and explicitly provided roles. Do not infer previous roles/titles.
- Produce work_experience entries for each company in the profile.
- Never modify existing role titles/positions for companies in the profile; preserve provided titles exactly when available.
- Use achievement bullets of 20-30 words each.
- Include metrics such as counts, quantities, time reductions, performance, speed, accuracy, or financial impact when reasonable.
- Include a single-string "tech" field per work experience and an overall "core_skills" string. Each work_experience "tech" field must contain only technologies valid for that role's dates and context.
- Select 6 exact core skills highly relevant to the job description, using exact job-posting language where possible.
- Summary must be exactly 4 lines and 65 to 70 words.
- Skills should contain more than 7 large area categories with 7-9 specific items each.
- Keep language ATS-friendly, professional, and grammatically perfect.
- Set target_company to the company from the job description. If unavailable, use "Company".
- Set the top-level "role" field to the cleaned, plain role name from the job description when available. Use the exact posting title only when it is already a clean role name; otherwise remove location, agency, team, department, contract, and requisition clutter.
- Keep each company's real industry/domain; do not fabricate industry context.
- Output ONLY valid JSON. Do NOT include markdown or explanations.
- The JSON must match this shape:
{
  "name": "",
  "target_company": "",
  "role": "",
  "linkedin_profile": "",
  "summary": "",
  "core_skills": "",
  "work_experience": [
    {
      "company": "",
      "location": "",
      "position": "",
      "start_date": "",
      "end_date": "",
      "bullets": ["", ""],
      "tech": ""
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
    "Programming Languages": ["", ""],
    "Frameworks": ["", ""],
    "Tools": ["", ""]
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

  const { s3Key, filename } = buildResumeS3Key(profile, data, '.docx');
  const docxBuffer = await renderResumeDocx(data, profile || {});
  const uploadResult = await uploadResumeToS3(docxBuffer, s3Key, filename);

  console.info('resume_timing stage=docx_and_upload_total elapsed_ms=%s filename=%s', elapsedMs(startedAt), filename);
  return { filename, s3Key, s3: uploadResult };
}

async function renderResumeDocx(data, profile) {
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: profile.name || data.name || 'Resume', bold: true, size: 32 })],
    }),
  );
  const contact = contactParagraph(profile, data);
  if (contact) children.push(contact);
  if (data.role) children.push(centeredText(data.role, { bold: true, size: 22, after: 160 }));

  addSection(children, 'Summary');
  addText(children, data.summary);
  addSection(children, 'Core Skills');
  addText(children, data.core_skills);

  addSection(children, 'Work Experience');
  for (const exp of workExperienceEntries(data)) {
    const position = String(exp.position || '').trim() || 'Role not provided';
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({ text: position, bold: true }),
          ...(exp.company ? [new TextRun({ text: ` | ${exp.company}`, bold: true })] : []),
        ],
      }),
    );
    addText(children, [exp.location, [exp.start_date, exp.end_date].filter(Boolean).join(' - ')].filter(Boolean).join(' | '), {
      size: 19,
      after: 60,
    });
    for (const bullet of exp.bullets || []) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 50 },
          children: [new TextRun({ text: String(bullet || ''), size: 19 })],
        }),
      );
    }
    if (exp.tech) addText(children, `Tech stack: ${exp.tech}`, { italics: true, size: 18, after: 100 });
  }

  addSection(children, 'Education');
  for (const ed of data.education || []) {
    addText(children, [ed.degree, ed.area].filter(Boolean).join(', '), { bold: true, after: 40 });
    addText(children, [ed.institution, [ed.start_date, ed.end_date].filter(Boolean).join(' - ')].filter(Boolean).join(' | '), {
      size: 19,
      after: 80,
    });
  }

  addSection(children, 'Skills');
  for (const [label, items] of Object.entries(data.skills || {})) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 19 }),
          new TextRun({ text: Array.isArray(items) ? items.join(', ') : String(items || ''), size: 19 }),
        ],
      }),
    );
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

function addSection(children, title) {
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 180, after: 80 },
      children: [new TextRun({ text: title, bold: true, size: 22 })],
    }),
  );
}

function addText(children, value, { after = 100, bold = false, italics = false, size = 20 } = {}) {
  if (!value) return;
  children.push(
    new Paragraph({
      spacing: { after },
      children: [new TextRun({ text: String(value), bold, italics, size })],
    }),
  );
}

function centeredText(value, { after = 80, bold = false, size = 20 } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after },
    children: [new TextRun({ text: String(value), bold, size })],
  });
}

function contactParagraph(profile, data) {
  const runs = [];
  for (const value of [profile.location, profile.email, profile.phone].filter(Boolean)) {
    addContactSeparator(runs);
    runs.push(new TextRun({ text: String(value), size: 20 }));
  }

  const linkedin = normalizedLinkedInUrl(profile.linkedin || data.linkedin_profile);
  if (linkedin) {
    addContactSeparator(runs);
    runs.push(
      new ExternalHyperlink({
        link: linkedin,
        children: [new TextRun({ text: linkedinDisplayText(linkedin), style: 'Hyperlink', size: 20 })],
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

function addContactSeparator(runs) {
  if (runs.length) runs.push(new TextRun({ text: ' | ', size: 20 }));
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

function buildResumeS3Key(profile, generatedData, extension) {
  const profileFolder = compactPathPart(profile?.name, 'Profile');
  const dateFolder = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const role = generatedData.role || 'Resume';
  const company = generatedData.target_company || inferCompanyFromGeneratedName(generatedData.name, role);
  const filename = `${filenamePathPart(company, 'Company')}_${filenamePathPart(role, 'Job_Title')}_resume${extension}`;
  return { s3Key: `${profileFolder}/${dateFolder}/${filename}`, filename };
}

async function uploadResumeToS3(buffer, s3Key, filename) {
  const startedAt = performance.now();
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: ENV.AWS_S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: DOCX_CONTENT_TYPE,
      ContentDisposition: `attachment; filename="${filename}"`,
    }),
  );
  const head = await getS3Client().send(new HeadObjectCommand({ Bucket: ENV.AWS_S3_BUCKET, Key: s3Key }));
  console.info('resume_timing stage=s3_upload elapsed_ms=%s size=%s', elapsedMs(startedAt), head.ContentLength);
  return {
    bucket: ENV.AWS_S3_BUCKET,
    key: s3Key,
    uri: `s3://${ENV.AWS_S3_BUCKET}/${s3Key}`,
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

function getS3Client() {
  if (s3Client) return s3Client;
  s3Client = new S3Client({ region: ENV.AWS_REGION });
  return s3Client;
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
