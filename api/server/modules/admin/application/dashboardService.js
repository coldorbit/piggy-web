import { QueryTypes } from 'sequelize';
import { ensureWebModels, getSequelize } from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { normalizeTimeZone } from '../../../utils/localTime.js';
import { isSuperadmin } from '../../../utils/roles.js';
import { formatDashboardResponse } from './dashboardFormatters.js';
import { DEFAULT_GRAIN, GRAIN_KEYS, dashboardQueries, grainConfigFor } from './dashboardQueries.js';

export async function getDashboardMetrics(query = {}, { user } = {}) {
  await ensureWebModels();

  const requestedGrain = clean(query.grain);
  const grain = GRAIN_KEYS.includes(requestedGrain) ? requestedGrain : DEFAULT_GRAIN;
  const anchorDate = dashboardAnchorDate(query.anchorDate || query.anchor);
  const timeZone = normalizeTimeZone(query.timeZone || user?.timezone);
  const workspaceId = dashboardWorkspaceId(query, user);
  const sequelize = getSequelize();
  const sql = dashboardQueries(grainConfigFor(grain), { anchorDate, timeZone, workspaceId });

  const [
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
  ] = await Promise.all([
    queryOne(sequelize, sql.overall),
    queryAll(sequelize, sql.trend),
    queryAll(sequelize, sql.users),
    queryAll(sequelize, sql.bidders),
    queryAll(sequelize, sql.callers),
    queryAll(sequelize, sql.profileFunnels),
    queryAll(sequelize, sql.profileInterviewTrend),
    queryAll(sequelize, sql.roleFamilyFunnels),
    queryAll(sequelize, sql.userSources),
    queryAll(sequelize, sql.userCategories),
    queryAll(sequelize, sql.userProfiles),
    queryAll(sequelize, sql.profileActivity),
    queryAll(sequelize, sql.sources),
    queryAll(sequelize, sql.bidStatuses),
    queryAll(sequelize, sql.interviewStages),
    queryAll(sequelize, sql.interviewStatuses),
  ]);

  return formatDashboardResponse({
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
  });
}

function dashboardWorkspaceId(query = {}, user) {
  if (!isSuperadmin(user)) return user?.workspaceId || null;
  const id = Number(clean(query.workspaceId));
  return Number.isInteger(id) && id > 0 ? id : null;
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
