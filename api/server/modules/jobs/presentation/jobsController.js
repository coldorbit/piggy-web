import { ensureWebModels, getJobBidModel, getScrapedJobModel, getSequelize, getTailoredResumeModel } from '../../../../db.js';
import { Op } from 'sequelize';
import {
  buildJobQuery,
  canImportJobs,
  formatJob,
  groupedJobsFromRows,
  jobsFromCsv,
  paginateGroupedJobs,
  parseHiddenState,
  parseSpamReview,
  validJobUrl,
} from '../application/jobsService.js';
import { InputError } from '../../../utils/errors.js';
import { clean } from '../../../utils/index.js';
import { isAdminRole } from '../../../utils/roles.js';

export async function listJobs(req, res, next) {
  try {
    await ensureWebModels();
    const ScrapedJob = getScrapedJobModel();
    const { where, order, limit, offset } = buildJobQuery(req.query);
    const rows = await ScrapedJob.findAll({
      where,
      order,
    });
    const grouped = paginateGroupedJobs(rows, { limit, offset });

    res.json({
      jobs: grouped.rows,
      total: grouped.count,
      limit,
      offset,
    });
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
          duplicateKey: nextUrl,
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

    const rows = jobsFromCsv(req.body?.csv || req.body?.csvText || '', { importedBy: req.user?.username });
    const ScrapedJob = getScrapedJobModel();
    const existingRows = await ScrapedJob.findAll({
      attributes: ['url'],
      where: { url: { [Op.in]: rows.map((row) => row.url) } },
    });
    const existingUrls = new Set(existingRows.map((row) => row.url));
    const seenUrls = new Set();
    const insertRows = rows.filter((row) => {
      if (existingUrls.has(row.url) || seenUrls.has(row.url)) return false;
      seenUrls.add(row.url);
      return true;
    });

    if (insertRows.length) await ScrapedJob.bulkCreate(insertRows, { ignoreDuplicates: true });

    res.status(201).json({
      imported: insertRows.length,
      skipped: rows.length - insertRows.length,
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
    const ScrapedJob = getScrapedJobModel();
    const sequelize = getSequelize();
    const [sources, allRows, latest] = await Promise.all([
      ScrapedJob.findAll({
        attributes: ['source', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['source'],
        order: [['source', 'ASC']],
      }),
      ScrapedJob.findAll(),
      ScrapedJob.max('scrapedAt'),
    ]);
    const total = groupedJobsFromRows(allRows).length;

    res.json({
      total,
      latestScrapedAt: latest || null,
      sources: sources.map((row) => ({
        source: row.get('source'),
        count: Number(row.get('count')),
      })),
    });
  } catch (error) {
    next(error);
  }
}
