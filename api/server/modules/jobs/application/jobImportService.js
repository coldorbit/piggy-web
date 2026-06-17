import { clean } from '../../../utils/index.js';
import { InputError } from '../../../utils/errors.js';

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
const JOB_TITLE_ACRONYMS = new Set(['AI', 'API', 'BI', 'CIO', 'CISO', 'CRM', 'CTO', 'DBA', 'ERP', 'ETL', 'IT', 'ML', 'QA', 'SRE', 'UI', 'UX']);

export function jobsFromCsv(csvText, { importedBy, importedAt: importedAtValue, timeZone } = {}) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new InputError('CSV must include a header row and at least one job row');

  const headers = rows[0].map(normalizeHeader);
  validateCsvHeaders(headers);
  const importedAt = validDateOrNow(importedAtValue);
  const scrapedAt = importedAt;
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
    const manualSource = manualImportSource(raw, url);

    jobs.push({
      url,
      duplicateKey: url,
      source: manualSource.source,
      sourceUrl: manualSource.sourceUrl,
      title: capitalizeJobTitle(title) || 'Untitled Role',
      company: csvValue(raw, 'company') || null,
      location: csvValue(raw, 'location') || null,
      category,
      postedAt,
      scrapedAt,
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

function validDateOrNow(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function planCsvJobImport(rows, existingRows = []) {
  const existingJobsByUrl = new Map(existingRows.map((row) => [row.url, row]));
  const existingUrls = new Set(existingJobsByUrl.keys());
  const seenUrls = new Set();
  const firstCsvRowByUrl = new Map();
  const duplicateCsvRows = [];
  const duplicateExistingRows = [];
  const categoryUpdates = [];
  const locationUpdates = [];
  const categoryUpdateUrls = new Set();
  const locationUpdateUrls = new Set();
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
      if (!locationUpdateUrls.has(row.url) && clean(row.location) && clean(row.location) !== clean(existingJob?.location)) {
        locationUpdates.push({ url: row.url, location: row.location });
        locationUpdateUrls.add(row.url);
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
    locationUpdates,
  };
}

function shouldUpdateExistingJobCategory({ currentCategory, importedCategory }) {
  if (!importedCategory || importedCategory === currentCategory) return false;
  if (importedCategory === 'software' && currentCategory && currentCategory !== 'software') return false;
  return true;
}

function manualRawJob(raw) {
  const rawJob = { ...raw };
  if (!isLinkedInManualSource(raw)) {
    for (const field of ['source', 'sourceUrl']) {
      for (const column of JOB_CSV_COLUMNS[field]) {
        delete rawJob[normalizeHeader(column)];
      }
    }
  }
  return rawJob;
}

export function capitalizeJobTitle(value) {
  return clean(value).replace(/[A-Za-z]+/g, (word) => {
    const upperWord = word.toUpperCase();
    if (JOB_TITLE_ACRONYMS.has(upperWord)) return upperWord;
    return `${upperWord.charAt(0)}${word.slice(1).toLowerCase()}`;
  });
}

function manualImportSource(raw, url) {
  if (!isLinkedInManualSource(raw, url)) {
    return { source: 'Manual', sourceUrl: null };
  }

  return {
    source: 'linkedin',
    sourceUrl: csvValue(raw, 'sourceUrl') || (isLinkedInUrl(url) ? url : null),
  };
}

function isLinkedInManualSource(raw, url = '') {
  const source = clean(csvValue(raw, 'source')).toLowerCase();
  return source === 'linkedin' || isLinkedInUrl(csvValue(raw, 'sourceUrl')) || isLinkedInUrl(url);
}

function isLinkedInUrl(value) {
  try {
    return new URL(clean(value)).hostname.toLowerCase().endsWith('linkedin.com');
  } catch {
    return false;
  }
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
