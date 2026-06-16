import { getDashboardMetrics } from '../application/dashboardService.js';

export async function getDashboard(req, res, next) {
  try {
    const dashboard = await getDashboardMetrics(req.query, { user: req.user });
    res.json({ dashboard });
  } catch (error) {
    next(error);
  }
}
