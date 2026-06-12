import { QueryTypes } from 'sequelize';
import { ensureWebModels, getSequelize } from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { formatDashboardResponse } from './dashboardFormatters.js';
import { DEFAULT_GRAIN, GRAIN_KEYS, dashboardQueries, grainConfigFor } from './dashboardQueries.js';

export async function getDashboardMetrics(query = {}) {
  await ensureWebModels();

  const requestedGrain = clean(query.grain);
  const grain = GRAIN_KEYS.includes(requestedGrain) ? requestedGrain : DEFAULT_GRAIN;
  const sequelize = getSequelize();
  const sql = dashboardQueries(grainConfigFor(grain));

  const [
    overall,
    trend,
    users,
    callers,
    userSources,
    userCategories,
    userProfiles,
    sources,
    bidStatuses,
    interviewStages,
    interviewStatuses,
  ] = await Promise.all([
    queryOne(sequelize, sql.overall),
    queryAll(sequelize, sql.trend),
    queryAll(sequelize, sql.users),
    queryAll(sequelize, sql.callers),
    queryAll(sequelize, sql.userSources),
    queryAll(sequelize, sql.userCategories),
    queryAll(sequelize, sql.userProfiles),
    queryAll(sequelize, sql.sources),
    queryAll(sequelize, sql.bidStatuses),
    queryAll(sequelize, sql.interviewStages),
    queryAll(sequelize, sql.interviewStatuses),
  ]);

  return formatDashboardResponse({
    grain,
    grainOptions: GRAIN_KEYS,
    overall,
    trend,
    users,
    callers,
    userSources,
    userCategories,
    userProfiles,
    sources,
    bidStatuses,
    interviewStages,
    interviewStatuses,
  });
}

async function queryAll(sequelize, sql) {
  return sequelize.query(sql, { type: QueryTypes.SELECT });
}

async function queryOne(sequelize, sql) {
  const rows = await queryAll(sequelize, sql);
  return rows[0] || {};
}
