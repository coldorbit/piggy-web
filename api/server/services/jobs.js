import { literal, Op } from 'sequelize';
import { clean } from '../utils/index.js';
import { InputError } from '../utils/errors.js';

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
  const since = clean(query.since || '24h');
  const spam = clean(query.spam || 'all');
  const visibility = clean(query.visibility || 'visible');
  const origin = clean(query.origin || 'all');
  const sort = clean(query.sort || 'scraped_desc');
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 100);
  const offset = (page - 1) * limit;

  if (source && source !== 'all') where.source = source;
  applyRoleFamilyFilter(where, roleFamily);
  applyExperienceLevelFilter(where);
  if (spam === 'spam') where.isSpam = true;
  if (spam === 'not_spam') where.isSpam = false;
  if (spam === 'unreviewed') where.isSpam = { [Op.is]: null };
  applyVisibilityFilter(where, visibility);
  applyOriginFilter(where, origin);
  if (since !== 'all') {
    const sinceDate = sinceToDate(since);
    if (sinceDate) where.postedAt = { [Op.gte]: sinceDate };
  }
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
  if (['software', 'data', 'ai_ml'].includes(roleFamily)) where.category = roleFamily;
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

function sinceToDate(value) {
  const now = Date.now();
  const durations = {
    '24h': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return durations[value] ? new Date(now - durations[value]) : null;
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
    applyMode: jobrightApplyMode(row.source, rawJob),
    companyLogoUrl: companyLogoUrl(rawJob),
    isManual: rawJob.importType === 'manual' || rawJob.isManualImport === true,
    isSpam: row.isSpam,
    spamReviewedAt: row.spamReviewedAt,
    isHidden: row.isHidden,
    hiddenAt: row.hiddenAt,
  };
}

function jobrightApplyMode(source, rawJob) {
  if (String(source || '').trim().toLowerCase() !== 'jobright') return null;
  return clean(rawJob?.applyMode || rawJob?.apply_mode || rawJob?.applicationMode || rawJob?.application_mode) || null;
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
  return ['admin', 'user', 'editable_bidder'].includes(user?.role);
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

    const category = categoryFromCsvValue(csvValue(raw, 'category'), rowNumber, errors);
    const postedAt = dateFromCsvValue(csvValue(raw, 'postedAt'), rowNumber, errors) || importedAt;
    const listingText = csvValue(raw, 'listingText');

    jobs.push({
      url,
      duplicateKey: url,
      source: csvValue(raw, 'source') || 'Manual',
      sourceUrl: csvValue(raw, 'sourceUrl') || null,
      title: title || 'Untitled role',
      company: csvValue(raw, 'company') || null,
      location: csvValue(raw, 'location') || null,
      category,
      postedAt,
      scrapedAt: importedAt,
      listingText: listingText || null,
      rawJob: {
        ...raw,
        importedBy: importedBy || null,
        importedAt: importedAt.toISOString(),
        importType: 'manual',
        isManualImport: true,
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
    } else if (char === ',') {
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
  const normalized = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'software';
  if (VALID_JOB_CATEGORIES.has(normalized)) return normalized;
  if (['ai', 'ml', 'aiml', 'ai/ml', 'ai_ml'].includes(normalized)) return 'ai_ml';
  if (normalized.includes('data')) return 'data';
  errors.push(`Row ${rowNumber}: invalid category`);
  return 'software';
}

function validJobUrl(value) {
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
