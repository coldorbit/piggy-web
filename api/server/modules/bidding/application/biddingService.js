import { Op, Sequelize } from 'sequelize';
import { formatJob } from '../../jobs/application/jobsService.js';
import { clean } from '../../../utils/index.js';
import {
  addLocalDays,
  localDateRange,
  localDayRange,
  localPresetRange,
  normalizeTimeZone,
} from '../../../utils/localTime.js';

const INTERVIEW_DURATION_OPTIONS = new Set([10, 15, 20, 30, 45, 60, 90, 120]);
const DONE_BID_STATUSES = ['submitted', 'needs_follow_up', 'stale', 'blocked', 'won', 'lost'];
const INTERVIEW_BID_STATUSES = ['interviewing', 'won', 'lost'];
const FINISHED_BID_AT_STATUSES = new Set(['submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost']);
const APPLICATION_SUBMITTED_STATUS = 'submitted';
const ACTIVE_TAILORED_RESUME_STATUSES = ['requested', 'processing', 'ready', 'dead_letter'];
const OPEN_BID_STATUSES = ['planned', 'queued', 'tailoring', 'ready'];
export const REVIEW_BID_STATUSES = new Set(['mismatching_bid', 'spam_job']);

export function buildBidTabQuery({ where, tab, profileId, appliedProfileId = '', bidDateRange = null, JobBid, sequelize }) {
  const tabWhere = { ...where };
  const isDoneTab = tab === 'done';
  const isBadWorkTab = tab === 'bad_work';
  const isInterviewsTab = tab === 'interviews';
  const isTailoredTab = tab === 'tailored';
  const order = isInterviewsTab
    ? [
        [{ model: JobBid, as: 'bids' }, 'interviewNextAt', 'ASC'],
        [{ model: JobBid, as: 'bids' }, 'updatedAt', 'DESC'],
      ]
    : isDoneTab || isBadWorkTab
    ? [
        [{ model: JobBid, as: 'bids' }, 'bidAt', 'DESC'],
        [{ model: JobBid, as: 'bids' }, 'id', 'DESC'],
      ]
    : isTailoredTab
    ? tailoredTabOrder({ profileId, sequelize })
    : null;
  const include = [
    {
      model: JobBid,
      as: 'bids',
      required: isDoneTab || isBadWorkTab || isInterviewsTab,
      where: {
        profileId,
        ...(isDoneTab ? { status: { [Op.in]: DONE_BID_STATUSES } } : {}),
        ...(isBadWorkTab ? { status: { [Op.in]: [...REVIEW_BID_STATUSES] } } : {}),
        ...(isInterviewsTab ? { status: { [Op.in]: INTERVIEW_BID_STATUSES } } : {}),
        ...((isDoneTab || isBadWorkTab) && bidDateRange ? bidDateWhere(bidDateRange) : {}),
      },
    },
  ];

  if (appliedProfileId) {
    tabWhere[Op.and] = [
      ...(Array.isArray(tabWhere[Op.and]) ? tabWhere[Op.and] : []),
      Sequelize.literal(appliedProfileExistsSql({ profileId: appliedProfileId, sequelize })),
    ];
  }

  if (isTailoredTab) {
    tabWhere[Op.and] = [
      ...(Array.isArray(tabWhere[Op.and]) ? tabWhere[Op.and] : []),
      Sequelize.literal(tailoredResumeExistsSql({ profileId, sequelize })),
      {
        [Op.or]: [
          { '$bids.id$': { [Op.is]: null } },
          { '$bids.status$': { [Op.in]: OPEN_BID_STATUSES } },
        ],
      },
    ];
  } else if (!isDoneTab && !isBadWorkTab && !isInterviewsTab) {
    tabWhere[Op.and] = [
      ...(Array.isArray(tabWhere[Op.and]) ? tabWhere[Op.and] : []),
      {
        [Op.or]: [{ '$bids.id$': { [Op.is]: null } }, { '$bids.status$': { [Op.in]: OPEN_BID_STATUSES } }],
      },
    ];
  }

  return { where: tabWhere, include, order };
}

function bidDateWhere(range) {
  const bidAt = {};
  if (range.from) bidAt[Op.gte] = range.from;
  if (range.to) bidAt[Op.lt] = range.to;
  return Object.getOwnPropertySymbols(bidAt).length ? { bidAt } : {};
}

