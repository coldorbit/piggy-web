import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Op } from 'sequelize';
import { buildJobDuplicateKey, buildJobQuery, canImportJobs, capitalizeJobTitle, groupedJobsFromRows, jobDateFiltersForUser, jobSummaryAttributes, jobsFromCsv, mergedJobSourceOptions, normalizeCompanyName, normalizeJobCategory, paginateGroupedJobs, planCsvJobImport, publicJobIdFromId } from '../server/modules/jobs/application/jobsService.js';
import { addLocalDays, localDayStart } from '../server/utils/localTime.js';

describe('job query filters', () => {
  it('keeps large descriptions and raw payloads out of list queries', () => {
    const attributes = jobSummaryAttributes();
    const summarySql = attributes.include[0][0].val;

    assert.deepEqual(attributes.exclude, ['listingText', 'rawJob']);
    assert.match(summarySql, /jsonb_build_object/);
    assert.doesNotMatch(summarySql, /description|listingText|jobDescription/);
  });

  it('filters roleFamily against the scraped_jobs category field', () => {
    const query = buildJobQuery({ roleFamily: 'data', since: 'all', visibility: 'all' });

    assert.equal(query.where.category, 'data');
  });

  it('normalizes friendly roleFamily values before comparing category', () => {
    assert.equal(normalizeJobCategory('AI/ML'), 'ai_ml');
    assert.equal(normalizeJobCategory('data engineering'), 'data');

    const query = buildJobQuery({ roleFamily: 'AI/ML', since: 'all', visibility: 'all' });
    assert.equal(query.where.category, 'ai_ml');
  });

  it('applies inclusive custom date ranges by local day', () => {
    const query = buildJobQuery({
      since: 'custom',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-03',
      visibility: 'all',
    }, { timeZone: 'America/Los_Angeles' });

    assert.equal(query.where.scrapedAt[Op.gte].toISOString(), '2026-06-01T07:00:00.000Z');
    assert.equal(query.where.scrapedAt[Op.lt].toISOString(), '2026-06-04T07:00:00.000Z');
  });

  it('does not add a date filter for all time', () => {
    const query = buildJobQuery({ since: 'all', visibility: 'all' });

    assert.equal(query.where.scrapedAt, undefined);
  });

  it('does not add a date filter by default', () => {
    const query = buildJobQuery({ visibility: 'all' });

    assert.equal(query.where.scrapedAt, undefined);
  });

  it('honors the until-yesterday date preset', () => {
    const query = buildJobQuery({ since: 'until_yesterday', visibility: 'all' });
    const today = new Date();

    assert.equal(query.where.scrapedAt[Op.gte], undefined);
    assert.equal(query.where.scrapedAt[Op.lt].toISOString(), localDayStart(today).toISOString());
  });

  it('filters the tomorrow date preset to the next local day', () => {
    const query = buildJobQuery({ since: 'tomorrow', visibility: 'all' }, { timeZone: 'America/Los_Angeles' });
    const todayStart = localDayStart(new Date(), { timeZone: 'America/Los_Angeles' });

    assert.equal(query.where.scrapedAt[Op.gte].toISOString(), addLocalDays(todayStart, 1, { timeZone: 'America/Los_Angeles' }).toISOString());
    assert.equal(query.where.scrapedAt[Op.lt].toISOString(), addLocalDays(todayStart, 2, { timeZone: 'America/Los_Angeles' }).toISOString());
  });

  it('only honors tomorrow date filters for admins', () => {
    const userQuery = jobDateFiltersForUser({ since: 'tomorrow', dateFrom: '2026-06-01', dateTo: '2026-06-02' }, { role: 'user' });
    const adminQuery = jobDateFiltersForUser({ since: 'tomorrow' }, { role: 'admin' });

    assert.deepEqual(userQuery, { since: 'all', dateFrom: '', dateTo: '' });
    assert.deepEqual(adminQuery, { since: 'tomorrow' });
  });

  it('searches by public job id', () => {
    const query = buildJobQuery({ search: 'J000001A', since: 'all', visibility: 'all' });

    assert.ok(query.where[Op.or].some((condition) => condition.publicJobId?.[Op.iLike] === '%J000001A%'));
  });

  it('normalizes source filters before comparing scraped job sources', () => {
    const query = buildJobQuery({ source: 'LinkedIn ', since: 'all', visibility: 'all' });
    const sourceCondition = query.where[Op.and].find((condition) => String(condition.val || '').includes('regexp_replace'));

    assert.equal(sourceCondition.val.includes("regexp_replace(btrim(coalesce(source, '')), '[-_[:space:]]+', ' ', 'g')"), true);
    assert.equal(sourceCondition.val.endsWith("= 'linkedin'"), true);
  });

  it('filters Built In source values without compact aliasing', () => {
    const query = buildJobQuery({ source: 'Built In', since: 'all', visibility: 'all' });
    const sourceCondition = query.where[Op.and].find((condition) => String(condition.val || '').includes('regexp_replace'));

    assert.equal(sourceCondition.val.endsWith("= 'built in'"), true);
    assert.equal(sourceCondition.val.includes(' IN '), false);
  });

  it('adds a Canada location region condition', () => {
    const query = buildJobQuery({ locationRegion: 'canada', since: 'all', visibility: 'all' });
    const locationCondition = query.where[Op.and].find((condition) => String(condition.val || '').includes('location'));

    assert.match(locationCondition.val, /canada/);
    assert.match(locationCondition.val, /raw_job->>'location'/);
  });

  it('adds US and worldwide location conditions while excluding Canada', () => {
    const query = buildJobQuery({ locationRegion: 'us_worldwide', since: 'all', visibility: 'all' });
    const locationCondition = query.where[Op.and].find((condition) => condition[Op.and]);
    const [includeCondition, excludeCondition] = locationCondition[Op.and];

    assert.ok(includeCondition[Op.or].some((condition) => String(condition.val || '').includes('worldwide')));
    assert.ok(includeCondition[Op.or].some((condition) => String(condition.val || '').includes("raw_job->>'location'")));
    assert.ok(excludeCondition[Op.or].some((condition) => String(condition.val || '').includes('!~*')));
  });
});


