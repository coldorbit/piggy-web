import { literal, Op } from 'sequelize';
import { clean } from '../../../utils/index.js';
import { InputError } from '../../../utils/errors.js';
import { ROLES, isAdminRole } from '../../../utils/roles.js';
import { addLocalDays, localDateRange, localPresetRange, normalizeTimeZone } from '../../../utils/localTime.js';
import { normalizeJobCategory } from './jobImportService.js';
export { capitalizeJobTitle, jobsFromCsv, normalizeJobCategory, planCsvJobImport, validJobUrl } from './jobImportService.js';
const PUBLIC_JOB_ID_PREFIX = 'J';
const PUBLIC_JOB_ID_LENGTH = 8;
const PUBLIC_JOB_ID_BODY_LENGTH = PUBLIC_JOB_ID_LENGTH - PUBLIC_JOB_ID_PREFIX.length;
const PUBLIC_JOB_ID_CAPACITY = 36n ** BigInt(PUBLIC_JOB_ID_BODY_LENGTH);
const JUNIOR_LEVEL_TITLE_PATTERN = [
  '\\mjunior\\M',
  '\\mjr\\M\\.?',
  '\\mentry[-[:space:]]level\\M',
  '\\mnew[-[:space:]]grad(uate)?\\M',
  '\\mintern(ship)?\\M',
  '\\mapprentice\\M',
].join('|');
const CANADA_LOCATION_PATTERN = [
  '\\mcanada\\M',
  '\\mcanadian\\M',
  '\\mtoronto\\M',
  '\\mvancouver\\M',
  '\\mmontreal\\M',
  '\\mottawa\\M',
  '\\mcalgary\\M',
  '\\medmonton\\M',
  '\\mwinnipeg\\M',
  '\\mquebec\\M',
  '\\montario\\M',
  '\\mbritish columbia\\M',
  '\\malberta\\M',
  '\\mmanitoba\\M',
  '\\msaskatchewan\\M',
  '\\mnova scotia\\M',
  '\\mnew brunswick\\M',
  '\\mnewfoundland\\M',
  '\\mlabrador\\M',
  '\\mprince edward island\\M',
  '\\myukon\\M',
  '\\mnunavut\\M',
  '\\mnorthwest territories\\M',
  ',\\s*(can|on|bc|ab|mb|sk|qc|ns|nb|nl|pe|yt|nt|nu)(\\s|,|\\)|/|-|$)',
].join('|');
const US_WORLDWIDE_LOCATION_PATTERN = [
  '\\munited states\\M',
  '\\musa\\M',
  'u\\.s\\.a\\.',
  'u\\.s\\.',
  '\\mus only\\M',
  '\\mremote us\\M',
  '\\mworldwide\\M',
  '\\mglobal\\M',
  '\\manywhere\\M',
  '\\mamericas\\M',
  '\\mnorth america\\M',
  '\\mnew york\\M',
  '\\msan francisco\\M',
  '\\mlos angeles\\M',
  '\\mseattle\\M',
  '\\maustin\\M',
  '\\mboston\\M',
  '\\mchicago\\M',
  '\\mdenver\\M',
  '\\matlanta\\M',
  '\\mdallas\\M',
  '\\mmiami\\M',
  '\\mwashington dc\\M',
  '\\mwashington, dc\\M',
  '\\mcalifornia\\M',
  '\\mtexas\\M',
  '\\mflorida\\M',
  '\\millinois\\M',
  '\\mmassachusetts\\M',
  '\\mgeorgia\\M',
  '\\mcolorado\\M',
  '\\mwashington state\\M',
  '(^|[\\s,(/-])(us|ny|sf|ca|tx|fl|wa|ma|il|ga|co|az|pa|nj|nc|va|mi|oh|or|ut|tn)($|[\\s,)/-])',
].join('|');

