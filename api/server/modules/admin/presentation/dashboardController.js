import { getDashboardMetrics } from '../application/dashboardService.js';

export async function getDashboard(req, res, next) {
  try {
    const dashboard = await getDashboardMetrics(req.query);
    res.json({ dashboard });
  } catch (error) {
    next(error);
  }
}
