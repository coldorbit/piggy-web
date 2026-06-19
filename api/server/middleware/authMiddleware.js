import { readValidSession } from '../../auth.js';
import {
  MARKETPLACE_ACCESS_ROLES,
  canAccessBidderDirectory,
  canAccessAssessments,
  canAccessBidWorkspace,
  canAccessConsumption,
  canAccessInbox,
  canAccessInterviews,
  canAccessJobs,
  canAccessPersonalDashboard,
  canManageCallers,
  isAdminRole,
  isSuperadmin,
} from '../utils/roles.js';

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

export function requireJobAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!canAccessJobs(req.user)) {
      res.status(403).json({ error: 'Job access required' });
      return;
    }
    next();
  });
}

export function requireBidWorkspaceAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!canAccessBidWorkspace(req.user)) {
      res.status(403).json({ error: 'Application access required' });
      return;
    }
    next();
  });
}

export function requirePersonalDashboardAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!canAccessPersonalDashboard(req.user)) {
      res.status(403).json({ error: 'Dashboard access required' });
      return;
    }
    next();
  });
}

export function requireInterviewAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!canAccessInterviews(req.user)) {
      res.status(403).json({ error: 'Interview access required' });
      return;
    }
    next();
  });
}

export function requireBidJobsAccess(req, res, next) {
  requireAuth(req, res, () => {
    const bidTab = String(req.query?.bidTab || '').toLowerCase();
    if (bidTab === 'interviews' ? canAccessInterviews(req.user) : canAccessBidWorkspace(req.user)) {
      next();
      return;
    }
    res.status(403).json({ error: bidTab === 'interviews' ? 'Interview access required' : 'Application access required' });
  });
}

export function requireBidOrInterviewAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (canAccessBidWorkspace(req.user) || canAccessInterviews(req.user)) {
      next();
      return;
    }
    res.status(403).json({ error: 'Application or interview access required' });
  });
}

export function requireBidderDirectoryAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!canAccessBidderDirectory(req.user)) {
      res.status(403).json({ error: 'Bidder access required' });
      return;
    }
    next();
  });
}

export function requireInboxAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!canAccessInbox(req.user)) {
      res.status(403).json({ error: 'Inbox access required' });
      return;
    }
    next();
  });
}

export function requireCallerManagement(req, res, next) {
  requireAuth(req, res, () => {
    if (!canManageCallers(req.user)) {
      res.status(403).json({ error: 'Caller management requires an admin role' });
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