function appliedProfileExistsSql({ profileId, sequelize }) {
  const escapedProfileId = sequelize.escape(profileId);

  return `EXISTS (
    SELECT 1
    FROM job_bids applied_bid
    WHERE applied_bid.job_id = "ScrapedJob"."id"
      AND applied_bid.profile_id = ${escapedProfileId}
      AND applied_bid.status IN ('submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost')
  )`;
}

function tailoredResumeExistsSql({ profileId, sequelize }) {
  const escapedProfileId = sequelize.escape(profileId);

  return `EXISTS (
    SELECT 1
    FROM tailored_resumes tailored_resume
    WHERE tailored_resume.job_url = "ScrapedJob"."url"
      AND tailored_resume.status IN (${activeTailoredResumeStatusesSql(sequelize)})
      AND tailored_resume.profile_id = ${escapedProfileId}
  )`;
}

function tailoredTabOrder({ profileId, sequelize }) {
  return [
    [Sequelize.literal(tailoredResumeTimestampSql({ profileId, sequelize, column: 'created_at' })), 'DESC NULLS LAST'],
    [Sequelize.literal(tailoredResumeTimestampSql({ profileId, sequelize, column: 'updated_at' })), 'DESC NULLS LAST'],
    ['id', 'DESC'],
  ];
}

function tailoredResumeTimestampSql({ profileId, sequelize, column }) {
  const escapedProfileId = sequelize.escape(profileId);

  return `(
    SELECT MAX(tailored_resume.${column})
    FROM tailored_resumes tailored_resume
    WHERE tailored_resume.job_url = "ScrapedJob"."url"
      AND tailored_resume.status IN (${activeTailoredResumeStatusesSql(sequelize)})
      AND tailored_resume.profile_id = ${escapedProfileId}
  )`;
}

