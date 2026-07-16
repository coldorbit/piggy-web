import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  caseInsensitiveCompanyName,
  sameCompanyBidByJobId,
  sameCompanyBidSummary,
} from '../server/modules/bidding/presentation/biddingQueriesController.js';

describe('same-company bid warnings', () => {
  it('compares only the trimmed company name without regard to case', async () => {
    let capturedSql = '';
    let capturedOptions = null;
    const sequelize = {
      async query(sql, options) {
        capturedSql = sql;
        capturedOptions = options;
        return [[
          { id: 1, job_id: 10, status: 'submitted', bid_at: new Date(), title: 'Engineer', company: 'ACME INC' },
          { id: 2, job_id: 11, status: 'submitted', bid_at: new Date(), title: 'Designer', company: 'Acme' },
        ]];
      },
    };

    const warnings = await sameCompanyBidByJobId({
      sequelize,
      profileId: 42,
      jobs: [
        { id: 20, company: '  Acme Inc  ' },
        { id: 21, company: 'acme' },
        { id: 22, company: 'Acme Incorporated' },
      ],
    });

    assert.equal(warnings.get('20').priorBidId, 1);
    assert.equal(warnings.get('21').priorBidId, 2);
    assert.equal(warnings.has('22'), false);
    assert.match(capturedSql, /FROM job_bids/);
    assert.match(capturedSql, /lower\(btrim\(coalesce\(scraped_jobs\.company, ''\)\)\) IN \(:companies\)/);
    assert.deepEqual(capturedOptions.replacements.companies, ['acme inc', 'acme', 'acme incorporated']);
    assert.deepEqual(capturedOptions.replacements.statuses, ['submitted', 'needs_follow_up', 'stale', 'blocked', 'interviewing', 'won', 'lost', 'mismatching_bid', 'spam_job']);
  });

  it('reports age from the prior bid timestamp', () => {
    const warning = sameCompanyBidSummary(
      { id: 1, job_id: 10, status: 'submitted', bid_at: '2026-07-10T12:00:00.000Z', company: 'Acme' },
      new Date('2026-07-13T11:59:59.000Z'),
    );

    assert.equal(warning.daysSincePrior, 2);
    assert.equal(warning.priorBidAt, '2026-07-10T12:00:00.000Z');
  });

  it('normalizes casing but preserves the actual company name', () => {
    assert.equal(caseInsensitiveCompanyName('  Example LLC  '), 'example llc');
    assert.notEqual(caseInsensitiveCompanyName('Example LLC'), caseInsensitiveCompanyName('Example'));
  });
});
