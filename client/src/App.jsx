import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppLayout from './components/AppLayout.jsx';
import { LoginScreen, ShellLoading } from './components/AuthScreens.jsx';
import { useMe } from './lib/api.js';

const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.jsx'));
const BidPage = lazy(() => import('./pages/BidPage.jsx'));
const JobsPage = lazy(() => import('./pages/JobsPage.jsx'));
const ProfilesPage = lazy(() => import('./pages/ProfilesPage.jsx'));

export default function App() {
  const { data: user, isLoading: authChecked } = useMe();

  if (authChecked) return <ShellLoading />;
  if (!user) return <LoginScreen />;
  return (
    <Suspense fallback={<ShellLoading />}>
      <Routes>
        <Route element={<AppLayout user={user} />}>
          <Route index element={<Navigate to="/jobs" replace />} />
          <Route path="/jobs" element={<JobsPage currentUser={user} />} />
          <Route path="/bids" element={<BidPage currentUser={user} />} />
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
