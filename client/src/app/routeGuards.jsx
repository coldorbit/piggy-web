import { Navigate, useLocation } from 'react-router-dom';
import {
  MARKETPLACE_ACCESS_ROLES,
  ROLES,
  canAccessAssessments,
  canAccessBidderDirectory,
  canAccessBidWorkspace,
  canAccessConsumption,
  canAccessInbox,
  canAccessInterviews,
  canAccessJobs,
  canAccessPersonalDashboard,
  canAccessProfileHub,
  canManageCallers,
  isAdminRole,
  isSuperadmin,
} from '../lib/roles.js';

export function RequireAdmin({ user, children }) {
  const location = useLocation();
  if (!isAdminRole(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequireSuperadmin({ user, children }) {
  const location = useLocation();
  if (!isSuperadmin(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequireConsumptionAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessConsumption(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequireAssessmentAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessAssessments(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequirePersonalDashboardAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessPersonalDashboard(user)) {
    return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  }
  return children;
}

export function RequireJobsAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessJobs(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequireBidWorkspaceAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessBidWorkspace(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequireInterviewAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessInterviews(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequireProfileHubAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessProfileHub(user)) {
    return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  }
  return children;
}

export function RequireBidderDirectoryAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessBidderDirectory(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function BlockCallers({ user, children }) {
  const location = useLocation();
  if (user.role === ROLES.caller) return <Navigate to="/interviews" replace state={{ from: location }} />;
  return children;
}

export function RequireCallerManagement({ user, children }) {
  const location = useLocation();
  if (!canManageCallers(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequireInboxAccess({ user, children }) {
  const location = useLocation();
  if (!canAccessInbox(user)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

export function RequireMarketplaceAccess({ user, children }) {
  const location = useLocation();
  if (!MARKETPLACE_ACCESS_ROLES.includes(user.role)) return <Navigate to={restrictedFallbackPath(user)} replace state={{ from: location }} />;
  return children;
}

function restrictedFallbackPath(user) {
  if (user?.role === ROLES.guest) return '/faqs';
  if (user?.role === ROLES.caller) return '/interviews';
  if (isAdminRole(user)) return '/admin/dashboard';
  if (canAccessPersonalDashboard(user)) return '/dashboard';
  return '/jobs';
}
