import { ensureWebModels } from '../../../../db.js';
import { currentDbUser } from '../application/profilesService.js';
import { getPersonalDashboardMetrics } from '../application/personalDashboardService.js';
import { canAccessPersonalDashboard } from '../../../utils/roles.js';

export async function getPersonalDashboard(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    if (!canAccessPersonalDashboard(user)) {
      res.status(403).json({ error: 'Personal dashboards are available for user and finance manager roles only' });
      return;
    }

    const dashboard = await getPersonalDashboardMetrics(user, req.query);
    res.json({ dashboard });
  } catch (error) {
    next(error);
  }
}
