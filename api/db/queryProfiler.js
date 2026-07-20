import { QueryTypes } from 'sequelize';

const LOG_PREFIX = /^(?:Executed|Executing) \([^)]*\):\s*/i;
const UNSAFE_READ_PATTERN = /\b(?:insert|update|delete|merge|call|copy|alter|create|drop|truncate|grant|revoke|nextval|setval|pg_advisory)\b/i;
const LOCKING_READ_PATTERN = /\bfor\s+(?:no\s+key\s+)?(?:update|share)|\bfor\s+key\s+share\b/i;
const SCHEMA_INTROSPECTION_PATTERN = /\b(?:information_schema|pg_catalog|pg_indexes|pg_class|pg_index|pg_attribute|pg_constraint|app_schema_migrations|current_schema)\b/i;

export function createExplainAnalyzeProfiler({
  getSequelize,
  enabled = false,
  minimumDurationMs = 0,
  explainOnce = true,
  maxQueueSize = 100,
  output = 'summary',
  logger = console,
} = {}) {
  const queue = [];
  const fingerprints = new Set();
  const idleWaiters = [];
  let running = false;

  function capture(loggedSql, durationMs) {
    if (!enabled || !Number.isFinite(durationMs) || durationMs < minimumDurationMs) return false;
    const sql = sqlFromSequelizeLog(loggedSql);
    if (!isExplainableReadQuery(sql)) return false;

    const fingerprint = queryFingerprint(sql);
    if (explainOnce && fingerprints.has(fingerprint)) return false;
    if (queue.length >= maxQueueSize) {
      logger.warn?.(`EXPLAIN ANALYZE queue full; skipped query ${fingerprint}`);
      return false;
    }

    fingerprints.add(fingerprint);
    queue.push({ sql: trimTrailingSemicolon(sql), fingerprint });
    if (!running) setImmediate(runNext);
    running = true;
    return true;
  }

  async function runNext() {
    const item = queue.shift();
    if (!item) {
      running = false;
      while (idleWaiters.length) idleWaiters.shift()();
      return;
    }

    try {
      const rows = await getSequelize().query(
        `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, WAL, FORMAT JSON) ${item.sql}`,
        { type: QueryTypes.SELECT, logging: false },
      );
      const plan = explainDocument(rows);
      if (output === 'json') {
        logger.info?.(`EXPLAIN ANALYZE ${item.fingerprint} ${JSON.stringify(plan)}`);
      } else {
        logger.info?.(`EXPLAIN ANALYZE ${item.fingerprint} ${formatPlanSummary(plan)}`);
      }
    } catch (error) {
      logger.warn?.(`EXPLAIN ANALYZE failed for ${item.fingerprint}: ${error?.message || error}`);
    } finally {
      setImmediate(runNext);
    }
  }

  function whenIdle() {
    if (!running && !queue.length) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  }

  return { capture, whenIdle };
}

export function sqlFromSequelizeLog(value) {
  return String(value || '').replace(LOG_PREFIX, '').trim();
}

export function isExplainableReadQuery(value) {
  const sql = trimTrailingSemicolon(sqlFromSequelizeLog(value));
  if (!/^(?:select|with)\b/i.test(sql)) return false;
  if (UNSAFE_READ_PATTERN.test(sql) || LOCKING_READ_PATTERN.test(sql) || SCHEMA_INTROSPECTION_PATTERN.test(sql)) return false;
  return !hasMultipleStatements(sql);
}

export function queryFingerprint(value) {
  return sqlFromSequelizeLog(value)
    .replace(/'(?:''|[^'])*'/g, '?')
    .replace(/\b\d+(?:\.\d+)?\b/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function formatPlanSummary(document) {
  if (!document || typeof document !== 'object') return 'plan unavailable';
  const nodes = [];
  visitPlan(document.Plan, nodes);
  const sequentialScans = nodes
    .filter((node) => node['Node Type'] === 'Seq Scan')
    .map((node) => `${node['Relation Name'] || 'unknown'} rows=${actualRows(node)}`);
  const diskSorts = nodes
    .filter((node) => String(node['Sort Space Type'] || '').toLowerCase() === 'disk')
    .map((node) => `${node['Sort Method'] || 'sort'} ${node['Sort Space Used'] || 0}kB`);
  const removedRows = nodes.reduce((total, node) => total + numberValue(node['Rows Removed by Filter']), 0);
  const sharedHits = nodes.reduce((total, node) => total + numberValue(node['Shared Hit Blocks']), 0);
  const sharedReads = nodes.reduce((total, node) => total + numberValue(node['Shared Read Blocks']), 0);
  const tempReads = nodes.reduce((total, node) => total + numberValue(node['Temp Read Blocks']), 0);
  const tempWrites = nodes.reduce((total, node) => total + numberValue(node['Temp Written Blocks']), 0);
  const details = [
    `planning=${numberValue(document['Planning Time']).toFixed(2)}ms`,
    `execution=${numberValue(document['Execution Time']).toFixed(2)}ms`,
    `buffers(hit=${sharedHits},read=${sharedReads},tempRead=${tempReads},tempWrite=${tempWrites})`,
    `rowsRemoved=${removedRows}`,
  ];
  if (sequentialScans.length) details.push(`seqScans=[${sequentialScans.join(', ')}]`);
  if (diskSorts.length) details.push(`diskSorts=[${diskSorts.join(', ')}]`);
  return details.join(' ');
}

function explainDocument(rows) {
  const value = rows?.[0]?.['QUERY PLAN'];
  if (Array.isArray(value)) return value[0] || null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)?.[0] || null;
    } catch {
      return null;
    }
  }
  return value || null;
}

function visitPlan(node, result) {
  if (!node || typeof node !== 'object') return;
  result.push(node);
  for (const child of node.Plans || []) visitPlan(child, result);
}

function actualRows(node) {
  return numberValue(node['Actual Rows']) * Math.max(1, numberValue(node['Actual Loops']));
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function trimTrailingSemicolon(value) {
  return String(value || '').trim().replace(/;+\s*$/, '');
}

function hasMultipleStatements(sql) {
  const withoutQuotedValues = sql
    .replace(/'(?:''|[^'])*'/g, '')
    .replace(/"(?:""|[^"])*"/g, '');
  return withoutQuotedValues.includes(';');
}
