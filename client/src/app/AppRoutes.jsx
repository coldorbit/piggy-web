import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from '../components/AuthScreens.jsx';
import {
  BlockCallers,
  RequireAdmin,
  RequireCallerManagement,
  RequireConsumptionAccess,
  RequireInboxAccess,
  RequireInterviewAccess,
  RequireMarketplaceAccess,
  RequirePersonalDashboardAccess,
} from './routeGuards.jsx';
import { canAccessPersonalDashboard, isAdminRole } from '../lib/roles.js';

const AdminUsersPage = lazy(() => import('../pages/AdminUsersPage.jsx'));
const AdminConsumptionPage = lazy(() => import('../pages/AdminConsumptionPage.jsx'));
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage.jsx'));
const AppLayout = lazy(() => import('../components/AppLayout.jsx'));
const BidPage = lazy(() => import('../pages/BidPage.jsx'));
const BiddersPage = lazy(() => import('../pages/BiddersPage.jsx'));
const CallersPage = lazy(() => import('../pages/CallersPage.jsx'));
const CalendarPage = lazy(() => import('../pages/CalendarPage.jsx'));
const FaqEditorPage = lazy(() => import('../pages/FaqEditorPage.jsx'));
const FaqsPage = lazy(() => import('../pages/FaqsPage.jsx'));
const InboxPage = lazy(() => import('../pages/InboxPage.jsx'));
const InterviewsPage = lazy(() => import('../pages/InterviewsPage.jsx'));
const JobsPage = lazy(() => import('../pages/JobsPage.jsx'));
const MarketplacePage = lazy(() => import('../pages/MarketplacePage.jsx'));
const PricingPage = lazy(() => import('../components/auth/PricingPage.jsx'));
const ProfilesPage = lazy(() => import('../pages/ProfilesPage.jsx'));
const TailoringRequestsPage = lazy(() => import('../pages/TailoringRequestsPage.jsx'));
const UserDashboardPage = lazy(() => import('../pages/UserDashboardPage.jsx'));

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
        <Route index element={<Navigate to={defaultAuthenticatedPath(user)} replace />} />
        <Route
          path="/dashboard"
          element={
            <RequirePersonalDashboardAccess user={user}>
              <UserDashboardPage currentUser={user} />
            </RequirePersonalDashboardAccess>
          }
        />
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
          path="/inbox"
          element={
            <RequireInboxAccess user={user}>
              <InboxPage currentUser={user} />
            </RequireInboxAccess>
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
          path="/marketplace"
          element={
            <RequireMarketplaceAccess user={user}>
              <MarketplacePage currentUser={user} />
            </RequireMarketplaceAccess>
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
        <Route path="/faqs" element={<FaqsPage currentUser={user} />} />
        <Route
          path="/faqs/create"
          element={
            <RequireAdmin user={user}>
              <FaqEditorPage currentUser={user} />
            </RequireAdmin>
          }
        />
        <Route
          path="/faqs/:id/edit"
          element={
            <RequireAdmin user={user}>
              <FaqEditorPage currentUser={user} />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin user={user}>
              <AdminDashboardPage currentUser={user} />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/consumption"
          element={
            <RequireConsumptionAccess user={user}>
              <AdminConsumptionPage currentUser={user} />
            </RequireConsumptionAccess>
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
        <Route
          path="/tailoring-requests"
          element={
            <BlockCallers user={user}>
              <TailoringRequestsPage currentUser={user} />
            </BlockCallers>
          }
        />
        <Route path="*" element={<Navigate to={defaultAuthenticatedPath(user)} replace />} />
      </Route>
    </Routes>
  );
}

function defaultAuthenticatedPath(user) {
  if (user.role === 'caller') return '/interviews';
  if (isAdminRole(user)) return '/admin/dashboard';
  if (canAccessPersonalDashboard(user)) return '/dashboard';
  return '/jobs';
}
