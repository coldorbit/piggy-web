import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import PDFDocument from 'pdfkit';
import { ENV } from './env.js';
import { InputError } from './errors.js';

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
  const resumeFile = await generatePdfAndUpload({ generatedResume, profile });

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
        'Infer reasonable professional details for a senior software engineer based on these seeds:',
        'timeframes, measurable achievements, and technologies. Do not infer or rewrite role titles.',
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

Instructions:
- If a full resume/profile is provided, base the output on that content.
- If only a minimal profile is provided, infer durations, accomplishments, metrics, and technologies that fit the candidate level and companies listed.
- Produce experience entries for each company in the profile.
- Never modify existing role titles/positions for companies in the profile; preserve provided titles exactly when available.
- Use achievement bullets of 20-30 words each.
- Include metrics such as counts, quantities, time reductions, performance, speed, accuracy, or financial impact when reasonable.
- Include a single-string "tech" field per experience and an overall "core_skills" string.
- Select 6 exact core skills highly relevant to the job description.
- Summary must be exactly 4 lines and 65 to 70 words.
- Skills should contain more than 7 large area categories with 7-9 specific items each.
- Keep language ATS-friendly, professional, and grammatically perfect.
- Set target_company to the company from the job description. If unavailable, use "Company".
- Set the top-level "role" field to the existing title from the latest company in the profile when available.
- Keep each company's real industry/domain; do not fabricate industry context.
- Output ONLY valid JSON. Do NOT include markdown or explanations.
- The JSON must match this shape:
{
  "name": "",
  "target_company": "",
  "role": "",
  "summary": "",
  "core_skills": "",
  "experience": [
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

async function generatePdfAndUpload({ generatedResume, profile }) {
  const startedAt = performance.now();
  let data;
  try {
    data = JSON.parse(generatedResume);
  } catch (error) {
    throw new InputError(`Generated resume was not valid JSON: ${error.message}`);
  }

  const { s3Key, filename } = buildResumeS3Key(profile, data, '.pdf');
  const pdfBuffer = await renderResumePdf(data, profile || {});
  const uploadResult = await uploadResumeToS3(pdfBuffer, s3Key, filename);

  console.info('resume_timing stage=pdf_and_upload_total elapsed_ms=%s filename=%s', elapsedMs(startedAt), filename);
  return { filename, s3Key, s3: uploadResult };
}

function renderResumePdf(data, profile) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 36, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text(profile.name || data.name || 'Resume', { align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(10)
      .text([profile.location, profile.email, profile.phone, profile.linkedin].filter(Boolean).join(' | '), { align: 'center' });
    if (data.role) doc.moveDown(0.35).font('Helvetica-Bold').fontSize(11).text(data.role, { align: 'center' });

    section(doc, 'Summary');
    paragraph(doc, data.summary);
    section(doc, 'Core Skills');
    paragraph(doc, data.core_skills);

    section(doc, 'Experience');
    for (const exp of data.experience || []) {
      ensureSpace(doc, 100);
      doc.font('Helvetica-Bold').fontSize(10).text(`${exp.position || ''}${exp.company ? ` | ${exp.company}` : ''}`);
      doc.font('Helvetica').fontSize(9).text([exp.location, [exp.start_date, exp.end_date].filter(Boolean).join(' - ')].filter(Boolean).join(' | '));
      for (const bullet of exp.bullets || []) {
        doc.font('Helvetica').fontSize(9).text(`- ${bullet}`, { indent: 10 });
      }
      if (exp.tech) doc.font('Helvetica-Oblique').fontSize(8.5).text(`Tech stack: ${exp.tech}`);
      doc.moveDown(0.4);
    }

    section(doc, 'Education');
    for (const ed of data.education || []) {
      doc.font('Helvetica-Bold').fontSize(9.5).text([ed.degree, ed.area].filter(Boolean).join(', '));
      doc.font('Helvetica').fontSize(9).text([ed.institution, [ed.start_date, ed.end_date].filter(Boolean).join(' - ')].filter(Boolean).join(' | '));
    }

    section(doc, 'Skills');
    for (const [label, items] of Object.entries(data.skills || {})) {
      doc.font('Helvetica-Bold').fontSize(9).text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(Array.isArray(items) ? items.join(', ') : String(items || ''));
    }

    doc.end();
  });
}

function section(doc, title) {
  ensureSpace(doc, 48);
  doc.moveDown(0.8).font('Helvetica-Bold').fontSize(11).text(title.toUpperCase());
  doc.moveTo(doc.x, doc.y + 2).lineTo(576, doc.y + 2).strokeColor('#333333').lineWidth(0.5).stroke();
  doc.moveDown(0.4);
}

function paragraph(doc, value) {
  doc.font('Helvetica').fontSize(9.5).text(String(value || ''), { lineGap: 1.5 });
}

function ensureSpace(doc, minSpace) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - minSpace) doc.addPage();
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
      ContentType: 'application/pdf',
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
