import {
  getAssessmentModel,
  getBidProfileModel,
  getScrapedJobModel,
  getWebUserModel,
} from '../../../../db.js';
import { fn, col } from 'sequelize';
import { clean } from '../../../utils/index.js';
import { ForbiddenError, InputError, NotFoundError } from '../../../utils/errors.js';
import { ASSESSMENT_ACCESS_ROLES, isAdminRole } from '../../../utils/roles.js';
import { validJobUrl, formatJob, publicJobIdFromId } from '../../jobs/application/jobsService.js';
import {
  accessibleProfile,
  formatProfile,
  profilesManagedByUser,
  profilesVisibleToUser,
  profilesWithSharing,
  sortProfilesForDisplay,
} from '../../bidding/application/profilesService.js';

export const ASSESSMENT_CATEGORIES = [
  { value: 'coding', label: 'Coding' },
  { value: 'technical', label: 'Technical' },
  { value: 'take_home', label: 'Take-home' },
  { value: 'aptitude', label: 'Aptitude' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'language', label: 'Language' },
  { value: 'personality', label: 'Personality' },
  { value: 'other', label: 'Other' },
];

const ASSESSMENT_CATEGORY_VALUES = new Set(ASSESSMENT_CATEGORIES.map((category) => category.value));

export function assessmentAttributesFromBody(body = {}) {
  const profileId = clean(body.profileId);
  const assessmentLink = clean(body.assessmentLink || body.link || body.url);
  const category = assessmentCategoryFromBody(body.category);
  const jobId = clean(body.jobId || body.scrapedJobId);
  const expiresAt = optionalDateFromBody(body.expiresAt || body.expiryTime || body.expiryAt, 'Expiry time');

  if (!profileId) throw new InputError('Profile is required');
  if (!assessmentLink) throw new InputError('Assessment link is required');
  if (!validJobUrl(assessmentLink)) throw new InputError('Enter a valid http or https assessment link');

  return {
    profileId,
    jobId: jobId || null,
    category,
    assessmentLink,
    expiresAt,
  };
}

export function assessmentCategoryFromBody(value) {
  const category = clean(value || '').toLowerCase().replace(/[-\s]+/g, '_');
  if (!category) throw new InputError('Assessment category is required');
  if (!ASSESSMENT_CATEGORY_VALUES.has(category)) throw new InputError('Choose a valid assessment category');
  return category;
}

export function ensureAssessmentAccess(user) {
  if (!ASSESSMENT_ACCESS_ROLES.includes(user?.role)) throw new ForbiddenError('Assessment access required');
}

export async function assessmentProfilesForUser(user) {
  ensureAssessmentAccess(user);
  const Assessment = getAssessmentModel();
  const profiles = isAdminRole(user) ? await profilesManagedByUser(user) : await profilesVisibleToUser(user);
  const activeProfiles = sortProfilesForDisplay(await profilesWithSharing(profiles))
    .filter((profile) => (profile.profileStatus || 'active') === 'active');
  const profileIds = activeProfiles.map((profile) => profile.id);

  const countRows = profileIds.length
    ? await Assessment.findAll({
        attributes: ['profileId', [fn('COUNT', col('id')), 'assessmentCount']],
        where: { profileId: profileIds },
        group: ['profileId'],
        raw: true,
      })
    : [];
  const countsByProfileId = new Map(countRows.map((row) => [String(row.profileId), Number(row.assessmentCount || 0)]));

  return activeProfiles.map((profile) => ({
    ...formatProfile(profile),
    assessmentCount: countsByProfileId.get(String(profile.id)) || 0,
  }));
}

export async function assessmentsForProfile(user, profileId) {
  ensureAssessmentAccess(user);
  const profile = await assessmentProfileForUser(user, profileId);
  const Assessment = getAssessmentModel();
  const rows = await Assessment.findAll({
    where: { profileId: profile.id },
    include: assessmentIncludes(),
    order: [
      ['expiresAt', 'ASC NULLS LAST'],
      ['createdAt', 'DESC'],
    ],
  });

  return {
    profile: formatProfile(profile),
    assessments: rows.map(formatAssessment),
  };
}

