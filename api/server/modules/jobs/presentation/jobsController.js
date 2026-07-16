import { ensureWebModels, getJobBidModel, getScrapedJobModel, getSequelize, getTailoredResumeModel } from '../../../../db.js';
import { Op, QueryTypes } from 'sequelize';
import { createHash } from 'node:crypto';
import {
  buildJobQuery,
  buildJobDuplicateKey,
  canImportJobs,
  formatJob,
  jobDateFiltersForUser,
  jobsFromCsv,
  mergedJobSourceOptions,
  groupedJobsFromRows,
  jobSummaryAttributes,
  planCsvJobImport,
  parseHiddenState,
  parseSpamReview,
  validJobUrl,
} from '../application/jobsService.js';
import { InputError } from '../../../utils/errors.js';
import { clean } from '../../../utils/index.js';
import { isAdminRole } from '../../../utils/roles.js';

const META_CACHE_TTL_MS = 60_000;
let metaCache = null;
let metaCachePromise = null;
let metaCacheExpiresAt = 0;

export async function listJobs(req, res, next) {
  try {
    await ensureWebModels();
    const ScrapedJob = getScrapedJobModel();
    const query = jobDateFiltersForUser(req.query, req.user);
    const { where, order, limit, offset } = buildJobQuery(query, { timeZone: req.user?.timezone });
    const { count, rows } = await ScrapedJob.findAndCountAll({
      attributes: jobSummaryAttributes(),
      where,
      order,
      limit,
      offset,
    });
    const pageRows = groupedJobsFromRows(rows, { includeRawJob: false });

    res.json({
      jobs: pageRows,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
}

export async function getJob(req, res, next) {
  try {
    await ensureWebModels();
    const job = await getScrapedJobModel().findByPk(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ job: formatJob(job) });
  } catch (error) {
    next(error);
  }
}

export async function markJobSpam(req, res, next) {
  try {
    await ensureWebModels();
    const ScrapedJob = getScrapedJobModel();
    const job = await ScrapedJob.findByPk(req.params.id);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    let isSpam;
    try {
      isSpam = parseSpamReview(req.body?.isSpam);
    } catch (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    await job.update({
      isSpam,
      spamReviewedAt: isSpam === null ? null : new Date(),
    });

    res.json({ job: formatJob(job) });
  } catch (error) {
    next(error);
  }
}

export async function bulkMarkJobsSpam(req, res, next) {
  try {
    await ensureWebModels();
    const jobIds = numericIds(req.body?.jobIds || req.body?.ids, 'jobIds');
    const isSpam = parseSpamReview(req.body?.isSpam);
    const ScrapedJob = getScrapedJobModel();
    const rows = await ScrapedJob.findAll({ where: { id: { [Op.in]: jobIds } } });
    const now = new Date();
    const values = {
      isSpam,
      spamReviewedAt: isSpam === null ? null : now,
    };

    await ScrapedJob.update(values, {
      where: { id: { [Op.in]: rows.map((job) => job.id) } },
    });
    rows.forEach((job) => job.set(values));

    res.json({
      updated: rows.length,
      requested: jobIds.length,
      jobs: rows.map(formatJob),
    });
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function markJobHidden(req, res, next) {
  try {
    await ensureWebModels();
    const ScrapedJob = getScrapedJobModel();
    const job = await ScrapedJob.findByPk(req.params.id);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    let isHidden;
    try {
      isHidden = parseHiddenState(req.body?.isHidden);
    } catch (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    await job.update({
      isHidden,
      hiddenAt: isHidden ? new Date() : null,
    });

    res.json({ job: formatJob(job) });
  } catch (error) {
    next(error);
  }
}

export async function bulkMarkJobsHidden(req, res, next) {
  try {
    await ensureWebModels();
    const jobIds = numericIds(req.body?.jobIds || req.body?.ids, 'jobIds');
    const isHidden = parseHiddenState(req.body?.isHidden);
    const ScrapedJob = getScrapedJobModel();
    const rows = await ScrapedJob.findAll({ where: { id: { [Op.in]: jobIds } } });
    const now = new Date();
    const values = {
      isHidden,
      hiddenAt: isHidden ? now : null,
    };

    await ScrapedJob.update(values, {
      where: { id: { [Op.in]: rows.map((job) => job.id) } },
    });
    rows.forEach((job) => job.set(values));

    res.json({
      updated: rows.length,
      requested: jobIds.length,
      jobs: rows.map(formatJob),
    });
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function markLinkedInEasyApply(req, res, next) {
  try {
    await ensureWebModels();
    const ScrapedJob = getScrapedJobModel();
    const job = await ScrapedJob.findByPk(req.params.id);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    if (!isLinkedInJob(job)) {
      res.status(400).json({ error: 'Only LinkedIn jobs can be marked as Easy Apply' });
      return;
    }

    await job.update({
      rawJob: {
        ...(job.rawJob || {}),
        applyMode: 'Easy Apply',
      },
    });

    res.json({ job: formatJob(job) });
  } catch (error) {
    next(error);
  }
}

export async function updateLinkedInExternalUrl(req, res, next) {
  try {
    await ensureWebModels();
    const nextUrl = clean(req.body?.url || req.body?.jobUrl);
    if (!validJobUrl(nextUrl)) {
      res.status(400).json({ error: 'Enter a valid http or https URL' });
      return;
    }
    if (isLinkedInUrl(nextUrl)) {
      res.status(400).json({ error: 'External link must not be a LinkedIn URL' });
      return;
    }

    const ScrapedJob = getScrapedJobModel();
    const TailoredResume = getTailoredResumeModel();
    const sequelize = getSequelize();
    const job = await sequelize.transaction(async (transaction) => {
      const currentJob = await ScrapedJob.findByPk(req.params.id, { transaction });
      if (!currentJob) return null;
      if (!isLinkedInJob(currentJob)) throw new InputError('Only LinkedIn jobs can use an external link');

      const previousUrl = currentJob.url;
      await currentJob.update(
        {
          url: nextUrl,
          duplicateKey: buildJobDuplicateKey({
            url: nextUrl,
            title: currentJob.title,
            company: currentJob.company,
            location: currentJob.location,
          }),
          rawJob: {
            ...(currentJob.rawJob || {}),
            applyMode: 'External Link',
            externalApplyUrl: nextUrl,
          },
        },
        { transaction },
      );
      await TailoredResume.update({ jobUrl: nextUrl }, { where: { jobUrl: previousUrl }, transaction });
      return currentJob;
    });

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ job: formatJob(job) });
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(409).json({ error: 'A job with this URL already exists' });
      return;
    }
    next(error);
  }
}

export async function importJobsCsv(req, res, next) {
  try {
    await ensureWebModels();
    if (!canImportJobs(req.user)) {
      res.status(403).json({ error: 'Your role cannot import jobs' });
      return;
    }

    const rows = jobsFromCsv(req.body?.csv || req.body?.csvText || '', {
      importedBy: req.user?.username,
      timeZone: req.user?.timezone,
    });
    const ScrapedJob = getScrapedJobModel();
    const sequelize = getSequelize();
    const { insertRows, duplicateCsvRows, duplicateExistingRows, categoryUpdates, locationUpdates } = await sequelize.transaction(async (transaction) => {
      const existingRows = await existingImportedJobRows(sequelize, rows, { transaction });
      const plan = planCsvJobImport(rows, existingRows);

      if (plan.insertRows.length) await ScrapedJob.bulkCreate(plan.insertRows, { ignoreDuplicates: true, transaction });
      await Promise.all(
        [
          ...plan.categoryUpdates.map((update) => ({ ...update, values: { category: update.category } })),
          ...plan.locationUpdates.map((update) => ({ ...update, values: { location: update.location } })),
        ].map((update) =>
          ScrapedJob.update(update.values, {
            where: update.id ? { id: update.id } : { url: update.url },
            transaction,
          }),
        ),
      );

      return plan;
    });

    const duplicateCount = duplicateCsvRows.length + duplicateExistingRows.length;
    res.status(201).json({
      totalRows: rows.length,
      imported: insertRows.length,
      successfulImports: insertRows.length,
      updated: categoryUpdates.length + locationUpdates.length,
      updatedCategories: categoryUpdates.length,
      updatedLocations: locationUpdates.length,
      skipped: rows.length - insertRows.length,
      duplicateCount,
      duplicates: {
        inCsv: duplicateCsvRows,
        existing: duplicateExistingRows,
      },
      duplicateLinks: [...duplicateCsvRows, ...duplicateExistingRows].map((row) => ({
        url: row.url,
        duplicateKey: row.duplicateKey,
        rowNumber: row.rowNumber,
        firstRowNumber: row.firstRowNumber || null,
        reason: row.firstRowNumber ? 'duplicate_in_csv' : 'already_exists',
        matchType: row.matchType || 'url',
      })),
      jobs: insertRows.map((row) => ({
        title: row.title,
        company: row.company,
        url: row.url,
        source: row.source,
      })),
    });
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
}

function isLinkedInJob(job) {
  return String(job?.source || '').trim().toLowerCase() === 'linkedin';
}

function isLinkedInUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().endsWith('linkedin.com');
  } catch {
    return false;
  }
}

function numericIds(value, label) {
  const ids = Array.isArray(value) ? value : [];
  const normalized = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (!normalized.length) throw new InputError(`${label} must include at least one job`);
  if (normalized.length > 250) throw new InputError(`${label} cannot include more than 250 jobs`);
  return normalized;
}

export async function deleteJob(req, res, next) {
  try {
    await ensureWebModels();
    if (!isAdminRole(req.user)) {
      res.status(403).json({ error: 'Only admins can delete jobs permanently' });
      return;
    }

    const ScrapedJob = getScrapedJobModel();
    const JobBid = getJobBidModel();
    const TailoredResume = getTailoredResumeModel();
    const sequelize = getSequelize();

    const result = await sequelize.transaction(async (transaction) => {
      const job = await ScrapedJob.findByPk(req.params.id, { transaction });
      if (!job) return null;

      await JobBid.destroy({ where: { jobId: job.id }, transaction });
      await TailoredResume.destroy({ where: { jobUrl: job.url }, transaction });
      await job.destroy({ transaction });

      return { id: job.id, url: job.url };
    });

    if (!result) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ deleted: true, job: result });
  } catch (error) {
    next(error);
  }
}

export async function getMeta(_req, res, next) {
  try {
    await ensureWebModels();
    if (metaCache && Date.now() < metaCacheExpiresAt) {
      res.json(metaCache);
      return;
    }
    if (!metaCachePromise) metaCachePromise = buildMetaPayload();
    const payload = await metaCachePromise;
    metaCache = payload;
    metaCacheExpiresAt = Date.now() + META_CACHE_TTL_MS;
    metaCachePromise = null;
    res.json(payload);
  } catch (error) {
    metaCachePromise = null;
    next(error);
  }
}

async function buildMetaPayload() {
  const ScrapedJob = getScrapedJobModel();
  const sequelize = getSequelize();
  const [sourceRows, allRows, latest] = await Promise.all([
    ScrapedJob.findAll({
      attributes: ['source', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['source'],
      order: [['source', 'ASC']],
    }),
    groupedJobCount(sequelize),
    ScrapedJob.max('scrapedAt'),
  ]);

  return {
    total: allRows,
    latestScrapedAt: latest || null,
    sources: mergedJobSourceOptions(sourceRows.map((row) => ({
      source: row.get('source'),
      count: Number(row.get('count')),
    }))),
  };
}

async function groupedJobCount(sequelize) {
  const [row] = await sequelize.query(
    `
      SELECT COUNT(DISTINCT COALESCE(
        NULLIF(btrim(duplicate_key), ''),
        concat_ws(
          '::',
          COALESCE(NULLIF(regexp_replace(lower(btrim(coalesce(title, 'Untitled role'))), '\\s+', ' ', 'g'), ''), 'unknown'),
          COALESCE(
            NULLIF(normalized_company, ''),
            NULLIF(btrim(regexp_replace(
              regexp_replace(
                lower(btrim(coalesce(company, 'Unknown company'))),
                '\\m(incorporated|inc|llc|ltd|limited|corp|corporation|company|co)\\M\\.?$',
                '',
                'gi'
              ),
              '[^a-z0-9]+',
              ' ',
              'g'
            )), ''),
            NULLIF(regexp_replace(lower(btrim(coalesce(company, 'Unknown company'))), '\\s+', ' ', 'g'), ''),
            'unknown'
          )
        )
      ))::int AS count
      FROM scraped_jobs
    `,
    { type: QueryTypes.SELECT },
  );
  return Number(row?.count || 0);
}

async function existingImportedJobRows(sequelize, rows, { transaction } = {}) {
  const urls = [...new Set(rows.map((row) => clean(row.url)).filter(Boolean))];
  const duplicateKeys = [...new Set(rows.map((row) => clean(row.duplicateKey)).filter(Boolean))];
  if (!urls.length && !duplicateKeys.length) return [];

  return sequelize.query(
    `
      SELECT id, url, duplicate_key AS "duplicateKey", title, company, category, location
      FROM scraped_jobs
      WHERE (
          :hasUrls = true
          AND md5(url) IN (:urlHashes)
          AND url IN (:urls)
        )
        OR (
          :hasDuplicateKeys = true
          AND duplicate_key IS NOT NULL
          AND md5(duplicate_key) IN (:duplicateKeyHashes)
          AND duplicate_key IN (:duplicateKeys)
        )
    `,
    {
      replacements: {
        hasUrls: urls.length > 0,
        urls: urls.length ? urls : [''],
        urlHashes: md5Values(urls),
        hasDuplicateKeys: duplicateKeys.length > 0,
        duplicateKeys: duplicateKeys.length ? duplicateKeys : [''],
        duplicateKeyHashes: md5Values(duplicateKeys),
      },
      transaction,
      type: QueryTypes.SELECT,
    },
  );
}

function md5Values(values) {
  const hashes = values.map((value) => createHash('md5').update(String(value)).digest('hex'));
  return hashes.length ? hashes : [''];
}
