import { Navigate, useLocation } from 'react-router-dom';
import { CALLER_BLOCKED_ROLES, INTERVIEW_ROLES, MARKETPLACE_ACCESS_ROLES, isAdminRole } from '../lib/roles.js';

export function RequireAdmin({ user, children }) {
  const location = useLocation();
  if (!isAdminRole(user)) return <Navigate to="/jobs" replace state={{ from: location }} />;
  return children;
}

export function RequireInterviewAccess({ user, children }) {
  const location = useLocation();
  if (!INTERVIEW_ROLES.includes(user.role)) return <Navigate to="/jobs" replace state={{ from: location }} />;
  return children;
}

export function BlockCallers({ user, children }) {
  const location = useLocation();
  if (user.role === 'caller') return <Navigate to="/interviews" replace state={{ from: location }} />;
  return children;
}

export function RequireCallerManagement({ user, children }) {
  const location = useLocation();
  if (CALLER_BLOCKED_ROLES.includes(user.role)) return <Navigate to="/jobs" replace state={{ from: location }} />;
  return children;
}

export function RequireMarketplaceAccess({ user, children }) {
  const location = useLocation();
  if (!MARKETPLACE_ACCESS_ROLES.includes(user.role)) return <Navigate to="/jobs" replace state={{ from: location }} />;
  return children;
}
