import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppLayout from './components/AppLayout.jsx';
import { LoginScreen, ShellLoading } from './components/AuthScreens.jsx';
import { useMe } from './lib/api.js';

const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.jsx'));
const BidPage = lazy(() => import('./pages/BidPage.jsx'));
const BiddersPage = lazy(() => import('./pages/BiddersPage.jsx'));
const CallersPage = lazy(() => import('./pages/CallersPage.jsx'));
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'));
const InterviewsPage = lazy(() => import('./pages/InterviewsPage.jsx'));
const JobsPage = lazy(() => import('./pages/JobsPage.jsx'));
const PricingPage = lazy(() => import('./components/auth/PricingPage.jsx'));
const ProfilesPage = lazy(() => import('./pages/ProfilesPage.jsx'));

export default function App() {
  const { data: user, isLoading: authChecked } = useMe();

  if (authChecked) return <ShellLoading />;
  if (!user) {
    return (
      <Suspense fallback={<ShellLoading />}>
        <Routes>
          <Route index element={<LoginScreen />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<ShellLoading />}>
      <Routes>
        <Route path="/pricing" element={<PricingPage />} />
        <Route element={<AppLayout user={user} />}>
          <Route index element={<Navigate to="/jobs" replace />} />
          <Route path="/jobs" element={<JobsPage currentUser={user} />} />
          <Route path="/bids" element={<BidPage currentUser={user} />} />
          <Route path="/bidders" element={<BiddersPage currentUser={user} />} />
          <Route
            path="/interviews"
            element={
              <RequireRoles user={user} roles={['admin', 'internal']}>
                <InterviewsPage currentUser={user} />
              </RequireRoles>
            }
          />
          <Route
            path="/calendar"
            element={
              <RequireRoles user={user} roles={['admin', 'internal']}>
                <CalendarPage currentUser={user} />
              </RequireRoles>
            }
          />
          <Route
            path="/callers"
            element={
              <RequireCallerManagement user={user}>
                <CallersPage currentUser={user} />
              </RequireCallerManagement>
            }
          />
          <Route path="/profiles" element={<ProfilesPage currentUser={user} />} />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin user={user}>
                <AdminUsersPage currentUser={user} />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/jobs" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function RequireAdmin({ user, children }) {
  const location = useLocation();
  if (user.role !== 'admin') return <Navigate to="/jobs" replace state={{ from: location }} />;
  return children;
}

function RequireRoles({ user, roles, children }) {
  const location = useLocation();
  if (!roles.includes(user.role)) return <Navigate to="/jobs" replace state={{ from: location }} />;
  return children;
}

function RequireCallerManagement({ user, children }) {
  const location = useLocation();
  if (['bidder', 'readonly_bidder', 'editable_bidder', 'caller'].includes(user.role)) {
    return <Navigate to="/jobs" replace state={{ from: location }} />;
  }
  return children;
}
