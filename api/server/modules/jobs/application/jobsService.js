import { literal, Op } from 'sequelize';
import { clean } from '../../../utils/index.js';
import { InputError } from '../../../utils/errors.js';
import { ROLES } from '../../../utils/roles.js';

const JOB_CSV_COLUMNS = {
  url: ['url', 'job_url', 'job url', 'link', 'job_link', 'job link'],
  title: ['title', 'job_title', 'job title', 'role'],
  company: ['company', 'company_name', 'company name'],
  location: ['location'],
  category: ['category', 'role_family', 'role family', 'rolefamily'],
  postedAt: ['postedat', 'posted_at', 'posted at', 'posted', 'date'],
  source: ['source'],
  sourceUrl: ['sourceurl', 'source_url', 'source url'],
  listingText: ['listingtext', 'listing_text', 'listing text', 'description', 'job_description', 'job description'],
};
const VALID_JOB_CATEGORIES = new Set(['software', 'data', 'ai_ml']);
const JUNIOR_LEVEL_TITLE_PATTERN = [
  '\\mjunior\\M',
  '\\mjr\\M\\.?',
  '\\mentry[-[:space:]]level\\M',
  '\\mnew[-[:space:]]grad(uate)?\\M',
  '\\mintern(ship)?\\M',
  '\\mapprentice\\M',
].join('|');

