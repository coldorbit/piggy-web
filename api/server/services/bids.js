import { Op, Sequelize } from 'sequelize';
import axios from 'axios';
import { ENV } from '../../env.js';
import { formatJob } from './jobs.js';
import { InputError } from '../utils/errors.js';
import { clean } from '../utils/index.js';

export function buildBidTabQuery({ where, tab, profileId, appliedByUserId = '', JobBid, sequelize }) {
  const tabWhere = { ...where };
  const isDoneTab = tab === 'done';
  const isInterviewsTab = tab === 'interviews';
  const isTailoredTab = tab === 'tailored';
  const order = isInterviewsTab
    ? [
        [{ model: JobBid, as: 'bids' }, 'interviewNextAt', 'ASC'],
        [{ model: JobBid, as: 'bids' }, 'updatedAt', 'DESC'],
      ]
    : isDoneTab
    ? [
        [{ model: JobBid, as: 'bids' }, 'updatedAt', 'DESC'],
        [{ model: JobBid, as: 'bids' }, 'id', 'DESC'],
      ]
    : null;
  const include = [
    {
      model: JobBid,
      as: 'bids',
      required: isDoneTab || isInterviewsTab,
      where: {
        profileId,
        ...(isDoneTab ? { status: { [Op.in]: ['submitted', 'won', 'lost'] } } : {}),
        ...(isInterviewsTab ? { status: 'interviewing' } : {}),
        ...((isDoneTab || isInterviewsTab) && appliedByUserId ? { userId: appliedByUserId } : {}),
      },
    },
  ];

  if (isTailoredTab) {
    tabWhere[Op.and] = [
      ...(Array.isArray(tabWhere[Op.and]) ? tabWhere[Op.and] : []),
      Sequelize.literal(tailoredResumeExistsSql({ profileId, sequelize })),
      {
        [Op.or]: [{ '$bids.id$': { [Op.is]: null } }, { '$bids.status$': 'planned' }],
      },
    ];
  } else if (!isDoneTab && !isInterviewsTab) {
    tabWhere[Op.and] = [
      ...(Array.isArray(tabWhere[Op.and]) ? tabWhere[Op.and] : []),
      Sequelize.literal(`NOT ${tailoredResumeExistsSql({ profileId, sequelize })}`),
      {
        [Op.or]: [{ '$bids.id$': { [Op.is]: null } }, { '$bids.status$': 'planned' }],
      },
    ];
  }

  return { where: tabWhere, include, order };
}

function tailoredResumeExistsSql({ profileId, sequelize }) {
  const escapedProfileId = sequelize.escape(profileId);

  return `EXISTS (
    SELECT 1
    FROM tailored_resumes tailored_resume
    WHERE tailored_resume.job_url = "ScrapedJob"."url"
      AND tailored_resume.status IN ('requested', 'processing', 'ready', 'dead_letter')
      AND tailored_resume.profile_id = ${escapedProfileId}
  )`;
}

