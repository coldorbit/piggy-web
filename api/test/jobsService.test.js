import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupedJobsFromRows, jobsFromCsv, paginateGroupedJobs } from '../server/modules/jobs/application/jobsService.js';

describe('grouped scraped jobs', () => {
  it('groups matching title and company rows while preserving selectable locations', () => {
    const rows = [
      jobRow({ id: 1, title: 'Software Engineer', company: 'Acme', location: 'New York, NY' }),
      jobRow({ id: 2, title: ' software engineer ', company: 'ACME', location: 'Austin, TX' }),
      jobRow({ id: 3, title: 'Data Engineer', company: 'Acme', location: 'Remote' }),
    ];

    const groups = groupedJobsFromRows(rows);

    assert.equal(groups.length, 2);
    assert.equal(groups[0].title, 'Software Engineer');
    assert.equal(groups[0].locationOptions.length, 2);
    assert.deepEqual(
      groups[0].locationOptions.map((option) => option.locationLabel),
      ['Austin, TX', 'New York, NY'],
    );
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
});

describe('manual CSV job imports', () => {
  it('treats imported jobs as Manual even when source columns are present', () => {
    const [job] = jobsFromCsv(
      [
        'url,title,company,source,source_url',
        'https://example.com/jobs/manual-1,Software Engineer,Acme,LinkedIn,https://linkedin.com/jobs/view/1',
      ].join('\n'),
      { importedBy: 'test-user' },
    );

    assert.equal(job.source, 'Manual');
    assert.equal(job.sourceUrl, null);
    assert.equal(job.rawJob.importType, 'manual');
    assert.equal(job.rawJob.source, undefined);
    assert.equal(job.rawJob.source_url, undefined);
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
    source: 'linkedin',
    sourceUrl: 'https://linkedin.com',
    postedAt: new Date('2026-01-01T00:00:00Z'),
    scrapedAt: new Date('2026-01-02T00:00:00Z'),
    listingText: 'Job description',
    rawJob: {},
    isSpam: null,
    spamReviewedAt: null,
    isHidden: false,
    hiddenAt: null,
  };
}