function activeTailoredResumeStatusesSql(sequelize) {
  return ACTIVE_TAILORED_RESUME_STATUSES.map((status) => sequelize.escape(status)).join(', ');
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
    interviewAt: row.interviewAt,
    interviewNextAt: row.interviewNextAt,
    interviewDurationMinutes: row.interviewDurationMinutes || 60,
    interviewNotes: row.interviewNotes,
    stageMeetingLinks: row.stageMeetingLinks || {},
    bidAt: row.bidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function shouldRefreshBidAtForStatus(nextStatus, previousStatus) {
  return nextStatus === APPLICATION_SUBMITTED_STATUS && !FINISHED_BID_AT_STATUSES.has(previousStatus);
}

export function shouldSetInterviewAtForStatus(nextStatus, previousStatus, currentInterviewAt) {
  return nextStatus === 'interviewing' && previousStatus !== 'interviewing' && !currentInterviewAt;
}

export function dailyGoalRangeForBidFilter(filters = {}, now = new Date()) {
  return dailyGoalRangeForUserBidFilter(filters, {}, now);
}

export function dailyGoalRangeForUserBidFilter(filters = {}, user = {}, now = new Date()) {
  const timeZone = normalizeTimeZone(user?.timezone);
  const since = clean(filters.since || 'today');
  if (since === 'until_yesterday') return localPresetRange('yesterday', now, { timeZone });
  if (since === 'through_today') return localPresetRange('today', now, { timeZone });
  if (since === 'custom') return customGoalRange(filters, timeZone) || localDayRange(now, { timeZone });
  return localPresetRange(since, now, { timeZone }) || localDayRange(now, { timeZone });
}

function customGoalRange(filters, timeZone) {
  const from = localDateRange(filters.dateFrom, { timeZone })?.from || null;
  const toStart = localDateRange(filters.dateTo, { timeZone })?.from || null;
  if (!from && !toStart) return null;
  const to = toStart ? addLocalDays(toStart, 1, { timeZone }) : addLocalDays(from, 1, { timeZone });
  return { from: from || toStart, to };
}

export function formatTailoredResume(row) {
  return {
    id: row.id,
    userId: row.userId,
    profileId: row.profileId,
    jobUrl: row.jobUrl,
    requestType: row.requestType || 'job',
    manualCompany: row.manualCompany,
    manualRole: row.manualRole,
    manualJobDescription: row.manualJobDescription,
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

export async function tailoredResumesForJobs({ TailoredResume, jobs, profileId }) {
  const jobUrls = [...new Set(jobs.map((job) => job.url).filter(Boolean))];
  if (!jobUrls.length) return new Map();

  const rows = await TailoredResume.findAll({
    where: {
      jobUrl: { [Op.in]: jobUrls },
      status: { [Op.in]: ACTIVE_TAILORED_RESUME_STATUSES },
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
  const hasInterviewDuration = Object.prototype.hasOwnProperty.call(body || {}, 'interviewDurationMinutes')
    || Object.prototype.hasOwnProperty.call(body || {}, 'interviewDuration');
  const interviewDurationMinutes = hasInterviewDuration ? clean(body?.interviewDurationMinutes || body?.interviewDuration) : '';
  const hasInterviewNotes = Object.prototype.hasOwnProperty.call(body || {}, 'interviewNotes');
  const stageNotes = normalizeStageNotes(body?.stageNotes);
  const hasStageMeetingLinks = Object.prototype.hasOwnProperty.call(body || {}, 'stageMeetingLinks');
  const hasInterviewMeetingLink = Object.prototype.hasOwnProperty.call(body || {}, 'interviewMeetingLink')
    || Object.prototype.hasOwnProperty.call(body || {}, 'meetingLink');
  const stageMeetingLinks = hasStageMeetingLinks ? normalizeStageMeetingLinks(body?.stageMeetingLinks) : {};
  const interviewMeetingLink = hasInterviewMeetingLink ? clean(body?.interviewMeetingLink || body?.meetingLink) : undefined;
  const allowedInterviewStages = new Set(['', 'todo', 'screening', 'hiring_manager', 'technical_interview', 'panel', 'behavioral', 'system_design', 'final']);
  const allowedStatuses = new Set([
    'planned',
    'queued',
    'tailoring',
    'ready',
    'submitted',
    'needs_follow_up',
    'stale',
    'blocked',
    'interviewing',
    'won',
    'lost',
    ...REVIEW_BID_STATUSES,
  ]);
  const normalizedInterviewStage = status === 'interviewing' && !interviewStage ? 'todo' : interviewStage;

  if (!allowedStatuses.has(status)) throw new InputError('Choose a valid bid status');
  if (bidAmount && Number.isNaN(Number(bidAmount))) throw new InputError('Bid amount must be a number');
  if (callerUserId && Number.isNaN(Number(callerUserId))) throw new InputError('Choose a valid caller');
  if (!allowedInterviewStages.has(normalizedInterviewStage)) throw new InputError('Choose a valid interview stage');
  if (Object.keys(stageNotes).some((stage) => !allowedInterviewStages.has(stage) || !stage)) throw new InputError('Choose a valid interview stage');
  if (Object.keys(stageMeetingLinks).some((stage) => !allowedInterviewStages.has(stage) || !stage)) throw new InputError('Choose a valid interview stage');
  if (interviewNextAt && Number.isNaN(Date.parse(interviewNextAt))) throw new InputError('Choose a valid interview date');
  if (interviewDurationMinutes && !INTERVIEW_DURATION_OPTIONS.has(Number(interviewDurationMinutes))) {
    throw new InputError('Choose a valid interview duration');
  }
  if (Object.values(stageMeetingLinks).some((url) => !validHttpUrl(url)) || (interviewMeetingLink && !validHttpUrl(interviewMeetingLink))) {
    throw new InputError('Meeting link must be a valid URL');
  }

  return {
    status,
    bidAmount: bidAmount ? Number(bidAmount) : null,
    ...(hasCallerUserId ? { callerUserId: callerUserId ? Number(callerUserId) : null } : {}),
    coverLetter: clean(body?.coverLetter) || null,
    notes: clean(body?.notes) || null,
    interviewStage: normalizedInterviewStage || null,
    interviewNextAt: interviewNextAt ? new Date(interviewNextAt) : null,
    ...(hasInterviewDuration ? { interviewDurationMinutes: interviewDurationMinutes ? Number(interviewDurationMinutes) : 60 } : {}),
    interviewNotes: clean(body?.interviewNotes) || null,
    hasInterviewNotes,
    stageNotes,
    ...(hasStageMeetingLinks ? { stageMeetingLinks } : {}),
    ...(hasInterviewMeetingLink ? { interviewMeetingLink } : {}),
  };
}

function normalizeStageNotes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([stage, note]) => [normalizeInterviewStage(clean(stage)), clean(note)])
      .filter(([stage, note]) => stage && note),
  );
}

function normalizeStageMeetingLinks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([stage, url]) => [normalizeInterviewStage(clean(stage)), clean(url)])
      .filter(([stage, url]) => stage && url),
  );
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