export function formatBid(row) {
  return {
    id: row.id,
    userId: row.userId,
    callerUserId: row.callerUserId,
    profileId: row.profileId,
    jobId: row.jobId,
    status: row.status,
    bidAmount: row.bidAmount,
    coverLetter: row.coverLetter,
    notes: row.notes,
    interviewStage: row.interviewStage,
    interviewNextAt: row.interviewNextAt,
    interviewNotes: row.interviewNotes,
    bidAt: row.bidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function formatTailoredResume(row) {
  return {
    id: row.id,
    userId: row.userId,
    profileId: row.profileId,
    jobUrl: row.jobUrl,
    status: row.status,
    filePath: row.filePath,
    readyAt: row.readyAt,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError,
    deadLetterAt: row.deadLetterAt,
    downloadedAt: row.downloadedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function generateTailoredResumeWithService({ job, profile, tailoredResume = null }) {
  try {
    const response = await axios.post(
      `${ENV.TAILOR_SERVICE_URL.replace(/\/+$/, '')}/api/generate`,
      {
        jobDescription: buildTailorJobDescription(job),
        profileResume: profile.resumeText || '',
        profile: profileForTailorService(profile),
        tailoredResumeId: tailoredResume?.id,
        userId: tailoredResume?.userId,
        profileId: profile.id,
        jobUrl: job.url,
      },
      {
        headers: { 'content-type': 'application/json' },
        timeout: 180000,
      },
    );
    const data = response.data || {};
    if (!data.s3Key) {
      throw new InputError('Tailor service did not return an S3 resume key');
    }
    return data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new InputError('Tailor service timed out while generating the resume');
    }
    if (error.response) {
      throw new InputError(error.response.data?.error || `Tailor service failed with ${error.response.status}`);
    }
    throw error;
  }
}

function profileForTailorService(profile) {
  return {
    id: profile.id,
    name: profile.name,
    location: profile.location || '',
    phone: profile.phone || '',
    email: profile.email || '',
    linkedin: profile.linkedin || '',
    years_of_experience: profile.yearsOfExperience || '',
    resume_text: profile.resumeText || '',
  };
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

export async function tailoredResumesForJobs({ TailoredResume, jobs, profileId }) {
  const jobUrls = [...new Set(jobs.map((job) => job.url).filter(Boolean))];
  if (!jobUrls.length) return new Map();

  const rows = await TailoredResume.findAll({
    where: {
      jobUrl: { [Op.in]: jobUrls },
      status: { [Op.in]: ['requested', 'processing', 'ready', 'dead_letter'] },
      profileId,
    },
    order: [
      ['profileId', 'DESC NULLS LAST'],
      ['status', 'ASC'],
      ['updatedAt', 'DESC'],
    ],
  });
  const priority = { ready: 4, processing: 3, requested: 2, dead_letter: 1 };
  const byUrl = new Map();

  for (const row of rows) {
    const current = byUrl.get(row.jobUrl);
    const currentPriority = current ? priority[current.status] || 0 : 0;
    const rowPriority = priority[row.status] || 0;
    if (!current || rowPriority > currentPriority || (rowPriority === currentPriority && row.profileId)) {
      byUrl.set(row.jobUrl, formatTailoredResume(row));
    }
  }

  return byUrl;
}

export function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime = toDosTime(now);
  const dosDate = toDosDate(now);

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, name, data);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(files.length, 8);
  endHeader.writeUInt16LE(files.length, 10);
  endHeader.writeUInt32LE(centralSize, 12);
  endHeader.writeUInt32LE(offset, 16);
  endHeader.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endHeader]);
}

function toDosTime(date) {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function toDosDate(date) {
  return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < CRC_TABLE.length; i += 1) {
  let c = i;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function bidAttributesFromBody(body) {
  const status = clean(body?.status || 'planned');
  const bidAmount = clean(body?.bidAmount);
  const hasCallerUserId = Object.prototype.hasOwnProperty.call(body || {}, 'callerUserId');
  const callerUserId = hasCallerUserId ? clean(body?.callerUserId) : '';
  const interviewStage = normalizeInterviewStage(clean(body?.interviewStage));
  const interviewNextAt = clean(body?.interviewNextAt);
  const allowedInterviewStages = new Set(['', 'screening', 'hiring_manager', 'technical_interview', 'panel', 'behavioral', 'system_design', 'final']);
  const allowedStatuses = new Set(['planned', 'submitted', 'interviewing', 'won', 'lost']);
  const normalizedInterviewStage = status === 'interviewing' && !interviewStage ? 'screening' : interviewStage;

  if (!allowedStatuses.has(status)) throw new InputError('Choose a valid bid status');
  if (bidAmount && Number.isNaN(Number(bidAmount))) throw new InputError('Bid amount must be a number');
  if (callerUserId && Number.isNaN(Number(callerUserId))) throw new InputError('Choose a valid caller');
  if (!allowedInterviewStages.has(normalizedInterviewStage)) throw new InputError('Choose a valid interview stage');
  if (interviewNextAt && Number.isNaN(Date.parse(interviewNextAt))) throw new InputError('Choose a valid interview date');

  return {
    status,
    bidAmount: bidAmount ? Number(bidAmount) : null,
    ...(hasCallerUserId ? { callerUserId: callerUserId ? Number(callerUserId) : null } : {}),
    coverLetter: clean(body?.coverLetter) || null,
    notes: clean(body?.notes) || null,
    interviewStage: normalizedInterviewStage || null,
    interviewNextAt: interviewNextAt ? new Date(interviewNextAt) : null,
    interviewNotes: clean(body?.interviewNotes) || null,
  };
}

function normalizeInterviewStage(value) {
  const aliases = {
    recruiter: 'hiring_manager',
    technical: 'technical_interview',
    take_home: 'technical_interview',
    onsite: 'panel',
    offer: 'final',
    follow_up: 'final',
  };
  return aliases[value] || value;
}
