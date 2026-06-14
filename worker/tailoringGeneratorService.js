import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  PositionalTab,
  PositionalTabAlignment,
  PositionalTabLeader,
  PositionalTabRelativeTo,
  TextRun,
} from 'docx';
import OpenAI from 'openai';
import { ENV } from './env.js';
import { InputError } from './errors.js';

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
- You may slightly adjust technology emphasis or include adjacent technical stacks from the JD when they plausibly fit the candidate's role, dates, domain, and existing profile evidence. Do not invent business workflows, product ownership, teams, launches, customers, or responsibilities.
- The top-level "role" field is the target resume headline. It may match the exact job-posting title for ATS visibility, but it must not be used as a previous experience title unless the profile already has that title.
- Do not backdate technologies. Before adding any technology, tool, framework, model, API, platform, or vendor to a work_experience bullet or "tech" field, verify it plausibly existed and was publicly usable during that role's start/end dates and fits that role's domain. If unsure, omit it from that work_experience entry.
- Newer target-job keywords may appear in Summary or Skills when they reflect current candidate positioning, but do not place them inside older work_experience entries unless the profile explicitly supports that usage.
- Focus the strongest tailoring on the latest work_experience entry, usually the first or current role. Make that role read as the closest credible match to the JD by emphasizing overlapping systems, product surfaces, tools, scale, collaboration patterns, and domain themes already supported by the profile.
- For the latest company, you may use public company/product context from web search or other verified source material when available to find common ground with the JD, such as product areas, platform capabilities, user workflows, or engineering domains. Use this context only to frame plausible overlap with the candidate's actual role; never claim the candidate worked on a specific product, team, launch, customer, metric, or initiative unless the profile explicitly says so.
- If no verified company/product context is available, tailor only from the profile and JD. Never invent work at the latest company or any previous company.

ATS optimization rules:
- Match the exact job title from the posting in the top-level "role" field when available.
- Weave in 25-35 relevant, role-specific keywords copied exactly from the job description across summary, bullets, tech, and categorized skills, while respecting historical validity for work_experience.
- Do not keyword-stuff, hide keywords, repeat unnatural keyword lists, or add irrelevant terms.
- Prefer exact terms from the job description over synonyms or abbreviations unless the posting itself uses the abbreviation.
- Use standard resume section concepts only: Summary, Work Experience, Education, Skills.
- Use plain text content only: no icons, emojis, decorative symbols, tables, columns, headers, footers, or graphics.
- Use consistent date formatting everywhere: "MMM yyyy" for dates, such as "Jan 2024" or "Sep 2022", and "Present" for current roles. Do not use full month names like "January 2024".
- Preserve the provided LinkedIn profile as an actual URL in "linkedin_profile". If the profile includes any LinkedIn value, you MUST include it in "linkedin_profile" using the display format "linkedin.com/in/profile-slug". If no LinkedIn profile is provided, leave it blank. Never invent a LinkedIn URL.
- Normalize noisy target job titles before setting the top-level "role": remove locations, remote/hybrid tags, agency/recruiter names, team names, department labels, requisition IDs, contract labels, and parenthetical clutter. Keep the plain role name commonly used in job postings, such as "Software Engineer", "Senior Data Engineer", or "Product Manager".