export function buildJobQuery(query) {
  const where = {};
  const search = clean(query.search);
  const roleFamily = clean(query.roleFamily || 'all');
  const source = clean(query.source);
  const since = normalizeDatePreset(clean(query.since || 'today'));
  const spam = clean(query.spam || 'all');
  const visibility = clean(query.visibility || 'visible');
  const origin = clean(query.origin || 'all');
  const sort = clean(query.sort || 'scraped_desc');
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 100);
  const offset = (page - 1) * limit;

  if (source && source !== 'all') where.source = { [Op.iLike]: source };
  applyRoleFamilyFilter(where, roleFamily);
  applyExperienceLevelFilter(where);
  if (spam === 'spam') where.isSpam = true;
  if (spam === 'not_spam') where.isSpam = false;
  if (spam === 'unreviewed') where.isSpam = { [Op.is]: null };
  applyVisibilityFilter(where, visibility);
  applyOriginFilter(where, origin);
  applyDateFilter(where, { since, dateFrom: query.dateFrom, dateTo: query.dateTo });
  if (search) {
    const pattern = `%${search}%`;
    where[Op.or] = [
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

function appendAndCondition(where, condition) {
  where[Op.and] = [...(Array.isArray(where[Op.and]) ? where[Op.and] : []), condition];
}

function orderForSort(sort) {
  if (sort === 'posted_asc') return [['postedAt', 'ASC NULLS LAST']];
  if (sort === 'scraped_asc') return [['scrapedAt', 'ASC']];
  if (sort === 'title_asc') return [['title', 'ASC NULLS LAST']];
  return [[sort === 'posted_desc' ? 'postedAt' : 'scrapedAt', 'DESC NULLS LAST']];
}

function applyDateFilter(where, { since, dateFrom, dateTo }) {
  if (since === 'all') return;

  const range = since === 'custom'
    ? customDateRange(dateFrom, dateTo)
    : presetDateRange(since);
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

function presetDateRange(value) {
  const today = startOfLocalDay(new Date());

  if (value === 'today') {
    return { from: today, to: addDays(today, 1) };
  }
  if (value === 'yesterday') {
    return { from: addDays(today, -1), to: today };
  }
  if (value === 'this_week') {
    const weekStart = startOfLocalWeek(today);
    return { from: weekStart, to: addDays(weekStart, 7) };
  }
  if (value === 'last_week') {
    const thisWeekStart = startOfLocalWeek(today);
    return { from: addDays(thisWeekStart, -7), to: thisWeekStart };
  }

  return null;
}

function customDateRange(dateFrom, dateTo) {
  const from = parseDateOnly(dateFrom);
  const to = parseDateOnly(dateTo);

  return {
    from,
    to: to ? addDays(to, 1) : null,
  };
}

function parseDateOnly(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== Number(match[1])
    || date.getMonth() !== Number(match[2]) - 1
    || date.getDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

function startOfLocalDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfLocalWeek(value) {
  const day = value.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(startOfLocalDay(value), mondayOffset);
}

function addDays(value, days) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
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

export function formatJob(row) {
  const rawJob = row.rawJob || {};
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    category: row.category,
    url: row.url,
    source: row.source,
    sourceUrl: row.sourceUrl,
    postedAt: row.postedAt,
    scrapedAt: row.scrapedAt,
    listingText: row.listingText,
    rawJob,
    applyMode: applyMode(row.source, rawJob),
    companyLogoUrl: companyLogoUrl(rawJob),
    isManual: rawJob.importType === 'manual' || rawJob.isManualImport === true,
    isSpam: row.isSpam,
    spamReviewedAt: row.spamReviewedAt,
    isHidden: row.isHidden,
    hiddenAt: row.hiddenAt,
  };
}

export function groupedJobsFromRows(rows) {
  const groups = new Map();

  for (const row of rows) {
    const job = formatJob(row);
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
    group.location = groupedLocationLabel(group.locationOptions);
    group.postedAt = latestDateValue(group.postedAt, job.postedAt);
    group.scrapedAt = latestDateValue(group.scrapedAt, job.scrapedAt);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    locationOptions: group.locationOptions.sort(compareLocationOptions),
  }));
}

export function paginateGroupedJobs(rows, { limit, offset }) {
  const groupedJobs = groupedJobsFromRows(rows);
  return {
    rows: groupedJobs.slice(offset, offset + limit),
    count: groupedJobs.length,
  };
}

function jobGroupKey(job) {
  return `${normalizeGroupValue(job.title || 'Untitled role')}::${normalizeGroupValue(job.company || 'Unknown company')}`;
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
  const locations = [...new Set(options.map((option) => option.locationLabel).filter(Boolean))];
  if (locations.length <= 1) return locations[0] || '';
  return `${locations[0]} + ${locations.length - 1} more`;
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

export function jobsFromCsv(csvText, { importedBy } = {}) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new InputError('CSV must include a header row and at least one job row');

  const headers = rows[0].map(normalizeHeader);
  validateCsvHeaders(headers);
  const importedAt = new Date();
  const jobs = [];
  const errors = [];

  rows.slice(1).forEach((row, index) => {
    if (row.every((value) => !clean(value))) return;
    const rowNumber = index + 2;
    const raw = rowObjectFromCsvRow(headers, row);
    const url = csvValue(raw, 'url');
    const title = csvValue(raw, 'title');

    if (!url) {
      errors.push(`Row ${rowNumber}: missing url`);
      return;
    }
    if (!validJobUrl(url)) {
      errors.push(`Row ${rowNumber}: invalid url`);
      return;
    }

    const rawCategory = csvValue(raw, 'category');
    const category = categoryFromCsvValue(rawCategory, rowNumber, errors);
    const hasImportCategory = Boolean(clean(rawCategory));
    const postedAt = dateFromCsvValue(csvValue(raw, 'postedAt'), rowNumber, errors) || importedAt;
    const listingText = csvValue(raw, 'listingText');

    jobs.push({
      url,
      duplicateKey: url,
      source: 'Manual',
      sourceUrl: null,
      title: title || 'Untitled role',
      company: csvValue(raw, 'company') || null,
      location: csvValue(raw, 'location') || null,
      category,
      postedAt,
      scrapedAt: importedAt,
      listingText: listingText || null,
      rawJob: {
        ...manualRawJob(raw),
        importedBy: importedBy || null,
        importedAt: importedAt.toISOString(),
        importRowNumber: rowNumber,
        importType: 'manual',
        isManualImport: true,
        importCategoryProvided: hasImportCategory,
        roleFamily: category,
        category,
      },
      isHidden: false,
      firstSeenAt: importedAt,
      updatedAt: importedAt,
    });
  });

  if (errors.length) throw new InputError(errors.slice(0, 10).join('; '));
  if (!jobs.length) throw new InputError('CSV did not contain any importable jobs');
  return jobs;
}

export function planCsvJobImport(rows, existingRows = []) {
  const existingJobsByUrl = new Map(existingRows.map((row) => [row.url, row]));
  const existingUrls = new Set(existingJobsByUrl.keys());
  const seenUrls = new Set();
  const firstCsvRowByUrl = new Map();
  const duplicateCsvRows = [];
  const duplicateExistingRows = [];
  const categoryUpdates = [];
  const categoryUpdateUrls = new Set();
  const insertRows = rows.filter((row) => {
    const rowNumber = row.rawJob?.importRowNumber || null;
    if (existingUrls.has(row.url)) {
      const existingJob = existingJobsByUrl.get(row.url);
      duplicateExistingRows.push({
        url: row.url,
        rowNumber,
        title: row.title,
        company: row.company,
        existingTitle: existingJob?.title || null,
        existingCompany: existingJob?.company || null,
      });
      if (
        !categoryUpdateUrls.has(row.url) &&
        row.rawJob?.importCategoryProvided &&
        shouldUpdateExistingJobCategory({ currentCategory: existingJob?.category, importedCategory: row.category })
      ) {
        categoryUpdates.push({ url: row.url, category: row.category });
        categoryUpdateUrls.add(row.url);
      }
      return false;
    }
    if (seenUrls.has(row.url)) {
      duplicateCsvRows.push({
        url: row.url,
        rowNumber,
        firstRowNumber: firstCsvRowByUrl.get(row.url) || null,
        title: row.title,
        company: row.company,
      });
      return false;
    }
    seenUrls.add(row.url);
    firstCsvRowByUrl.set(row.url, rowNumber);
    return true;
  });

  return {
    insertRows,
    duplicateCsvRows,
    duplicateExistingRows,
    categoryUpdates,
  };
}

function shouldUpdateExistingJobCategory({ currentCategory, importedCategory }) {
  if (!importedCategory || importedCategory === currentCategory) return false;
  if (importedCategory === 'software' && currentCategory && currentCategory !== 'software') return false;
  return true;
}

function manualRawJob(raw) {
  const rawJob = { ...raw };
  for (const field of ['source', 'sourceUrl']) {
    for (const column of JOB_CSV_COLUMNS[field]) {
      delete rawJob[normalizeHeader(column)];
    }
  }
  return rawJob;
}

function validateCsvHeaders(headers) {
  if (!headers.some((header) => JOB_CSV_COLUMNS.url.map(normalizeHeader).includes(header))) {
    throw new InputError('CSV must include a url column');
  }

  const knownHeaders = new Set(Object.values(JOB_CSV_COLUMNS).flat().map(normalizeHeader));
  const processibleHeaders = headers.filter((header) => knownHeaders.has(header));
  if (processibleHeaders.length < 2) {
    throw new InputError('CSV must include url and at least one supported job column');
  }
}

function parseCsv(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  const delimiter = csvDelimiter(text);
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  if (inQuotes) throw new InputError('CSV contains an unclosed quoted value');
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function csvDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
  return firstLine.includes('\t') ? '\t' : ',';
}

function rowObjectFromCsvRow(headers, row) {
  const raw = {};
  headers.forEach((header, index) => {
    if (!header) return;
    raw[header] = clean(row[index]);
  });
  return raw;
}

function csvValue(raw, field) {
  for (const column of JOB_CSV_COLUMNS[field]) {
    const value = raw[normalizeHeader(column)];
    if (value) return value;
  }
  return '';
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[\s-]+/g, '_');
}

function categoryFromCsvValue(value, rowNumber, errors) {
  const category = normalizeJobCategory(value);
  if (!clean(value)) return 'software';
  if (category) return category;
  errors.push(`Row ${rowNumber}: invalid category`);
  return 'software';
}

export function normalizeJobCategory(value) {
  const normalized = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized || normalized === 'all') return '';
  if (VALID_JOB_CATEGORIES.has(normalized)) return normalized;
  if (['ai', 'ml', 'aiml', 'ai/ml', 'ai_ml'].includes(normalized)) return 'ai_ml';
  if (normalized.includes('data')) return 'data';
  return '';
}

export function validJobUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function dateFromCsvValue(value, rowNumber, errors) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push(`Row ${rowNumber}: invalid postedAt`);
    return null;
  }
  return date;
}
