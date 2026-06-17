import { readValidSession } from '../../auth.js';
import { MARKETPLACE_ACCESS_ROLES, canAccessAssessments, canAccessConsumption, isAdminRole, isSuperadmin } from '../utils/roles.js';

export async function requireAuth(req, res, next) {
  try {
    const user = await readValidSession(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!isAdminRole(req.user)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  });
}

export function requireSuperadmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!isSuperadmin(req.user)) {
      res.status(403).json({ error: 'Superadmin access required' });
      return;
    }
    next();
  });
}

export function requireConsumptionAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!canAccessConsumption(req.user)) {
      res.status(403).json({ error: 'Consumption access required' });
      return;
    }
    next();
  });
}

export function requireAssessmentAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!canAccessAssessments(req.user)) {
      res.status(403).json({ error: 'Assessment access required' });
      return;
    }
    next();
  });
}

export function requireMarketplaceAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!MARKETPLACE_ACCESS_ROLES.includes(req.user?.role)) {
      res.status(403).json({ error: 'Marketplace access requires an admin role' });
      return;
    }
    next();
  });
}