export function buildJobQuery(query, { timeZone } = {}) {
  const localTimeZone = normalizeTimeZone(timeZone || query?.timezone);
  const where = {};
  const search = clean(query.search);
  const roleFamily = clean(query.roleFamily || 'all');
  const source = normalizeJobSource(query.source);
  const locationRegion = clean(query.locationRegion || 'all');
  const since = normalizeDatePreset(clean(query.since || 'all'));
  const spam = clean(query.spam || 'all');
  const visibility = clean(query.visibility || 'visible');
  const origin = clean(query.origin || 'all');
  const sort = clean(query.sort || 'scraped_desc');
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 100);
  const offset = (page - 1) * limit;

  if (source && source !== 'all') appendAndCondition(where, sourceCondition(source));
  applyRoleFamilyFilter(where, roleFamily);
  applyExperienceLevelFilter(where);
  if (spam === 'spam') where.isSpam = true;
  if (spam === 'not_spam') where.isSpam = false;
  if (spam === 'unreviewed') where.isSpam = { [Op.is]: null };
  applyVisibilityFilter(where, visibility);
  applyOriginFilter(where, origin);
  applyLocationRegionFilter(where, locationRegion);
  applyDateFilter(where, { since, dateFrom: query.dateFrom, dateTo: query.dateTo, timeZone: localTimeZone });
  if (search) {
    const pattern = `%${search}%`;
    where[Op.or] = [
      { publicJobId: { [Op.iLike]: pattern } },
      { title: { [Op.iLike]: pattern } },
      { company: { [Op.iLike]: pattern } },
      { location: { [Op.iLike]: pattern } },
      { listingText: { [Op.iLike]: pattern } },
    ];
  }

  return {
    where,
    order: orderForSort(sort),
    limit,
    offset,
  };
}

export function jobDateFiltersForUser(query = {}, user) {
  if (clean(query.since) !== 'tomorrow' || isAdminRole(user)) return query;
  return { ...query, since: 'all', dateFrom: '', dateTo: '' };
}

function applyRoleFamilyFilter(where, roleFamily) {
  const category = normalizeJobCategory(roleFamily);
  if (category) where.category = category;
}

function applyExperienceLevelFilter(where) {
  appendAndCondition(where, {
    [Op.or]: [{ title: { [Op.is]: null } }, { title: { [Op.notIRegexp]: JUNIOR_LEVEL_TITLE_PATTERN } }],
  });
}

function applyVisibilityFilter(where, visibility) {
  if (visibility === 'all') return;
  if (visibility === 'hidden') {
    where.isHidden = true;
    return;
  }

  appendAndCondition(where, {
    [Op.or]: [{ isHidden: false }, { isHidden: { [Op.is]: null } }],
  });
}

function applyOriginFilter(where, origin) {
  if (origin === 'manual') {
    appendAndCondition(where, literal("raw_job->>'importType' = 'manual'"));
    return;
  }

  if (origin === 'scraped') {
    appendAndCondition(where, literal("COALESCE(raw_job->>'importType', '') <> 'manual'"));
  }
}

function applyLocationRegionFilter(where, locationRegion) {
  if (!locationRegion || locationRegion === 'all') return;

  if (locationRegion === 'canada') {
    appendAndCondition(where, effectiveLocationRegexpCondition(CANADA_LOCATION_PATTERN));
    return;
  }

  if (locationRegion === 'us_worldwide') {
    appendAndCondition(where, {
      [Op.and]: [
        {
          [Op.or]: [
            effectiveLocationIsBlankCondition(),
            effectiveLocationRegexpCondition(US_WORLDWIDE_LOCATION_PATTERN),
          ],
        },
        {
          [Op.or]: [
            effectiveLocationIsBlankCondition(),
            effectiveLocationNotRegexpCondition(CANADA_LOCATION_PATTERN),
          ],
        },
      ],
    });
  }
}

function effectiveLocationExpression() {
  return "COALESCE(location, raw_job->>'location', raw_job->>'job_location', raw_job->>'jobLocation', raw_job->>'location_label', raw_job->>'locationLabel')";
}

