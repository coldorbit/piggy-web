import { QueryTypes } from 'sequelize';
import {
  getInterviewModel,
  getJobBidModel,
  getLearningCompanyModel,
  getProfileLearningReviewModel,
  getSequelize,
} from '../../../../db.js';
import { ForbiddenError, InputError, NotFoundError } from '../../../utils/errors.js';
import { clean } from '../../../utils/index.js';

export const PROFILE_LEARNING_OUTCOME_REASONS = [
  'company_declined',
  'candidate_withdrew',
  'job_closed',
  'no_response',
  'unknown',
];

export async function listProfileLearningReview({ access, query = {} }) {
  const sequelize = getSequelize();
  const page = positiveInteger(query.page, 1);
  const limit = Math.min(positiveInteger(query.limit, 20), 50);
  const declinedOnly = booleanQueryValue(query.declined);
  const interviewedOnly = booleanQueryValue(query.interviewed);
  const search = clean(query.search).toLowerCase();
  const replacements = {
    profileId: access.profile.id,
    callerUserId: access.user.id,
    declinedOnly,
    interviewedOnly,
    search: search ? `%${search}%` : '',
    limit,
    offset: (page - 1) * limit,
  };
  const baseSql = profileLearningReviewBaseSql(access.isCaller);
  const selectedWhere = `
    (:declinedOnly = false OR review."isDeclined")
    AND (:interviewedOnly = false OR review."interviewScheduled")
    AND (:search = '' OR LOWER(CONCAT_WS(' ', review.title, review.company, review.location, review."applicationNotes", review."interviewNotes")) LIKE :search)
  `;

  const [rows, summaryRows, companies] = await Promise.all([
    sequelize.query(
      `WITH review AS (${baseSql})
       SELECT review.*,
         learning.id::text AS "learningId",
         learning.outcome_reason AS "outcomeReason",
         learning.outcome_at AS "outcomeAt",
         learning.learning_summary AS "learningSummary",
         learning.next_action AS "nextAction",
         learning.updated_at AS "learningUpdatedAt"
       FROM review
       LEFT JOIN profile_learning_reviews learning
         ON learning.profile_id = :profileId
        AND (learning.job_bid_id = review."jobBidId" OR (review."jobBidId" IS NULL AND learning.interview_id = review."interviewId"))
       WHERE ${selectedWhere}
       ORDER BY COALESCE(learning.outcome_at, review."lastInterviewAt", review."updatedAt") DESC NULLS LAST, review."sourceId" DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `WITH review AS (${baseSql})
       SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE review."isDeclined")::int AS declined,
         COUNT(*) FILTER (WHERE review."interviewScheduled")::int AS interviewed,
         COUNT(*) FILTER (WHERE review."isDeclined" AND review."interviewScheduled")::int AS both,
         COUNT(*) FILTER (WHERE NULLIF(TRIM(learning.learning_summary), '') IS NULL)::int AS "needsReview",
         COUNT(*) FILTER (WHERE ${selectedWhere})::int AS "selectedTotal"
       FROM review
       LEFT JOIN profile_learning_reviews learning
         ON learning.profile_id = :profileId
        AND (learning.job_bid_id = review."jobBidId" OR (review."jobBidId" IS NULL AND learning.interview_id = review."interviewId"))`,
      { replacements, type: QueryTypes.SELECT },
    ),
    getLearningCompanyModel().findAll({ attributes: ['id', 'slug', 'name', 'website', 'logoUrl'], raw: true }),
  ]);

  const companiesByName = new Map(companies.map((company) => [normalizeCompanyName(company.name), company]));
  const summary = summaryRows[0] || {};
  return {
    items: rows.map((row) => formatLearningReviewItem(row, companiesByName)),
    page,
    limit,
    total: Number(summary.selectedTotal || 0),
    summary: {
      total: Number(summary.total || 0),
      declined: Number(summary.declined || 0),
      interviewed: Number(summary.interviewed || 0),
      both: Number(summary.both || 0),
      needsReview: Number(summary.needsReview || 0),
    },
  };
}

export async function saveProfileLearningReview({ access, sourceType, sourceId, body = {} }) {
  if (!access.canEdit) throw new ForbiddenError('Only the profile owner or an administrator can save learning notes');
  const source = await learningReviewSource(access.profile.id, sourceType, sourceId);
  const where = source.type === 'bid' ? { jobBidId: source.id } : { interviewId: source.id };
  const [review] = await getProfileLearningReviewModel().findOrCreate({
    where,
    defaults: { profileId: access.profile.id, ...where, updatedByUserId: access.user.id },
  });
  await review.update({
    ...learningReviewAttributes(body),
    profileId: access.profile.id,
    updatedByUserId: access.user.id,
  });
  return formatLearningReview(review);
}

export function learningReviewAttributes(body = {}) {
  const outcomeReason = clean(body.outcomeReason).toLowerCase();
  if (outcomeReason && !PROFILE_LEARNING_OUTCOME_REASONS.includes(outcomeReason)) throw new InputError('Choose a valid outcome reason');
  return {
    outcomeReason: outcomeReason || null,
    outcomeAt: optionalDate(body.outcomeAt, 'Outcome date'),
    learningSummary: boundedText(body.learningSummary, 'Learning summary', 8_000),
    nextAction: boundedText(body.nextAction, 'Next action', 4_000),
  };
}

export function normalizeCompanyName(value) {
  return clean(value).replace(/\s+/g, ' ').toLowerCase();
}

function profileLearningReviewBaseSql(isCaller) {
  const callerBidFilter = isCaller ? 'AND interview.caller_user_id = :callerUserId' : '';
  const callerBidWhere = isCaller ? 'AND interview.id IS NOT NULL' : '';
  const callerInterviewFilter = isCaller ? 'AND interview.caller_user_id = :callerUserId' : '';
  return `
    SELECT
      'bid' AS "sourceType",
      job_bid.id AS "sourceId",
      job_bid.id AS "jobBidId",
      interview.id AS "interviewId",
      job.id AS "jobId",
      COALESCE(NULLIF(job.title, ''), NULLIF(interview.title, ''), 'Untitled role') AS title,
      COALESCE(NULLIF(job.company, ''), NULLIF(interview.company, ''), 'Unknown company') AS company,
      COALESCE(NULLIF(job.location, ''), NULLIF(interview.location, ''), '') AS location,
      COALESCE(NULLIF(job.url, ''), NULLIF(interview.job_url, ''), '') AS "jobUrl",
      job_bid.status AS "applicationStatus",
      interview.status AS "interviewStatus",
      interview.interview_stage AS "interviewStage",
      interview.first_interview_scheduled_at AS "firstInterviewAt",
      interview.interview_next_at AS "nextInterviewAt",
      calls."lastInterviewAt",
      COALESCE(calls."callCount", 0)::int AS "callCount",
      job_bid.notes AS "applicationNotes",
      interview.interview_notes AS "interviewNotes",
      interview.stage_notes AS "stageNotes",
      (job_bid.status = 'lost' OR interview.status = 'lost') AS "isDeclined",
      (interview.id IS NOT NULL AND (interview.first_interview_scheduled_at IS NOT NULL OR interview.interview_next_at IS NOT NULL OR COALESCE(calls."callCount", 0) > 0)) AS "interviewScheduled",
      GREATEST(job_bid.updated_at, interview.updated_at, calls."lastInterviewAt") AS "updatedAt"
    FROM job_bids job_bid
    JOIN scraped_jobs job ON job.id = job_bid.job_id
    LEFT JOIN interviews interview ON interview.job_bid_id = job_bid.id ${callerBidFilter}
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS "callCount", MAX(call.scheduled_at) AS "lastInterviewAt"
      FROM interview_calls call
      WHERE call.interview_id = interview.id
    ) calls ON true
    WHERE job_bid.profile_id = :profileId
      ${callerBidWhere}
      AND (job_bid.status = 'lost' OR interview.status = 'lost' OR interview.first_interview_scheduled_at IS NOT NULL OR interview.interview_next_at IS NOT NULL OR COALESCE(calls."callCount", 0) > 0)

    UNION ALL

    SELECT
      'interview' AS "sourceType",
      interview.id AS "sourceId",
      NULL::bigint AS "jobBidId",
      interview.id AS "interviewId",
      interview.job_id AS "jobId",
      COALESCE(NULLIF(interview.title, ''), 'Untitled role') AS title,
      COALESCE(NULLIF(interview.company, ''), 'Unknown company') AS company,
      COALESCE(NULLIF(interview.location, ''), '') AS location,
      COALESCE(NULLIF(interview.job_url, ''), '') AS "jobUrl",
      NULL::text AS "applicationStatus",
      interview.status AS "interviewStatus",
      interview.interview_stage AS "interviewStage",
      interview.first_interview_scheduled_at AS "firstInterviewAt",
      interview.interview_next_at AS "nextInterviewAt",
      calls."lastInterviewAt",
      COALESCE(calls."callCount", 0)::int AS "callCount",
      NULL::text AS "applicationNotes",
      interview.interview_notes AS "interviewNotes",
      interview.stage_notes AS "stageNotes",
      (interview.status = 'lost') AS "isDeclined",
      (interview.first_interview_scheduled_at IS NOT NULL OR interview.interview_next_at IS NOT NULL OR COALESCE(calls."callCount", 0) > 0) AS "interviewScheduled",
      GREATEST(interview.updated_at, calls."lastInterviewAt") AS "updatedAt"
    FROM interviews interview
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS "callCount", MAX(call.scheduled_at) AS "lastInterviewAt"
      FROM interview_calls call
      WHERE call.interview_id = interview.id
    ) calls ON true
    WHERE interview.profile_id = :profileId
      AND interview.job_bid_id IS NULL
      ${callerInterviewFilter}
      AND (interview.status = 'lost' OR interview.first_interview_scheduled_at IS NOT NULL OR interview.interview_next_at IS NOT NULL OR COALESCE(calls."callCount", 0) > 0)
  `;
}

async function learningReviewSource(profileId, sourceType, sourceId) {
  const id = clean(sourceId);
  if (!id || !['bid', 'interview'].includes(sourceType)) throw new InputError('Choose a valid learning-review item');
  const model = sourceType === 'bid' ? getJobBidModel() : getInterviewModel();
  const source = await model.findOne({ where: { id, profileId, ...(sourceType === 'interview' ? { jobBidId: null } : {}) } });
  if (!source) throw new NotFoundError('Learning-review item not found');
  return { id: source.id, type: sourceType };
}

function formatLearningReviewItem(row, companiesByName) {
  const company = companiesByName.get(normalizeCompanyName(row.company));
  return {
    ...row,
    sourceId: String(row.sourceId),
    jobBidId: row.jobBidId ? String(row.jobBidId) : null,
    interviewId: row.interviewId ? String(row.interviewId) : null,
    jobId: row.jobId ? String(row.jobId) : null,
    callCount: Number(row.callCount || 0),
    isDeclined: Boolean(row.isDeclined),
    interviewScheduled: Boolean(row.interviewScheduled),
    companyDirectory: company ? { id: String(company.id), slug: company.slug, name: company.name, website: company.website || '', logoUrl: company.logoUrl || '' } : null,
  };
}

function formatLearningReview(review) {
  return {
    id: String(review.id),
    outcomeReason: review.outcomeReason || '',
    outcomeAt: review.outcomeAt || null,
    learningSummary: review.learningSummary || '',
    nextAction: review.nextAction || '',
    updatedAt: review.updatedAt,
  };
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function booleanQueryValue(value) {
  return ['1', 'true', 'yes'].includes(clean(value).toLowerCase());
}

function optionalDate(value, label) {
  const text = clean(value);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new InputError(`${label} must be a valid date`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== text) throw new InputError(`${label} must be a valid date`);
  return text;
}

function boundedText(value, label, maxLength) {
  const text = clean(value);
  if (text.length > maxLength) throw new InputError(`${label} must be ${maxLength.toLocaleString()} characters or fewer`);
  return text || null;
}
