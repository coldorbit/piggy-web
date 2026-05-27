import { ensureWebModels, getScrapedJobModel, getSequelize } from '../../db.js';
import { Op } from 'sequelize';
import { buildJobQuery, canImportJobs, formatJob, jobsFromCsv, parseHiddenState, parseSpamReview } from '../services/jobs.js';
import { InputError } from '../utils/errors.js';

export async function listJobs(req, res, next) {
  try {
    await ensureWebModels();
    const ScrapedJob = getScrapedJobModel();
    const { where, order, limit, offset } = buildJobQuery(req.query);
    const { rows, count } = await ScrapedJob.findAndCountAll({
      where,
      order,
      limit,
      offset,
    });

    res.json({
      jobs: rows.map(formatJob),
      total: count,
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

export async function getMeta(_req, res, next) {
  try {
    await ensureWebModels();
    const ScrapedJob = getScrapedJobModel();
    const sequelize = getSequelize();
    const [sources, total, latest] = await Promise.all([
      ScrapedJob.findAll({
        attributes: ['source', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['source'],
        order: [['source', 'ASC']],
      }),
      ScrapedJob.count(),
      ScrapedJob.max('scrapedAt'),
    ]);

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