function escapedRegexLiteral(pattern) {
  return String(pattern).replace(/'/g, "''");
}

function escapedSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function effectiveLocationRegexpCondition(pattern) {
  return literal(`${effectiveLocationExpression()} ~* '${escapedRegexLiteral(pattern)}'`);
}

function effectiveLocationNotRegexpCondition(pattern) {
  return literal(`${effectiveLocationExpression()} !~* '${escapedRegexLiteral(pattern)}'`);
}

function effectiveLocationIsBlankCondition() {
  return literal(`btrim(COALESCE(${effectiveLocationExpression()}, '')) = ''`);
}

function appendAndCondition(where, condition) {
  where[Op.and] = [...(Array.isArray(where[Op.and]) ? where[Op.and] : []), condition];
}

function orderForSort(sort) {
  if (sort === 'posted_asc') return [['postedAt', 'ASC NULLS LAST'], ['id', 'ASC']];
  if (sort === 'scraped_asc') return [['scrapedAt', 'ASC'], ['id', 'ASC']];
  if (sort === 'title_asc') return [['title', 'ASC NULLS LAST'], ['id', 'ASC']];
  return [[sort === 'posted_desc' ? 'postedAt' : 'scrapedAt', 'DESC NULLS LAST'], ['id', 'DESC']];
}

function applyDateFilter(where, { since, dateFrom, dateTo, timeZone }) {
  if (since === 'all') return;

  const range = since === 'custom'
    ? customDateRange(dateFrom, dateTo, timeZone)
    : presetDateRange(since, timeZone);
  if (!range) return;

  const scrapedAt = {};
  if (range.from) scrapedAt[Op.gte] = range.from;
  if (range.to) scrapedAt[Op.lt] = range.to;
  if (Object.getOwnPropertySymbols(scrapedAt).length) where.scrapedAt = scrapedAt;
}

function normalizeDatePreset(value) {
  const legacyDateFilters = {
    '24h': 'today',
    '3d': 'this_week',
    '7d': 'this_week',
    '30d': 'all',
  };
  return legacyDateFilters[value] || value;
}

function presetDateRange(value, timeZone) {
  return localPresetRange(value, new Date(), { timeZone });
}

function customDateRange(dateFrom, dateTo, timeZone) {
  const from = localDateRange(dateFrom, { timeZone })?.from || null;
  const to = localDateRange(dateTo, { timeZone })?.from || null;

  return {
    from,
    to: to ? addLocalDays(to, 1, { timeZone }) : null,
  };
}

export function parseSpamReview(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  if (value === null || value === 'unknown' || value === 'unreviewed') return null;
  throw new InputError('isSpam must be true, false, or null');
}

export function parseHiddenState(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new InputError('isHidden must be true or false');
}

export function formatJob(row, { includeRawJob = true } = {}) {
  const rawJob = row.rawJob || {};
  const job = {
    id: row.id,
    publicJobId: publicJobIdFromId(row.publicJobId || row.id),
    title: clean(row.title),
    company: clean(row.company),
    location: clean(row.location),
    category: row.category,
    url: row.url,
    source: clean(row.source),
    sourceUrl: row.sourceUrl,
    postedAt: row.postedAt,
    scrapedAt: row.scrapedAt,
    description: row.listingText ? null : clean(firstRawJobValue(rawJob, ['description', 'listingText', 'jobDescription'])) || null,
    listingText: row.listingText,
    applyMode: applyMode(row.source, rawJob),
    companyLogoUrl: companyLogoUrl(rawJob),
    isManual: rawJob.importType === 'manual' || rawJob.isManualImport === true,
    isSpam: row.isSpam,
    spamReviewedAt: row.spamReviewedAt,
    isHidden: row.isHidden,
    hiddenAt: row.hiddenAt,
  };

  if (includeRawJob) job.rawJob = rawJob;
  return job;
}

export function publicJobIdFromId(value) {
  const existingValue = clean(value).toUpperCase();
  if (/^[A-Z0-9]{8}$/.test(existingValue)) return existingValue;

  try {
    const id = BigInt(value);
    if (id < 0n || id >= PUBLIC_JOB_ID_CAPACITY) return '';
    return `${PUBLIC_JOB_ID_PREFIX}${id.toString(36).toUpperCase().padStart(PUBLIC_JOB_ID_BODY_LENGTH, '0')}`;
  } catch {
    return '';
  }
}

export function normalizeJobSource(value) {
  return clean(value).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

export function jobSourceLabel(value) {
  const label = clean(value);
  const source = normalizeJobSource(label);
  if (source === 'linkedin') return 'LinkedIn';
  if (source === 'manual') return 'Manual';
  return label || 'Unknown';
}

export function mergedJobSourceOptions(sourceRows = []) {
  const sourcesByKey = new Map();

  for (const row of sourceRows) {
    const rawSource = row.source;
    const source = normalizeJobSource(rawSource);
    if (!source) continue;
    const current = sourcesByKey.get(source) || { source: jobSourceLabel(rawSource), count: 0 };
    current.count += Number(row.count || 0);
    sourcesByKey.set(source, current);
  }

  return [...sourcesByKey.values()].sort((left, right) => left.source.localeCompare(right.source));
}

function sourceCondition(source) {
  const normalizedSource = escapedSqlLiteral(normalizeJobSource(source));
  const sourceExpression = "lower(regexp_replace(btrim(coalesce(source, '')), '[-_[:space:]]+', ' ', 'g'))";
  return literal(`${sourceExpression} = '${normalizedSource}'`);
}

export function groupedJobsFromRows(rows, options = {}) {
  const groups = new Map();

  for (const row of rows) {
    const job = formatJob(row, options);
    const groupKey = jobGroupKey(job);
    const group = groups.get(groupKey);
    if (!group) {
      groups.set(groupKey, {
        ...job,
        id: `job-group:${groupKey}`,
        representativeJobId: job.id,
        locationOptions: [locationOption(job)],
      });
      continue;
    }

    group.locationOptions.push(locationOption(job));
    const latestPostedAt = latestDateValue(group.postedAt, job.postedAt);
    const latestScrapedAt = latestDateValue(group.scrapedAt, job.scrapedAt);
    if (shouldPromoteJobRepresentative(group, job)) {
      const { id, locationOptions } = group;
      Object.assign(group, {
        ...job,
        id,
        representativeJobId: job.id,
        locationOptions,
      });
    }
    group.postedAt = latestPostedAt;
    group.scrapedAt = latestScrapedAt;
  }

  return [...groups.values()].map((group) => ({
    ...group,
    location: groupedLocationLabel(group.locationOptions),
    locationOptions: group.locationOptions.sort(compareLocationOptions),
  }));
}

export function paginateGroupedJobs(rows, { limit, offset }, options = {}) {
  const groupedJobs = groupedJobsFromRows(rows, options);
  return {
    rows: groupedJobs.slice(offset, offset + limit),
    count: groupedJobs.length,
  };
}

function jobGroupKey(job) {
  return [
    normalizeJobSource(job.source || 'Unknown source') || 'unknown source',
    normalizeGroupValue(job.title || 'Untitled role'),
    normalizeGroupValue(job.company || 'Unknown company'),
  ].join('::');
}

function normalizeGroupValue(value) {
  return clean(value).toLowerCase().replace(/\s+/g, ' ') || 'unknown';
}

function locationOption(job) {
  return {
    ...job,
    groupJobId: job.id,
    locationLabel: job.location || 'Location not listed',
  };
}

function groupedLocationLabel(options) {
  const locations = [
    ...new Set(
      [...options]
        .sort(compareLocationOptions)
        .map((option) => option.locationLabel)
        .filter(Boolean),
    ),
  ];
  if (locations.length <= 1) return locations[0] || '';
  return `${locations[0]} + ${locations.length - 1} more`;
}

function shouldPromoteJobRepresentative(current, candidate) {
  const currentTime = Date.parse(current.postedAt || current.scrapedAt || 0) || 0;
  const candidateTime = Date.parse(candidate.postedAt || candidate.scrapedAt || 0) || 0;
  if (candidateTime !== currentTime) return candidateTime > currentTime;

  const currentDisplayRank = jobDisplayRank(current);
  const candidateDisplayRank = jobDisplayRank(candidate);
  if (candidateDisplayRank !== currentDisplayRank) return candidateDisplayRank > currentDisplayRank;

  return Number(candidate.id || 0) > Number(current.representativeJobId || current.id || 0);
}

function jobDisplayRank(job) {
  return displayValueRank(job.title) + displayValueRank(job.company);
}

function displayValueRank(value) {
  const text = clean(value);
  if (!text) return 0;
  return text === text.toLowerCase() || text === text.toUpperCase() ? 1 : 2;
}

function latestDateValue(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return new Date(left) > new Date(right) ? left : right;
}

function compareLocationOptions(left, right) {
  return String(left.locationLabel || '').localeCompare(String(right.locationLabel || '')) || Number(left.id) - Number(right.id);
}

function applyMode(source, rawJob) {
  const sourceKey = String(source || '').trim().toLowerCase();
  if (sourceKey === 'linkedin') return linkedInApplyMode(rawJob);
  return null;
}

function linkedInApplyMode(rawJob) {
  const value = firstRawJobValue(rawJob, [
    'applyMode',
    'apply_mode',
    'applicationMode',
    'application_mode',
    'applyType',
    'apply_type',
    'applicationType',
    'application_type',
    'jobApplyType',
    'job_apply_type',
    'applyMethod',
    'apply_method',
    'applicationMethod',
    'application_method',
    'easyApply',
    'easy_apply',
    'isEasyApply',
    'is_easy_apply',
    'easyApplyEnabled',
    'easy_apply_enabled',
  ]);
  const mode = linkedInApplyModeFromValue(value);
  if (mode) return mode;

  const applyUrl = firstRawJobValue(rawJob, [
    'applyUrl',
    'apply_url',
    'applicationUrl',
    'application_url',
    'externalApplyUrl',
    'external_apply_url',
    'companyApplyUrl',
    'company_apply_url',
  ]);
  return externalApplyUrl(applyUrl) ? 'External Link' : null;
}

function linkedInApplyModeFromValue(value) {
  if (value === true) return 'Easy Apply';
  if (value === false) return 'External Link';
  const text = clean(value).toLowerCase();
  if (!text) return null;
  if (/easy\s*apply|easyapply|linkedin_apply|in[_\s-]?app|onsite/.test(text)) return 'Easy Apply';
  if (/external|offsite|company|ats|redirect/.test(text)) return 'External Link';
  if (externalApplyUrl(text)) return 'External Link';
  return null;
}

function firstRawJobValue(rawJob, keys, depth = 0) {
  if (!rawJob || typeof rawJob !== 'object' || depth > 2) return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(rawJob, key)) return rawJob[key];
  }
  for (const value of Object.values(rawJob)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const nestedValue = firstRawJobValue(value, keys, depth + 1);
    if (nestedValue !== null && nestedValue !== undefined && nestedValue !== '') return nestedValue;
  }
  return null;
}

