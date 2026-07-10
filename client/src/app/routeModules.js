const routeModules = {
  adminUsers: () => import('../pages/AdminUsersPage.jsx'),
  adminConsumption: () => import('../pages/AdminConsumptionPage.jsx'),
  adminDashboard: () => import('../pages/AdminDashboardPage.jsx'),
  adminWorkspaces: () => import('../pages/AdminWorkspacesPage.jsx'),
  appLayout: () => import('../components/AppLayout.jsx'),
  assessments: () => import('../pages/AssessmentsPage.jsx'),
  bids: () => import('../pages/BidPage.jsx'),
  bidders: () => import('../pages/BiddersPage.jsx'),
  callers: () => import('../pages/CallersPage.jsx'),
  calendar: () => import('../pages/CalendarPage.jsx'),
  faqEditor: () => import('../pages/FaqEditorPage.jsx'),
  faqs: () => import('../pages/FaqsPage.jsx'),
  inbox: () => import('../pages/InboxPage.jsx'),
  interviews: () => import('../pages/InterviewsPage.jsx'),
  jobs: () => import('../pages/JobsPage.jsx'),
  learningArticle: () => import('../pages/LearningArticlePage.jsx'),
  learningEditor: () => import('../pages/LearningEditorPage.jsx'),
  learningHub: () => import('../pages/LearningHubPage.jsx'),
  marketplace: () => import('../pages/MarketplacePage.jsx'),
  profiles: () => import('../pages/ProfilesPage.jsx'),
  profileHub: () => import('../pages/ProfileHubPage.jsx'),
  tailoringRequests: () => import('../pages/TailoringRequestsPage.jsx'),
  userDashboard: () => import('../pages/UserDashboardPage.jsx'),
};

export const loadRouteModule = routeModules;

export function prefetchRoute(pathname) {
  const loader = routeLoaderForPath(pathname);
  if (loader) void loader().catch(() => undefined);
}

function routeLoaderForPath(value) {
  const pathname = typeof value === 'string' ? value : value?.pathname || '';
  if (pathname.startsWith('/admin/dashboard')) return routeModules.adminDashboard;
  if (pathname.startsWith('/admin/consumption')) return routeModules.adminConsumption;
  if (pathname.startsWith('/admin/users')) return routeModules.adminUsers;
  if (pathname.startsWith('/admin/workspaces')) return routeModules.adminWorkspaces;
  if (pathname.startsWith('/tailoring-requests')) return routeModules.tailoringRequests;
  if (pathname.startsWith('/assessments')) return routeModules.assessments;
  if (pathname.startsWith('/bidders')) return routeModules.bidders;
  if (pathname.startsWith('/bids')) return routeModules.bids;
  if (pathname.startsWith('/callers')) return routeModules.callers;
  if (pathname.startsWith('/calendar')) return routeModules.calendar;
  if (pathname.startsWith('/faqs/create') || (pathname.startsWith('/faqs/') && pathname.endsWith('/edit'))) return routeModules.faqEditor;
  if (pathname.startsWith('/faqs')) return routeModules.faqs;
  if (pathname.startsWith('/inbox')) return routeModules.inbox;
  if (pathname.startsWith('/interviews')) return routeModules.interviews;
  if (pathname.startsWith('/jobs')) return routeModules.jobs;
  if (pathname === '/learning/create' || pathname.endsWith('/edit')) return routeModules.learningEditor;
  if (/^\/learning\/[^/]+$/.test(pathname)) return routeModules.learningArticle;
  if (pathname.startsWith('/learning')) return routeModules.learningHub;
  if (pathname.startsWith('/marketplace')) return routeModules.marketplace;
  if (/^\/profiles\/[^/]+/.test(pathname)) return routeModules.profileHub;
  if (pathname.startsWith('/profiles')) return routeModules.profiles;
  if (pathname.startsWith('/dashboard')) return routeModules.userDashboard;
  return null;
}
