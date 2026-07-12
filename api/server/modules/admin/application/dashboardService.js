import { QueryTypes } from 'sequelize';
import { ensureWebModels, getSequelize } from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { normalizeTimeZone } from '../../../utils/localTime.js';
import { canAccessAssignedWorkspace, canAccessConsumption, isSuperadmin } from '../../../utils/roles.js';
import { formatDashboardResponse } from './dashboardFormatters.js';
import { DEFAULT_GRAIN, GRAIN_KEYS, dashboardQueries, grainConfigFor } from './dashboardQueries.js';

const DASHBOARD_CACHE_TTL_MS = 30_000;
const DASHBOARD_QUERY_CONCURRENCY = 4;
const dashboardCache = new Map();

export async function getDashboardMetrics(query = {}, { user } = {}) {
  await ensureWebModels();

  const requestedGrain = clean(query.grain);
  const grain = GRAIN_KEYS.includes(requestedGrain) ? requestedGrain : DEFAULT_GRAIN;
  const anchorDate = dashboardAnchorDate(query.anchorDate || query.anchor);
  const timeZone = normalizeTimeZone(query.timeZone || user?.timezone);
  const workspaceId = dashboardWorkspaceId(query, user);
  const includeConsumption = canAccessConsumption(user);
  const cacheKey = JSON.stringify({ grain, anchor: query.anchorDate || query.anchor || 'current', timeZone, workspaceId, includeConsumption });
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const sequelize = getSequelize();
  const sql = dashboardQueries(grainConfigFor(grain), { anchorDate, timeZone, workspaceId });

  const tasks = [
    () => queryOne(sequelize, sql.overall),
    () => queryAll(sequelize, sql.trend),
    () => queryAll(sequelize, sql.users),
    () => queryAll(sequelize, sql.bidders),
    () => queryAll(sequelize, sql.callers),
    () => queryAll(sequelize, sql.profileFunnels),
    () => queryAll(sequelize, sql.profileInterviewTrend),
    () => queryAll(sequelize, sql.roleFamilyFunnels),
    () => queryAll(sequelize, sql.userSources),
    () => queryAll(sequelize, sql.userCategories),
    () => queryAll(sequelize, sql.userProfiles),
    () => queryAll(sequelize, sql.profileActivity),
    () => queryAll(sequelize, sql.sources),
    () => queryAll(sequelize, sql.bidStatuses),
    () => queryAll(sequelize, sql.interviewStages),
    () => queryAll(sequelize, sql.interviewStatuses),
  ];
  if (includeConsumption) tasks.push(() => queryAll(sequelize, sql.consumption));

  const pending = runInBatches(tasks).then(([
    overall, trend, users, bidders, callers, profileFunnels, profileInterviewTrend,
    roleFamilyFunnels, userSources, userCategories, userProfiles, profileActivity,
    sources, bidStatuses, interviewStages, interviewStatuses, consumption = [],
  ]) => formatDashboardResponse({
    grain,
    grainOptions: GRAIN_KEYS,
    anchorDate,
    overall,
    trend,
    users,
    bidders,
    callers,
    profileFunnels,
    profileInterviewTrend,
    roleFamilyFunnels,
    userSources,
    userCategories,
    userProfiles,
    profileActivity,
    sources,
    bidStatuses,
    interviewStages,
    interviewStatuses,
    consumption,
  }));

  dashboardCache.set(cacheKey, { expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS, value: pending });
  pending.catch(() => dashboardCache.delete(cacheKey));
  pruneDashboardCache();
  return pending;
}

async function runInBatches(tasks) {
  const results = [];
  for (let index = 0; index < tasks.length; index += DASHBOARD_QUERY_CONCURRENCY) {
    results.push(...await Promise.all(tasks.slice(index, index + DASHBOARD_QUERY_CONCURRENCY).map((task) => task())));
  }
  return results;
}

function pruneDashboardCache() {
  const now = Date.now();
  for (const [key, entry] of dashboardCache) {
    if (entry.expiresAt <= now) dashboardCache.delete(key);
  }
}

function dashboardWorkspaceId(query = {}, user) {
  const id = Number(clean(query.workspaceId));
  if (Number.isInteger(id) && id > 0 && canAccessAssignedWorkspace(user, id)) return id;
  return isSuperadmin(user) ? null : user?.workspaceId || null;
}

function dashboardAnchorDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function queryAll(sequelize, sql) {
  return sequelize.query(sql, { type: QueryTypes.SELECT });
}

async function queryOne(sequelize, sql) {
  const rows = await queryAll(sequelize, sql);
  return rows[0] || {};
}
