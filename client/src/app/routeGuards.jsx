import { Navigate, useLocation } from 'react-router-dom';

const INTERVIEW_ROLES = ['admin', 'internal', 'user', 'caller'];
const CALLER_BLOCKED_ROLES = ['bidder', 'readonly_bidder', 'editable_bidder', 'caller'];

export function RequireAdmin({ user, children }) {
  const location = useLocation();
  if (user.role !== 'admin') return <Navigate to="/jobs" replace state={{ from: location }} />;
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