function externalApplyUrl(value) {
  const url = clean(value);
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    return !new URL(url).hostname.toLowerCase().endsWith('linkedin.com');
  } catch {
    return false;
  }
}

function companyLogoUrl(rawJob) {
  if (!rawJob || typeof rawJob !== 'object') return null;

  const directCandidates = [
    rawJob.companyLogoUrl,
    rawJob.company_logo_url,
    rawJob.companyLogo,
    rawJob.company_logo,
    rawJob.employerLogoUrl,
    rawJob.employer_logo_url,
    rawJob.organizationLogoUrl,
    rawJob.organization_logo_url,
    rawJob.organizationLogo,
    rawJob.organization_logo,
    rawJob.hiringOrganizationLogoUrl,
    rawJob.hiring_organization_logo_url,
    rawJob.hiringOrganizationLogo,
    rawJob.hiring_organization_logo,
    rawJob.company?.logoUrl,
    rawJob.company?.logo_url,
    rawJob.company?.logo,
    rawJob.employer?.logoUrl,
    rawJob.employer?.logo_url,
    rawJob.employer?.logo,
    rawJob.organization?.logoUrl,
    rawJob.organization?.logo_url,
    rawJob.organization?.logo,
    rawJob.hiringOrganization?.logo,
  ];

  for (const candidate of directCandidates) {
    const url = imageUrlFromValue(candidate);
    if (url) return url;
  }

  return nestedCompanyLogoUrl(rawJob);
}

function nestedCompanyLogoUrl(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 3) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = nestedCompanyLogoUrl(item, depth + 1);
      if (url) return url;
    }
    return null;
  }

  for (const [key, item] of Object.entries(value)) {
    if (/^(company|employer|organization|hiringorganization|hiring_organization).*logo(url)?$/i.test(key)) {
      const url = imageUrlFromValue(item);
      if (url) return url;
    }
  }

  for (const item of Object.values(value)) {
    const url = nestedCompanyLogoUrl(item, depth + 1);
    if (url) return url;
  }

  return null;
}

function imageUrlFromValue(value) {
  if (!value) return null;
  if (typeof value === 'string') return validImageUrl(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = imageUrlFromValue(item);
      if (url) return url;
    }
  }
  if (typeof value === 'object') return imageUrlFromValue(value.url || value.src || value.href);
  return null;
}

function validImageUrl(value) {
  const url = clean(value);
  if (!url) return null;
  return /^(https?:)?\/\//i.test(url) || /^data:image\//i.test(url) ? url : null;
}

export function canImportJobs(user) {
  return [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.editableBidder].includes(user?.role);
}
