import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from '../components/AuthScreens.jsx';
import {
  BlockCallers,
  RequireAssessmentAccess,
  RequireAdmin,
  RequireBidderDirectoryAccess,
  RequireBidWorkspaceAccess,
  RequireCallerManagement,
  RequireConsumptionAccess,
  RequireInboxAccess,
  RequireInterviewAccess,
  RequireJobsAccess,
  RequireLearningHubAccess,
  RequireMarketplaceAccess,
  RequirePersonalDashboardAccess,
  RequireProfileHubAccess,
  RequireSuperadmin,
} from './routeGuards.jsx';
import { ROLES, canAccessPersonalDashboard, isAdminRole } from '../lib/roles.js';

const AdminUsersPage = lazy(() => import('../pages/AdminUsersPage.jsx'));
const AdminConsumptionPage = lazy(() => import('../pages/AdminConsumptionPage.jsx'));
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage.jsx'));
const AdminWorkspacesPage = lazy(() => import('../pages/AdminWorkspacesPage.jsx'));
const AppLayout = lazy(() => import('../components/AppLayout.jsx'));
const AssessmentsPage = lazy(() => import('../pages/AssessmentsPage.jsx'));
const BidPage = lazy(() => import('../pages/BidPage.jsx'));
const BiddersPage = lazy(() => import('../pages/BiddersPage.jsx'));
const CallersPage = lazy(() => import('../pages/CallersPage.jsx'));
const CalendarPage = lazy(() => import('../pages/CalendarPage.jsx'));
const FaqEditorPage = lazy(() => import('../pages/FaqEditorPage.jsx'));
const FaqsPage = lazy(() => import('../pages/FaqsPage.jsx'));
const InboxPage = lazy(() => import('../pages/InboxPage.jsx'));
const InterviewsPage = lazy(() => import('../pages/InterviewsPage.jsx'));
const JobsPage = lazy(() => import('../pages/JobsPage.jsx'));
const LearningArticlePage = lazy(() => import('../pages/LearningArticlePage.jsx'));
const LearningEditorPage = lazy(() => import('../pages/LearningEditorPage.jsx'));
const LearningHubPage = lazy(() => import('../pages/LearningHubPage.jsx'));
const MarketplacePage = lazy(() => import('../pages/MarketplacePage.jsx'));
const ProfilesPage = lazy(() => import('../pages/ProfilesPage.jsx'));
const ProfileHubPage = lazy(() => import('../pages/ProfileHubPage.jsx'));
const TailoringRequestsPage = lazy(() => import('../pages/TailoringRequestsPage.jsx'));
const UserDashboardPage = lazy(() => import('../pages/UserDashboardPage.jsx'));

export function PublicRoutes() {
  return (
    <Routes>
      <Route index element={<LoginScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function AuthenticatedRoutes({ user }) {
  return (
    <Routes>
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
            <RequireJobsAccess user={user}>
              <JobsPage currentUser={user} />
            </RequireJobsAccess>
          }
        />
        <Route
          path="/bids"
          element={
            <RequireBidWorkspaceAccess user={user}>
              <BlockCallers user={user}>
                <BidPage currentUser={user} />
              </BlockCallers>
            </RequireBidWorkspaceAccess>
          }
        />
        <Route
          path="/assessments"
          element={
            <RequireAssessmentAccess user={user}>
              <AssessmentsPage currentUser={user} />
            </RequireAssessmentAccess>
          }
        />
        <Route
          path="/bidders"
          element={
            <RequireBidderDirectoryAccess user={user}>
              <BlockCallers user={user}>
                <BiddersPage currentUser={user} />
              </BlockCallers>
            </RequireBidderDirectoryAccess>
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
            <RequireBidWorkspaceAccess user={user}>
              <BlockCallers user={user}>
                <ProfilesPage currentUser={user} />
              </BlockCallers>
            </RequireBidWorkspaceAccess>
          }
        />
        <Route
          path="/profiles/:profileId"
          element={
            <RequireProfileHubAccess user={user}>
              <ProfileHubPage currentUser={user} />
            </RequireProfileHubAccess>
          }
        />
        <Route
          path="/learning"
          element={
            <RequireLearningHubAccess user={user}>
              <LearningHubPage currentUser={user} />
            </RequireLearningHubAccess>
          }
        />
        <Route
          path="/learning/create"
          element={
            <RequireAdmin user={user}>
              <LearningEditorPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/learning/:articleId/edit"
          element={
            <RequireAdmin user={user}>
              <LearningEditorPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/learning/:articleId"
          element={
            <RequireLearningHubAccess user={user}>
              <LearningArticlePage currentUser={user} />
            </RequireLearningHubAccess>
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
          path="/admin/dashboard/:section"
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
          path="/admin/workspaces"
          element={
            <RequireSuperadmin user={user}>
              <AdminWorkspacesPage currentUser={user} />
            </RequireSuperadmin>
          }
        />
        <Route
          path="/tailoring-requests"
          element={
            <RequireBidWorkspaceAccess user={user}>
              <BlockCallers user={user}>
                <TailoringRequestsPage currentUser={user} />
              </BlockCallers>
            </RequireBidWorkspaceAccess>
          }
        />
        <Route path="*" element={<Navigate to={defaultAuthenticatedPath(user)} replace />} />
      </Route>
    </Routes>
  );
}

function defaultAuthenticatedPath(user) {
  if (user.role === ROLES.guest) return '/faqs';
  if (user.role === ROLES.caller) return '/interviews';
  if (isAdminRole(user)) return '/admin/dashboard';
  if (canAccessPersonalDashboard(user)) return '/dashboard';
  return '/jobs';
}