describe('grouped scraped jobs', () => {
  it('builds an 8-character public job id from the database id', () => {
    assert.equal(publicJobIdFromId(1), 'J0000001');
    assert.equal(publicJobIdFromId(35), 'J000000Z');
    assert.equal(publicJobIdFromId(36), 'J0000010');
    assert.equal(publicJobIdFromId('ab12cd34'), 'AB12CD34');
  });

  it('groups matching title and company rows while preserving selectable locations', () => {
    const rows = [
      jobRow({ id: 1, title: 'Software Engineer', company: 'Acme', location: 'New York, NY' }),
      jobRow({ id: 2, title: ' software engineer ', company: 'ACME', location: 'Austin, TX' }),
      jobRow({ id: 3, title: 'Data Engineer', company: 'Acme', location: 'Remote' }),
    ];

    const groups = groupedJobsFromRows(rows);

    assert.equal(groups.length, 2);
    assert.equal(groups[0].title, 'Software Engineer');
    assert.equal(groups[0].publicJobId, 'J0000001');
    assert.equal(groups[0].locationOptions.length, 2);
    assert.deepEqual(
      groups[0].locationOptions.map((option) => [option.publicJobId, option.locationLabel]),
      [['J0000002', 'Austin, TX'], ['J0000001', 'New York, NY']],
    );
  });

  it('keeps grouped representatives stable regardless of row order', () => {
    const earlierAustin = jobRow({
      id: 10,
      source: 'builtin',
      title: 'Software Engineer',
      company: 'Acme',
      location: 'Austin, TX',
      postedAt: new Date('2026-01-01T00:00:00.000Z'),
      scrapedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const laterRemote = jobRow({
      id: 20,
      source: 'builtin',
      title: 'Software Engineer',
      company: 'ACME',
      location: 'Remote',
      postedAt: new Date('2026-01-03T00:00:00.000Z'),
      scrapedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const firstGroup = groupedJobsFromRows([earlierAustin, laterRemote])[0];
    const secondGroup = groupedJobsFromRows([laterRemote, earlierAustin])[0];

    assert.equal(firstGroup.representativeJobId, 20);
    assert.equal(secondGroup.representativeJobId, 20);
    assert.equal(firstGroup.id, 'job-group:software engineer::acme');
    assert.equal(firstGroup.title, 'Software Engineer');
    assert.equal(secondGroup.title, 'Software Engineer');
    assert.equal(firstGroup.location, 'Austin, TX + 1 more');
    assert.equal(secondGroup.location, 'Austin, TX + 1 more');
    assert.deepEqual(
      firstGroup.locationOptions.map((option) => option.id),
      secondGroup.locationOptions.map((option) => option.id),
    );
  });

  it('groups cross-source rows by normalized job identity', () => {
    const groups = groupedJobsFromRows([
      jobRow({ id: 10, source: 'builtin', title: 'Software Engineer', company: 'Acme', location: 'Austin, TX' }),
      jobRow({ id: 20, source: 'Built In', title: 'Software Engineer', company: 'ACME', location: 'Remote' }),
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].id, 'job-group:software engineer::acme');
    assert.equal(groups[0].locationOptions.length, 2);
  });

  it('reports pagination totals as grouped jobs', () => {
    const rows = [
      jobRow({ id: 1, title: 'Software Engineer', company: 'Acme', location: 'New York, NY' }),
      jobRow({ id: 2, title: 'Software Engineer', company: 'Acme', location: 'Austin, TX' }),
      jobRow({ id: 3, title: 'Data Engineer', company: 'Acme', location: 'Remote' }),
    ];

    const page = paginateGroupedJobs(rows, { limit: 1, offset: 0 });

    assert.equal(page.count, 2);
    assert.equal(page.rows.length, 1);
  });

  it('can omit raw job blobs from grouped job list responses', () => {
    const rows = [
      jobRow({
        id: 1,
        title: 'Software Engineer',
        company: 'Acme',
        location: 'New York, NY',
        listingText: null,
        rawJob: { description: 'Raw description', largePayload: 'x'.repeat(1000) },
      }),
      jobRow({
        id: 2,
        title: 'Software Engineer',
        company: 'Acme',
        location: 'Austin, TX',
        listingText: null,
        rawJob: { description: 'Other raw description', largePayload: 'x'.repeat(1000) },
      }),
    ];

    const page = paginateGroupedJobs(rows, { limit: 1, offset: 0 }, { includeRawJob: false });

    assert.equal(page.rows[0].rawJob, undefined);
    assert.ok(['Raw description', 'Other raw description'].includes(page.rows[0].description));
    assert.equal(page.rows[0].locationOptions[0].rawJob, undefined);
    assert.ok(page.rows[0].locationOptions.every((option) => option.description));
  });
});

describe('job source options', () => {
  it('merges source counts by normalized source without source-specific aliases', () => {
    const sources = mergedJobSourceOptions([
      { source: 'linkedin', count: 2 },
      { source: ' LinkedIn ', count: 3 },
      { source: 'Manual', count: 1 },
      { source: 'builtin', count: 4 },
      { source: 'Built In', count: 5 },
    ]);

    assert.deepEqual(sources, [
      { source: 'Built In', count: 5 },
      { source: 'builtin', count: 4 },
      { source: 'LinkedIn', count: 5 },
      { source: 'Manual', count: 1 },
    ]);
  });
});

describe('manual CSV job imports', () => {
  it('allows internal users to import job CSVs', () => {
    assert.equal(canImportJobs({ role: 'internal' }), true);
  });

  it('rejects CSV imports with mismatched required headers', () => {
    assert.throws(
      () => jobsFromCsv(
        [
          'url,position,employer',
          'https://example.com/jobs/mismatched-headers,Software Engineer,Acme',
        ].join('\n'),
        { importedBy: 'test-user' },
      ),
      /Missing required columns: title, company/,
    );
  });

  it('accepts aliases for required CSV import headers', () => {
    const [job] = jobsFromCsv(
      [
        'job url,job title,company name',
        'https://example.com/jobs/alias-headers,Software Engineer,Acme',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    assert.equal(job.url, 'https://example.com/jobs/alias-headers');
    assert.equal(job.title, 'Software Engineer');
    assert.equal(job.company, 'Acme');
  });

  it('normalizes company names for imported jobs', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company',
        'https://example.com/jobs/company-normalization,Software Engineer,Acme Inc.',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    assert.equal(normalizeCompanyName('Acme, Inc.'), 'acme');
    assert.equal(job.normalizedCompany, 'acme');
    assert.equal(job.duplicateKey, 'job::acme::software engineer::unknown location');
  });

  it('capitalizes imported job titles while preserving acronyms', () => {
    assert.equal(capitalizeJobTitle('senior ai/ml software engineer'), 'Senior AI/ML Software Engineer');
    assert.equal(capitalizeJobTitle('SENIOR API QA ENGINEER'), 'Senior API QA Engineer');
  });

  it('capitalizes every word in imported job titles', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company',
        'https://example.com/jobs/manual-title-1,senior ai/ml software engineer,Acme',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    assert.equal(job.title, 'Senior AI/ML Software Engineer');
  });

  it('uses the import time as the scraped date for manually imported jobs', () => {
    const importedAt = new Date('2026-06-16T14:00:00.000Z');
    const [job] = jobsFromCsv(
      [
        'url,title,company',
        'https://example.com/jobs/manual-next-day-1,Software Engineer,Acme',
      ].join('\n'),
      { importedBy: 'test-user', importedAt, timeZone: 'America/Los_Angeles' },
    );

    assert.equal(job.firstSeenAt.toISOString(), importedAt.toISOString());
    assert.equal(job.updatedAt.toISOString(), importedAt.toISOString());
    assert.equal(job.rawJob.importedAt, importedAt.toISOString());
    assert.equal(job.scrapedAt.toISOString(), importedAt.toISOString());
  });

  it('treats imported LinkedIn jobs as both LinkedIn-sourced and manual', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,source,source_url',
        'https://example.com/jobs/manual-1,Software Engineer,Acme,LinkedIn,https://linkedin.com/jobs/view/1',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    assert.equal(job.source, 'linkedin');
    assert.equal(job.sourceUrl, 'https://linkedin.com/jobs/view/1');
    assert.equal(job.rawJob.importType, 'manual');
    assert.equal(job.rawJob.source, 'LinkedIn');
    assert.equal(job.rawJob.source_url, 'https://linkedin.com/jobs/view/1');
  });

  it('keeps non-LinkedIn imported source columns as Manual', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,source,source_url',
        'https://example.com/jobs/manual-1,Software Engineer,Acme,Indeed,https://indeed.com/viewjob?jk=1',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    assert.equal(job.source, 'Manual');
    assert.equal(job.sourceUrl, null);
    assert.equal(job.rawJob.importType, 'manual');
    assert.equal(job.rawJob.source, undefined);
    assert.equal(job.rawJob.source_url, undefined);
  });

  it('imports a tab-delimited row copied from Google Sheets', () => {
    const [job] = jobsFromCsv(
      [
        'title\tcompany\turl\tlocation\tcategory\tpostedAt\tsource\tsourceUrl\tlistingText',
        [
          'Backend Engineer',
          'Acme',
          'https://example.com/jobs/sheets-1',
          'Remote',
          'software',
          '2026-06-01',
          'LinkedIn',
          'https://linkedin.com/jobs/view/1',
          'Build reliable services',
        ].join('\t'),
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    assert.equal(job.title, 'Backend Engineer');
    assert.equal(job.company, 'Acme');
    assert.equal(job.url, 'https://example.com/jobs/sheets-1');
    assert.equal(job.location, 'Remote');
    assert.equal(job.category, 'software');
    assert.equal(job.listingText, 'Build reliable services');
    assert.equal(job.source, 'linkedin');
    assert.equal(job.sourceUrl, 'https://linkedin.com/jobs/view/1');
    assert.equal(job.rawJob.importType, 'manual');
  });

  it('plans category updates for existing imported job URLs', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,category',
        'https://example.com/jobs/existing-1,Data Engineer,Acme,data',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    const plan = planCsvJobImport([job], [
      {
        url: 'https://example.com/jobs/existing-1',
        title: 'Data Engineer',
        company: 'Acme',
        category: 'software',
      },
    ]);

    assert.equal(plan.insertRows.length, 0);
    assert.equal(plan.duplicateExistingRows.length, 1);
    assert.deepEqual(plan.categoryUpdates, [{ url: 'https://example.com/jobs/existing-1', key: 'url:https://example.com/jobs/existing-1', category: 'data' }]);
  });

  it('plans location updates for existing imported job URLs', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,location,category',
        'https://example.com/jobs/existing-location,Data Engineer,Acme,Canada,data',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    const plan = planCsvJobImport([job], [
      {
        url: 'https://example.com/jobs/existing-location',
        title: 'Data Engineer',
        company: 'Acme',
        category: 'data',
        location: null,
      },
    ]);

    assert.equal(plan.insertRows.length, 0);
    assert.equal(plan.duplicateExistingRows.length, 1);
    assert.deepEqual(plan.locationUpdates, [{ url: 'https://example.com/jobs/existing-location', key: 'url:https://example.com/jobs/existing-location', location: 'Canada' }]);
  });

  it('deduplicates CSV imports against existing normalized job fingerprints', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,location,category',
        'https://jobs.example.com/acme/software-engineer?utm_source=test,Software Engineer,Acme Inc.,Remote,software',
      ].join('\n'),
      { importedBy: 'test-user' },
    );
    const existingDuplicateKey = buildJobDuplicateKey({
      url: 'https://other.example.com/roles/123',
      title: 'software engineer',
      company: 'ACME',
      location: 'Remote',
    });

    const plan = planCsvJobImport([job], [
      {
        id: 42,
        url: 'https://other.example.com/roles/123',
        duplicateKey: existingDuplicateKey,
        title: 'Software Engineer',
        company: 'Acme',
        category: 'software',
        location: 'Remote',
      },
    ]);

    assert.equal(plan.insertRows.length, 0);
    assert.equal(plan.duplicateExistingRows.length, 1);
    assert.equal(plan.duplicateExistingRows[0].matchType, 'normalized_job');
  });

  it('plans category updates by id for existing normalized job fingerprint matches', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,location,category',
        'https://jobs.example.com/acme/data-engineer?utm_source=test,Data Engineer,Acme Inc.,Remote,data',
      ].join('\n'),
      { importedBy: 'test-user' },
    );
    const existingDuplicateKey = buildJobDuplicateKey({
      url: 'https://other.example.com/roles/456',
      title: 'data engineer',
      company: 'ACME',
      location: 'Remote',
    });

    const plan = planCsvJobImport([job], [
      {
        id: 456,
        url: 'https://other.example.com/roles/456',
        duplicateKey: existingDuplicateKey,
        title: 'Data Engineer',
        company: 'Acme',
        category: 'software',
        location: 'Remote',
      },
    ]);

    assert.equal(plan.insertRows.length, 0);
    assert.equal(plan.duplicateExistingRows.length, 1);
    assert.deepEqual(plan.categoryUpdates, [{ id: 456, key: 'id:456', category: 'data' }]);
  });

  it('does not update existing categories when the CSV category is blank', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,category',
        'https://example.com/jobs/existing-2,ML Engineer,Acme,',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    const plan = planCsvJobImport([job], [
      {
        url: 'https://example.com/jobs/existing-2',
        title: 'ML Engineer',
        company: 'Acme',
        category: 'ai_ml',
      },
    ]);

    assert.equal(job.category, 'software');
    assert.equal(plan.insertRows.length, 0);
    assert.equal(plan.duplicateExistingRows.length, 1);
    assert.deepEqual(plan.categoryUpdates, []);
  });

  it('does not downgrade existing non-software categories to software from CSV import', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,category',
        'https://example.com/jobs/existing-3,ML Engineer,Acme,software',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    const plan = planCsvJobImport([job], [
      {
        url: 'https://example.com/jobs/existing-3',
        title: 'ML Engineer',
        company: 'Acme',
        category: 'ai_ml',
      },
    ]);

    assert.equal(job.category, 'software');
    assert.equal(plan.insertRows.length, 0);
    assert.equal(plan.duplicateExistingRows.length, 1);
    assert.deepEqual(plan.categoryUpdates, []);
  });
});

function jobRow(overrides) {
  return {
    id: overrides.id,
    title: overrides.title,
    company: overrides.company,
    location: overrides.location,
    category: 'software',
    url: `https://example.com/jobs/${overrides.id}`,
    source: overrides.source || 'linkedin',
    sourceUrl: overrides.sourceUrl || 'https://linkedin.com',
    postedAt: overrides.postedAt || new Date('2026-01-01T00:00:00Z'),
    scrapedAt: overrides.scrapedAt || new Date('2026-01-02T00:00:00Z'),
    listingText: Object.prototype.hasOwnProperty.call(overrides, 'listingText') ? overrides.listingText : 'Job description',
    rawJob: overrides.rawJob || {},
    isSpam: null,
    spamReviewedAt: null,
    isHidden: false,
    hiddenAt: null,
  };
}
