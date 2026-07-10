import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
import { loadRouteModule } from './routeModules.js';

const AdminUsersPage = lazy(loadRouteModule.adminUsers);
const AdminConsumptionPage = lazy(loadRouteModule.adminConsumption);
const AdminDashboardPage = lazy(loadRouteModule.adminDashboard);
const AdminWorkspacesPage = lazy(loadRouteModule.adminWorkspaces);
const AppLayout = lazy(loadRouteModule.appLayout);
const AssessmentsPage = lazy(loadRouteModule.assessments);
const BidPage = lazy(loadRouteModule.bids);
const BiddersPage = lazy(loadRouteModule.bidders);
const CallersPage = lazy(loadRouteModule.callers);
const CalendarPage = lazy(loadRouteModule.calendar);
const FaqEditorPage = lazy(loadRouteModule.faqEditor);
const FaqsPage = lazy(loadRouteModule.faqs);
const InboxPage = lazy(loadRouteModule.inbox);
const InterviewsPage = lazy(loadRouteModule.interviews);
const JobsPage = lazy(loadRouteModule.jobs);
const LearningArticlePage = lazy(loadRouteModule.learningArticle);
const LearningEditorPage = lazy(loadRouteModule.learningEditor);
const LearningHubPage = lazy(loadRouteModule.learningHub);
const MarketplacePage = lazy(loadRouteModule.marketplace);
const ProfilesPage = lazy(loadRouteModule.profiles);
const ProfileHubPage = lazy(loadRouteModule.profileHub);
const TailoringRequestsPage = lazy(loadRouteModule.tailoringRequests);
const UserDashboardPage = lazy(loadRouteModule.userDashboard);
const LoginScreen = lazy(() => import('../components/auth/LoginScreen.jsx'));

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
              <LearningArticlePage />
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

export function defaultAuthenticatedPath(user) {
  if (user.role === ROLES.guest) return '/faqs';
  if (user.role === ROLES.caller) return '/interviews';
  if (isAdminRole(user)) return '/admin/dashboard';
  if (canAccessPersonalDashboard(user)) return '/dashboard';
  return '/jobs';
}
