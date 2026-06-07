import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { LoginScreen } from '../components/AuthScreens.jsx';
import {
  BlockCallers,
  RequireAdmin,
  RequireCallerManagement,
  RequireInterviewAccess,
} from './routeGuards.jsx';

const AdminUsersPage = lazy(() => import('../pages/AdminUsersPage.jsx'));
const BidPage = lazy(() => import('../pages/BidPage.jsx'));
const BiddersPage = lazy(() => import('../pages/BiddersPage.jsx'));
const CallersPage = lazy(() => import('../pages/CallersPage.jsx'));
const CalendarPage = lazy(() => import('../pages/CalendarPage.jsx'));
const InterviewsPage = lazy(() => import('../pages/InterviewsPage.jsx'));
const JobsPage = lazy(() => import('../pages/JobsPage.jsx'));
const PricingPage = lazy(() => import('../components/auth/PricingPage.jsx'));
const ProfilesPage = lazy(() => import('../pages/ProfilesPage.jsx'));

export function PublicRoutes() {
  return (
    <Routes>
      <Route index element={<LoginScreen />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function AuthenticatedRoutes({ user }) {
  return (
    <Routes>
      <Route path="/pricing" element={<PricingPage />} />
      <Route element={<AppLayout user={user} />}>
        <Route index element={<Navigate to={user.role === 'caller' ? '/interviews' : '/jobs'} replace />} />
        <Route
          path="/jobs"
          element={
            <BlockCallers user={user}>
              <JobsPage currentUser={user} />
            </BlockCallers>
          }
        />
        <Route
          path="/bids"
          element={
            <BlockCallers user={user}>
              <BidPage currentUser={user} />
            </BlockCallers>
          }
        />
        <Route
          path="/bidders"
          element={
            <BlockCallers user={user}>
              <BiddersPage currentUser={user} />
            </BlockCallers>
          }
        />
        <Route
          path="/interviews"
          element={
            <RequireInterviewAccess user={user}>
              <InterviewsPage currentUser={user} />
            </RequireInterviewAccess>
          }
        />
        <Route
          path="/calendar"
          element={
            <RequireInterviewAccess user={user}>
              <CalendarPage currentUser={user} />
            </RequireInterviewAccess>
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
        <Route
          path="/profiles"
          element={
            <BlockCallers user={user}>
              <ProfilesPage currentUser={user} />
            </BlockCallers>
          }
        />
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
  );
}