export async function createAssessmentForUser(user, body) {
  ensureAssessmentAccess(user);
  const attrs = assessmentAttributesFromBody(body);
  const profile = await assessmentProfileForUser(user, attrs.profileId);
  ensureActiveProfile(profile);
  const job = attrs.jobId ? await assessmentJob(attrs.jobId) : null;
  if (attrs.jobId && !job) throw new NotFoundError('Job not found');

  const assessment = await getAssessmentModel().create({
    profileId: profile.id,
    userId: user.id,
    jobId: job?.id || null,
    category: attrs.category,
    assessmentLink: attrs.assessmentLink,
    expiresAt: attrs.expiresAt,
  });

  const row = await getAssessmentModel().findByPk(assessment.id, { include: assessmentIncludes() });
  return formatAssessment(row || assessment);
}

export async function deleteAssessmentForUser(user, assessmentId) {
  ensureAssessmentAccess(user);
  const assessment = await getAssessmentModel().findByPk(clean(assessmentId), {
    include: [{ model: getBidProfileModel(), as: 'profile', required: false }],
  });
  if (!assessment) throw new NotFoundError('Assessment not found');

  const profile = await assessmentProfileForUser(user, assessment.profileId);
  if (!canDeleteAssessment(user, assessment, profile)) throw new ForbiddenError('You cannot delete this assessment');

  await assessment.destroy();
  return { ok: true };
}

export function formatAssessment(row) {
  const expiresAt = row.expiresAt ? new Date(row.expiresAt).toISOString() : null;
  return {
    id: row.id,
    profileId: row.profileId,
    userId: row.userId,
    jobId: row.jobId,
    category: row.category,
    categoryLabel: categoryLabel(row.category),
    assessmentLink: row.assessmentLink,
    expiresAt,
    status: expiresAt && Date.parse(expiresAt) <= Date.now() ? 'expired' : 'active',
    job: row.job ? formatAssessmentJob(row.job) : null,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          username: row.createdBy.username,
          role: row.createdBy.role,
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function optionalDateFromBody(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new InputError(`${label} must be a valid date and time`);
  return date;
}

async function assessmentProfileForUser(user, profileId) {
  if (isAdminRole(user)) {
    const id = clean(profileId);
    if (!id) throw new InputError('Profile is required');
    const profile = await getBidProfileModel().findByPk(id);
    if (!profile) throw new NotFoundError('Profile not found');
    return profile;
  }

  return accessibleProfile({ user }, profileId);
}

function ensureActiveProfile(profile) {
  if ((profile.profileStatus || 'active') !== 'active') throw new InputError('Choose an active profile');
}

async function assessmentJob(value) {
  const id = clean(value);
  if (!id) return null;
  const ScrapedJob = getScrapedJobModel();
  if (/^\d+$/.test(id)) return ScrapedJob.findByPk(id);
  return ScrapedJob.findOne({ where: { publicJobId: id.toUpperCase() } });
}

function assessmentIncludes() {
  return [
    { model: getBidProfileModel(), as: 'profile', required: false },
    { model: getScrapedJobModel(), as: 'job', required: false },
    { model: getWebUserModel(), as: 'createdBy', required: false },
  ];
}

function formatAssessmentJob(row) {
  const job = formatJob(row, { includeRawJob: false });
  return {
    id: job.id,
    publicJobId: job.publicJobId || publicJobIdFromId(job.id),
    title: job.title,
    company: job.company,
    location: job.location,
    category: job.category,
    url: job.url,
    source: job.source,
    scrapedAt: job.scrapedAt,
  };
}

function categoryLabel(value) {
  return ASSESSMENT_CATEGORIES.find((category) => category.value === value)?.label || value || 'Assessment';
}

function canDeleteAssessment(user, assessment, profile) {
  if (isAdminRole(user)) return true;
  return String(assessment.userId) === String(user.id) || String(profile.userId) === String(user.id);
}