Instructions:
- If a full resume/profile is provided, base the output on that content.
- If only a minimal profile is provided, infer accomplishment framing, metrics, and technologies that fit the provided companies and explicitly provided roles. Do not infer previous roles/titles.
- Produce work_experience entries for each company in the profile.
- Never modify existing role titles/positions for companies in the profile; preserve provided titles exactly when available.
- Use achievement bullets of 20-30 words each.
- Use 9-11 bullets for the latest work_experience entry. Use 6-8 bullets for every other work_experience entry.
- Each work_experience entry must include 1-2 key technical stacks or platforms that are aligned with the JD and historically valid for that role. Put them naturally in bullets and in the "tech" field; avoid dumping every tool into every role.
- The latest work_experience bullets should build the strongest bridge between the JD's technical expertise/stacks and the latest role's actual scope. Prefer wording that highlights common engineering concerns, product-adjacent impact, customer/user workflows, platform quality, reliability, performance, data, integrations, collaboration, and delivery discipline when those are plausible from the profile and JD.
- Previous work_experience entries should be lightly tailored only where the profile clearly supports the skill or responsibility. Do not move new JD-specific work into older roles.
- For each work_experience entry, set "headquarters_location" to the company's headquarters location only when it is provided in the profile or available from verified public/company context. Format US headquarters as "City, ST" using the two-letter state abbreviation, such as "San Francisco, CA" or "New York, NY". Do not include the country. If unavailable, use the provided work location in "location" and leave "headquarters_location" blank.
- For each work_experience entry, set "work_mode" to exactly one of "Remote", "Onsite", or "Hybrid" based on explicit profile/resume evidence. If the profile does not say, infer cautiously from the work location and job context; default to "Remote" only when remote work is clearly implied, otherwise use "Onsite".
- For each work_experience entry, provide exactly 2 "projects" only when they are explicitly named in the profile or can be supported by verified public/company context such as a product, platform, or program area. If exact project names cannot be verified, use concise project-area names grounded in the profile and company context, not invented confidential initiatives.
- Use metrics sparingly and only when plausible. Prefer concrete counts, scale, scope, latency, throughput, team size, systems, users, data volume, or time saved over percentage claims.
- Do not overload work_experience bullets with percentages. Use at most one percentage-style metric per role unless the profile explicitly provides more, because unverifiable percentage claims can look fabricated.
- Include a single-string "tech" field per work experience. Each work_experience "tech" field must contain only technologies valid for that role's dates and context.
- Summary must be exactly 4 lines and 65 to 70 words.
- Do not include a Core Skills section or a core_skills field.
- Skills must be categorized and include more than 7 large area categories with 7-9 specific items each. Use categories such as Frameworks, Languages, Cloud Platforms, Messaging/Queueing, Orchestration, VCS/Project Management, Leadership & Collaboration, Core Competencies, Databases, Observability, Testing, Data/ML, Security, and Developer Tools as relevant to the profile and JD.
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
  "work_experience": [
    {
      "company": "",
      "location": "",
      "headquarters_location": "",
      "position": "",
      "work_mode": "",
      "start_date": "",
      "end_date": "",
      "projects": ["", ""],
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

  const { s3Key, filename } = buildResumeS3Key(profile, data, '.docx');
  const docxBuffer = await renderResumeDocx(data, profile || {});
  const uploadResult = await uploadResumeToS3(docxBuffer, s3Key, filename);

  console.info('resume_timing stage=docx_and_upload_total elapsed_ms=%s filename=%s', elapsedMs(startedAt), filename);
  return { filename, s3Key, s3: uploadResult };
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
    const position = String(exp.position || '').trim() || 'Role not provided';
    const company = String(exp.company || '').trim();
    const location = formatHeadquartersLocation(exp.headquarters_location || exp.location || '');
    const period = [exp.start_date, exp.end_date].filter(Boolean).join(' - ');
    const workMode = normalizedWorkMode(exp.work_mode);
    const roleLine = [position, workMode].filter(Boolean).join(' - ');

    children.push(rightAlignedMetaParagraph(company || position, location, template, { bold: true, before: template.experienceBefore, after: 40 }));
    if (company) children.push(rightAlignedMetaParagraph(roleLine, period, template, { size: template.metaSize, after: 50 }));
    const projects = projectNames(exp);
    if (projects.length) addText(children, `Projects: ${projects.join(', ')}`, { size: template.metaSize, after: 60 }, template);
    for (const bullet of exp.bullets || []) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: template.bulletAfter },
          children: [new TextRun({ text: String(bullet || ''), size: template.metaSize })],
        }),
      );
    }
    if (exp.tech) {
      addText(children, `Tech stack: ${exp.tech}`, { italics: true, size: template.techSize, after: template.experienceAfter }, template);
    } else {
      addSpacer(children, template.experienceAfter);
    }
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

function addText(children, value, { after, bold = false, italics = false, size } = {}, template = RESUME_TEMPLATES.classic) {
  if (!value) return;
  children.push(
    new Paragraph({
      spacing: { after: after ?? template.paragraphAfter },
      children: [new TextRun({ text: String(value), bold, italics, size: size ?? template.bodySize })],
    }),
  );
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

function rightAlignedMetaParagraph(left, right, template, { after = 80, before = 0, bold = false, size } = {}) {
  const children = [new TextRun({ text: String(left || ''), bold, size: size ?? template.bodySize })];
  if (right) {
    children.push(
      new TextRun({
        children: [
          new PositionalTab({
            alignment: PositionalTabAlignment.RIGHT,
            relativeTo: PositionalTabRelativeTo.MARGIN,
            leader: PositionalTabLeader.NONE,
          }),
        ],
      }),
      new TextRun({ text: String(right), bold, size: size ?? template.bodySize }),
    );
  }

  return new Paragraph({
    spacing: { before, after },
    children,
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

function projectNames(exp) {
  const values = Array.isArray(exp.projects) ? exp.projects : Array.isArray(exp.project_names) ? exp.project_names : [];
  return values
    .map((project) => String(project || '').trim())
    .filter(Boolean)
    .slice(0, 2);
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

function renderedResumeTextParts(data, profile) {
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
    parts.push(
      exp.position,
      exp.company,
      exp.location,
      exp.headquarters_location,
      exp.start_date,
      exp.end_date,
      exp.work_mode,
      ...projectNames(exp),
      ...(exp.bullets || []),
      exp.tech ? `Tech stack: ${exp.tech}` : '',
    );
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
