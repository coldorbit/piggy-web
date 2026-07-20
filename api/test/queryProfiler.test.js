import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createExplainAnalyzeProfiler,
  formatPlanSummary,
  isExplainableReadQuery,
  queryFingerprint,
  sqlFromSequelizeLog,
} from '../db/queryProfiler.js';

describe('EXPLAIN ANALYZE query profiler', () => {
  it('accepts only single-statement, non-locking read queries', () => {
    assert.equal(isExplainableReadQuery('Executed (default): SELECT * FROM jobs WHERE id = 1;'), true);
    assert.equal(isExplainableReadQuery('WITH rows AS (SELECT id FROM jobs) SELECT * FROM rows'), true);
    assert.equal(isExplainableReadQuery("SELECT ';' AS value"), true);
    assert.equal(isExplainableReadQuery("UPDATE jobs SET title = 'x'"), false);
    assert.equal(isExplainableReadQuery('WITH changed AS (DELETE FROM jobs RETURNING *) SELECT * FROM changed'), false);
    assert.equal(isExplainableReadQuery('SELECT * FROM jobs FOR UPDATE'), false);
    assert.equal(isExplainableReadQuery('SELECT 1; SELECT 2'), false);
    assert.equal(isExplainableReadQuery('SELECT * FROM information_schema.tables'), false);
  });

  it('normalizes Sequelize prefixes and literal values into stable fingerprints', () => {
    assert.equal(sqlFromSequelizeLog('Executed (abc): SELECT 1'), 'SELECT 1');
    assert.equal(
      queryFingerprint("Executed (default): SELECT * FROM jobs WHERE id = 42 AND title = 'Engineer'"),
      'SELECT * FROM jobs WHERE id = ? AND title = ?',
    );
  });

  it('profiles each read query shape once and disables recursive SQL logging', async () => {
    const calls = [];
    const messages = [];
    const sequelize = {
      async query(sql, options) {
        calls.push({ sql, options });
        return [{
          'QUERY PLAN': [{
            'Planning Time': 0.25,
            'Execution Time': 1.5,
            Plan: {
              'Node Type': 'Seq Scan',
              'Relation Name': 'jobs',
              'Actual Rows': 3,
              'Actual Loops': 1,
              'Rows Removed by Filter': 7,
              'Shared Hit Blocks': 4,
            },
          }],
        }];
      },
    };
    const profiler = createExplainAnalyzeProfiler({
      getSequelize: () => sequelize,
      enabled: true,
      minimumDurationMs: 10,
      logger: { info: (message) => messages.push(message), warn: (message) => messages.push(message) },
    });

    assert.equal(profiler.capture('Executed (default): SELECT * FROM jobs WHERE id = 1', 12), true);
    assert.equal(profiler.capture('Executed (default): SELECT * FROM jobs WHERE id = 2', 14), false);
    assert.equal(profiler.capture('Executed (default): SELECT * FROM jobs WHERE id = 3', 5), false);
    await profiler.whenIdle();

    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /^EXPLAIN \(ANALYZE, BUFFERS, SETTINGS, WAL, FORMAT JSON\) SELECT/);
    assert.equal(calls[0].options.logging, false);
    assert.match(messages[0], /execution=1\.50ms/);
    assert.match(messages[0], /seqScans=\[jobs rows=3\]/);
  });

  it('summarizes buffer pressure, filtered rows, sequential scans, and disk sorts', () => {
    const summary = formatPlanSummary({
      'Planning Time': 1,
      'Execution Time': 9,
      Plan: {
        'Node Type': 'Sort',
        'Sort Method': 'external merge',
        'Sort Space Type': 'Disk',
        'Sort Space Used': 512,
        'Temp Read Blocks': 2,
        'Temp Written Blocks': 3,
        Plans: [{
          'Node Type': 'Seq Scan',
          'Relation Name': 'events',
          'Actual Rows': 10,
          'Actual Loops': 2,
          'Rows Removed by Filter': 90,
          'Shared Read Blocks': 8,
        }],
      },
    });

    assert.match(summary, /buffers\(hit=0,read=8,tempRead=2,tempWrite=3\)/);
    assert.match(summary, /rowsRemoved=90/);
    assert.match(summary, /events rows=20/);
    assert.match(summary, /diskSorts=\[external merge 512kB\]/);
  });
});
