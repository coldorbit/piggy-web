import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BadgeIcon from '@mui/icons-material/Badge';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EditIcon from '@mui/icons-material/Edit';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import HandshakeIcon from '@mui/icons-material/Handshake';
import InboxIcon from '@mui/icons-material/Inbox';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import PaidIcon from '@mui/icons-material/Paid';
import PeopleIcon from '@mui/icons-material/People';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import QuizIcon from '@mui/icons-material/Quiz';
import SearchIcon from '@mui/icons-material/Search';
import SchoolIcon from '@mui/icons-material/School';
import StyleIcon from '@mui/icons-material/Style';
import WorkIcon from '@mui/icons-material/Work';
import {
  AppBar,
  Box,
  Badge as MuiBadge,
  Button,
  Collapse,
  Drawer,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLogout, useUpdateMe } from '../lib/authApi.js';
import { useAdminWorkspaces } from '../lib/api.js';
import { useMailboxNotifications } from '../lib/mailboxNotifications.js';
import {
  MARKETPLACE_ACCESS_ROLES,
  ROLES,
  canAccessBidderDirectory,
  canAccessBidWorkspace,
  canUseWorkspaceLens,
  canAccessConsumption,
  canAccessAssessments,
  canAccessInbox,
  canAccessInterviews,
  canAccessJobs,
  canAccessLearningHub,
  canAccessPersonalDashboard,
  canManageCallers,
  isAdminRole,
  isSuperadmin,
  roleLabel,
} from '../lib/roles.js';
import { ALL_WORKSPACES, UNASSIGNED_WORKSPACE, workspaceLabel } from './admin/SuperadminWorkspaceLens.jsx';
import { WorkspaceFilterProvider } from './admin/WorkspaceFilterContext.jsx';
import { EMPTY_HEADER_SEARCH, HeaderSearchProvider } from './HeaderSearchContext.jsx';
import { EMPTY_PAGE_HEADER, PageHeaderProvider } from './PageHeaderContext.jsx';
import { prefetchRoute } from '../app/routeModules.js';
import { markRouteNavigationStart } from '../app/PerformanceMonitor.jsx';

const DRAWER_WIDTH = 248;
const COLLAPSED_DRAWER_WIDTH = 72;
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'applypilot-sidebar-collapsed';
const shellLine = 'rgba(0, 0, 0, 0.09)';
const micaPane = 'rgba(255, 255, 255, 0.72)';
const micaPaneStrong = 'rgba(255, 255, 255, 0.88)';
const accentSoft = 'rgba(0, 103, 192, 0.1)';
const accentLine = 'rgba(0, 103, 192, 0.28)';
const accentText = '#004E8C';

export default function AppLayout({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => readSidebarCollapsedPreference());
  const [isDashboardMenuOpen, setIsDashboardMenuOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [accountUsername, setAccountUsername] = useState(user.username || '');
  const [accountError, setAccountError] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => (
    isSuperadmin(user) ? ALL_WORKSPACES : String(user.workspaceId || ALL_WORKSPACES)
  ));
  const { mutate: logout } = useLogout();
  const { mutate: updateMe, isPending: isUpdatingMe } = useUpdateMe();
  const canUseWorkspaceFilter = canUseWorkspaceLens(user);
  const { data: workspaces = [], isLoading: workspacesLoading, error: workspaceError } = useAdminWorkspaces({ enabled: canUseWorkspaceFilter });
  const isAdminDashboardRoute = location.pathname.startsWith('/admin/dashboard');
  const isPersonalDashboardRoute = location.pathname.startsWith('/dashboard');
  const isConsumptionRoute = location.pathname.startsWith('/admin/consumption');
  const isAssessmentRoute = location.pathname.startsWith('/assessments');
  const isAdminRoute = location.pathname.startsWith('/admin/users');
  const isWorkspaceRoute = location.pathname.startsWith('/admin/workspaces');
  const isBidRoute = location.pathname.startsWith('/bids');
  const isBidderRoute = location.pathname.startsWith('/bidders');
  const isCallerRoute = location.pathname.startsWith('/callers');
  const isCalendarRoute = location.pathname.startsWith('/calendar');
  const isFaqRoute = location.pathname.startsWith('/faqs');
  const isInboxRoute = location.pathname.startsWith('/inbox');
  const isInterviewRoute = location.pathname.startsWith('/interviews');
  const isLearningRoute = location.pathname.startsWith('/learning');
  const isLearningArticleRoute = /^\/learning\/[^/]+$/.test(location.pathname) && location.pathname !== '/learning/create';
  const isMarketplaceRoute = location.pathname.startsWith('/marketplace');
  const isProfileRoute = location.pathname.startsWith('/profiles');
  const isTailoringRoute = location.pathname.startsWith('/tailoring-requests');
  const [headerSearch, setHeaderSearch] = useState(EMPTY_HEADER_SEARCH);
  const [pageHeader, setPageHeader] = useState(EMPTY_PAGE_HEADER);
  const headerSearchContext = useMemo(
    () => ({ search: headerSearch, setSearch: setHeaderSearch }),
    [headerSearch],
  );
  const pageHeaderContext = useMemo(
    () => ({ pageHeader, setPageHeader }),
    [pageHeader],
  );
  const workspaceFilterContext = useMemo(
    () => ({
      activeWorkspaceId,
      setActiveWorkspaceId,
      workspaceError,
      workspaces,
      workspacesLoading,
    }),
    [activeWorkspaceId, workspaceError, workspaces, workspacesLoading],
  );
  const canViewInterviews = canAccessInterviews(user);
  const canAccessMarketplace = MARKETPLACE_ACCESS_ROLES.includes(user.role);
  const canViewCallers = canManageCallers(user);
  const canViewInbox = canAccessInbox(user);
  const canViewBidders = canAccessBidderDirectory(user);
  const canViewAssessments = canAccessAssessments(user);
  const canViewBidWorkspace = canAccessBidWorkspace(user);
  const canViewJobs = canAccessJobs(user);
  const canViewLearningHub = canAccessLearningHub(user);
  const canViewPersonalDashboard = canAccessPersonalDashboard(user);
  const isCaller = user.role === ROLES.caller;
  const isDrawerCollapsed = isDesktop && isSidebarCollapsed;
  const drawerWidth = isDrawerCollapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH;
  const adminDashboardSearch = isAdminDashboardRoute ? location.search : '';

  useEffect(() => {
    if (canUseWorkspaceFilter && !isSuperadmin(user) && activeWorkspaceId === ALL_WORKSPACES && workspaces.length) {
      setActiveWorkspaceId(String(user.workspaceId || workspaces[0].id));
      return;
    }
    if (!canUseWorkspaceFilter || activeWorkspaceId === ALL_WORKSPACES) return;
    if (activeWorkspaceId === UNASSIGNED_WORKSPACE) return;
    if (workspaces.some((workspace) => String(workspace.id) === String(activeWorkspaceId))) return;
    setActiveWorkspaceId(ALL_WORKSPACES);
  }, [activeWorkspaceId, canUseWorkspaceFilter, user, workspaces]);
  const handleOpenMailboxNotification = useCallback((message) => {
    const profileId = message?.matchedProfile?.id;
    const params = new URLSearchParams();
    if (profileId) params.set('profileId', String(profileId));
    if (message?.id) params.set('messageId', String(message.id));
    const query = params.toString();
    navigate(`/inbox${query ? `?${query}` : ''}`);
  }, [navigate]);
  const mailboxNotifications = useMailboxNotifications({
    enabled: canViewInbox,
    onOpenMessage: handleOpenMailboxNotification,
    user,
  });

  async function handleLogout() {
    logout(undefined, {
      onSettled: () => navigate('/', { replace: true }),
    });
  }

  function openAccountDialog() {
    setAccountUsername(user.username || '');
    setAccountError('');
    setIsAccountDialogOpen(true);
  }

  function closeAccountDialog() {
    if (!isUpdatingMe) setIsAccountDialogOpen(false);
  }

  function submitAccount(event) {
    event.preventDefault();
    setAccountError('');
    updateMe(
      { username: accountUsername },
      {
        onSuccess: () => setIsAccountDialogOpen(false),
        onError: (error) => setAccountError(error.message),
      },
    );
  }

  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsedPreference(next);
      return next;
    });
  }

  const routeTitle = isAdminDashboardRoute || isPersonalDashboardRoute ? 'Dashboard' : isConsumptionRoute ? 'Consumption' : isAssessmentRoute ? 'Assessments' : isWorkspaceRoute ? 'Workspaces' : isAdminRoute ? 'Users' : isTailoringRoute ? 'Tailoring requests' : isLearningRoute ? 'Learning Hub' : isFaqRoute ? 'FAQs' : isBidderRoute ? 'Bidders' : isInboxRoute ? 'Inbox' : isMarketplaceRoute ? 'Marketplace' : isCallerRoute ? 'Callers' : isCalendarRoute ? 'Calendar' : isInterviewRoute ? 'Interviews' : isBidRoute ? 'Applications' : isProfileRoute ? 'Profiles' : 'Jobs';
  const routeSubtitle = isAdminDashboardRoute
    ? 'Monitor user and bidder performance'
    : isPersonalDashboardRoute
    ? 'Track your applications, interviews, and profile momentum'
    : isConsumptionRoute
    ? 'Track team spend across currencies and channels'
    : isAssessmentRoute
    ? 'Register assessment links and deadlines by profile'
    : isWorkspaceRoute
    ? 'Manage workspace identities and bidder sharing readiness'
    : isAdminRoute
    ? 'Manage back-office accounts'
    : isTailoringRoute
      ? 'Review all resume tailoring activity'
    : isLearningRoute
      ? 'Learn company, geography, and machine learning context'
    : isFaqRoute
      ? 'Browse answers and publish help content'
    : isBidderRoute
      ? 'Review bidder output and interview pass-through'
    : isInboxRoute
      ? 'Review forwarded profile messages'
    : isMarketplaceRoute
      ? 'Review, match, schedule, and close caller-interview work'
    : isCallerRoute
      ? 'Track caller assignments and interview workload'
    : isCalendarRoute
      ? 'See scheduled interviews across profiles'
    : isInterviewRoute
      ? 'Manage active interview pipelines by profile'
    : isBidRoute
      ? 'Track tailored applications by profile'
      : isProfileRoute
        ? 'Shape candidate stories and resume signals'
        : 'Discover, review, and prioritize matched roles';
  const title = pageHeader.title || routeTitle;
  const subtitle = pageHeader.subtitle || routeSubtitle;
  const learningArticleId = isLearningArticleRoute ? location.pathname.split('/')[2] : '';
  const isViewportBoundRoute = isCalendarRoute || isLearningArticleRoute;
  const drawerContent = (
    <>
      <Toolbar
        sx={{
          minHeight: 68,
          gap: 1,
          px: isDrawerCollapsed ? 1 : 1.5,
          borderBottom: 1,
          borderColor: shellLine,
          bgcolor: micaPaneStrong,
          backdropFilter: 'blur(26px) saturate(1.25)',
          justifyContent: isDrawerCollapsed ? 'center' : 'space-between',
        }}
      >
        {!isDrawerCollapsed ? (
          <Box
            component={NavLink}
            to="/"
            onClick={() => setMobileOpen(false)}
            aria-label="ApplyPilot home"
            sx={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 0.5,
              ml: -0.5,
              borderRadius: 2,
              textDecoration: 'none',
              transition: 'background-color 140ms ease, transform 140ms ease',
              '&:hover': { bgcolor: accentSoft },
              '&:active': { transform: 'translateY(1px)' },
              '&:focus-visible': { outline: `3px solid ${accentLine}`, outlineOffset: 2 },
            }}
          >
            <Box
              component="img"
              src="/assets/applypilot-wordmark.png"
              alt="ApplyPilot"
              sx={{ width: 154, height: 44, objectFit: 'contain', objectPosition: 'left center', flexShrink: 0 }}
            />
          </Box>
        ) : null}
        {isDesktop ? (
          <Tooltip title={isDrawerCollapsed ? 'Expand navigation' : 'Collapse navigation'} placement="right">
            <IconButton
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-label={isDrawerCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-pressed={isDrawerCollapsed}
              sx={{
                border: 1,
                borderColor: shellLine,
                bgcolor: 'rgba(255,255,255,0.58)',
                color: 'text.secondary',
                width: 34,
                height: 34,
                flexShrink: 0,
                boxShadow: '0 1px 0 rgba(255,255,255,0.75) inset',
                '&:hover': { bgcolor: accentSoft, borderColor: accentLine, color: accentText },
              }}
            >
              {isDrawerCollapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : null}
      </Toolbar>
      <Box sx={{ px: isDrawerCollapsed ? 0.75 : 1, py: 1 }}>
        <List component="nav" aria-label="Workspace navigation" sx={{ display: 'grid', gap: 0.35 }}>
          {isAdminRole(user) ? (
            <DashboardNavGroup
              collapsed={isDrawerCollapsed}
              isOpen={isDashboardMenuOpen}
              search={adminDashboardSearch}
              onNavigate={() => setMobileOpen(false)}
              onToggle={() => setIsDashboardMenuOpen((current) => !current)}
            />
          ) : null}
          {canViewPersonalDashboard ? (
            <NavItem to="/dashboard" icon={<AnalyticsIcon />} label="Dashboard" alwaysHighlighted collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canAccessConsumption(user) ? (
            <NavItem to="/admin/consumption" icon={<PaidIcon />} label="Consumption" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canViewJobs ? <NavItem to="/jobs" icon={<WorkIcon />} label="Jobs" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} /> : null}
          {canViewBidWorkspace && !isCaller ? (
            <NavItem to="/bids" icon={<AssignmentIcon />} label="Applications" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canViewAssessments ? <NavItem to="/assessments" icon={<QuizIcon />} label="Assessments" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} /> : null}
          {canViewBidders && !isCaller ? (
            <NavItem to="/bidders" icon={<LeaderboardIcon />} label="Bidders" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canViewInbox ? (
            <NavItem
              to="/inbox"
              icon={<InboxIcon />}
              label="Inbox"
              badgeContent={mailboxNotifications.unreadCount}
              collapsed={isDrawerCollapsed}
              onNavigate={() => setMobileOpen(false)}
            />
          ) : null}
          {canViewInterviews ? (
            <NavItem to="/interviews" icon={<EventNoteIcon />} label="Interviews" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canViewInterviews ? (
            <NavItem to="/calendar" icon={<CalendarMonthIcon />} label="Calendar" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canAccessMarketplace ? (
            <NavItem to="/marketplace" icon={<HandshakeIcon />} label="Marketplace" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canViewCallers ? (
            <NavItem to="/callers" icon={<PhoneInTalkIcon />} label="Callers" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canViewBidWorkspace && !isCaller ? <NavItem to="/profiles" icon={<BadgeIcon />} label="Profiles" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} /> : null}
          {canViewBidWorkspace && !isCaller ? (
            <NavItem to="/tailoring-requests" icon={<StyleIcon />} label="Tailoring" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canViewLearningHub ? <NavItem to="/learning" icon={<SchoolIcon />} label="Learning Hub" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} /> : null}
          <NavItem to="/faqs" icon={<HelpOutlinedIcon />} label="FAQs" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          {isAdminRole(user) ? (
            <NavItem to="/admin/users" icon={<PeopleIcon />} label="Users" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {isSuperadmin(user) ? (
            <NavItem to="/admin/workspaces" icon={<ApartmentIcon />} label="Workspaces" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          ) : null}
        </List>
      </Box>
      <Box sx={{ mt: 'auto', p: isDrawerCollapsed ? 0.75 : 1 }}>
        {isDrawerCollapsed ? (
          <Tooltip title={`${user.username} · ${roleLabel(user.role)}`} placement="right">
            <IconButton
              type="button"
              onClick={openAccountDialog}
              aria-label="Edit username"
              sx={{
                width: 42,
                height: 42,
                mx: 'auto',
                display: 'flex',
                border: 1,
                borderColor: shellLine,
                bgcolor: 'rgba(255,255,255,0.58)',
                color: accentText,
                boxShadow: '0 1px 0 rgba(255,255,255,0.72) inset',
                '&:hover': { bgcolor: accentSoft, borderColor: accentLine },
              }}
            >
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Box
            sx={{
              border: 1,
              borderColor: shellLine,
              borderRadius: 2,
              p: 1,
              bgcolor: 'rgba(255,255,255,0.56)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.72) inset',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Signed in as
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Typography fontWeight={600} noWrap sx={{ minWidth: 0, flex: 1 }}>
                {user.username}
              </Typography>
              <IconButton size="small" onClick={openAccountDialog} aria-label="Edit username">
                <EditIcon fontSize="small" />
              </IconButton>
            </Box>
            {user.email ? (
              <Typography variant="caption" color="text.secondary" noWrap>
                {user.email}
              </Typography>
            ) : null}
            <Chip label={roleLabel(user.role)} size="small" sx={{ mt: 1, bgcolor: 'rgba(72, 104, 96, 0.13)', color: '#324B45', border: 1, borderColor: 'rgba(72, 104, 96, 0.24)' }} />
          </Box>
        )}
      </Box>
    </>
  );

  return (
    <HeaderSearchProvider value={headerSearchContext}>
      <PageHeaderProvider value={pageHeaderContext}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          bgcolor: 'background.default',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(245,248,252,0.6) 48%, rgba(238,243,249,0.72))',
        }}
      >
      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'block' },
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          transition: (theme) => theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shorter,
          }),
          '& .MuiDrawer-paper': {
            width: { xs: DRAWER_WIDTH, md: drawerWidth },
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: shellLine,
            background: 'rgba(255, 255, 255, 0.68)',
            backdropFilter: 'blur(28px) saturate(1.25)',
            boxShadow: { xs: 4, md: '8px 0 26px rgba(0, 0, 0, 0.06)' },
            display: 'flex',
            overflowX: 'hidden',
            transition: (theme) => theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.shorter,
            }),
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          minWidth: 0,
          flex: 1,
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          height: '100vh',
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: (theme) => theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shorter,
          }),
        }}
      >
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: shellLine,
            backdropFilter: 'blur(18px)',
            bgcolor: micaPane,
            flexShrink: 0,
          }}
        >
          <Toolbar
            sx={{
              minHeight: 60,
              justifyContent: 'space-between',
              gap: { xs: 0.75, sm: 1.5 },
              px: { xs: 1.25, sm: 2 },
              py: { xs: headerSearch.isVisible ? 0.75 : 0, sm: 0 },
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, order: 1 }}>
              {!isDesktop ? (
                <IconButton type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                  <MenuIcon />
                </IconButton>
              ) : null}
              {isLearningArticleRoute ? (
                <Tooltip title="Back to Learning Hub">
                  <IconButton
                    type="button"
                    onClick={() => navigate(location.state?.learningReturnTo || '/learning')}
                    aria-label="Back to Learning Hub"
                    sx={{ border: 1, borderColor: shellLine, bgcolor: 'rgba(255, 255, 255, 0.58)' }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                </Tooltip>
              ) : null}
              <Box
                minWidth={0}
                sx={{
                  borderLeft: { xs: 0, sm: 2 },
                  borderColor: '#0067C0',
                  pl: { xs: 0, sm: 1.25 },
                }}
              >
                <Typography variant="h5" fontWeight={600} noWrap sx={{ color: 'text.primary', letterSpacing: 0 }}>
                  {title}
                </Typography>
                <Typography color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {subtitle}
                </Typography>
              </Box>
            </Box>
            {headerSearch.isVisible ? (
              <TextField
                aria-label="Search jobs"
                placeholder={headerSearch.placeholder}
                size="small"
                value={headerSearch.value}
                onChange={(event) => headerSearch.onChange(event.target.value)}
                sx={{
                  order: { xs: 3, sm: 2 },
                  width: { xs: '100%', sm: 260, md: 340, lg: 440 },
                  flexShrink: 1,
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            ) : null}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, order: { xs: 2, sm: 3 } }}>
              {isLearningArticleRoute && isAdminRole(user) ? (
                <Tooltip title="Edit article">
                  <IconButton
                    type="button"
                    onClick={() => navigate(`/learning/${learningArticleId}/edit`, { state: location.state })}
                    aria-label="Edit article"
                    sx={{ border: 1, borderColor: shellLine, bgcolor: 'rgba(255, 255, 255, 0.58)' }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              ) : null}
              {canUseWorkspaceFilter && !isWorkspaceRoute ? (
                <HeaderWorkspaceSelect
                  activeWorkspaceId={activeWorkspaceId}
                  isLoading={workspacesLoading}
                  showGlobalOptions={isSuperadmin(user)}
                  workspaces={workspaces}
                  onChange={setActiveWorkspaceId}
                />
              ) : null}
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.75 }}>
                <AccountCircleIcon color="action" />
                <Typography color="text.secondary" noWrap>
                  {user.username}
                </Typography>
              </Box>
              {canViewInbox ? (
                <Tooltip title={mailboxNotificationTooltip(mailboxNotifications)}>
                  <span>
                    <IconButton
                      type="button"
                      aria-label={mailboxNotificationTooltip(mailboxNotifications)}
                      aria-pressed={mailboxNotifications.isEnabled}
                      disabled={!mailboxNotifications.isSupported || mailboxNotifications.permission === 'denied'}
                      onClick={mailboxNotifications.toggleNotifications}
                      sx={{
                        border: 1,
                        borderColor: mailboxNotifications.isEnabled ? accentLine : shellLine,
                        bgcolor: mailboxNotifications.isEnabled ? accentSoft : 'rgba(255, 255, 255, 0.58)',
                        color: mailboxNotifications.isEnabled ? accentText : 'text.secondary',
                        boxShadow: '0 1px 0 rgba(255,255,255,0.72) inset',
                        '&:hover': { bgcolor: accentSoft, borderColor: accentLine, color: accentText },
                      }}
                    >
                      {mailboxNotifications.isEnabled ? (
                        <NotificationsActiveIcon />
                      ) : mailboxNotifications.permission === 'denied' || !mailboxNotifications.isSupported ? (
                        <NotificationsOffIcon />
                      ) : (
                        <NotificationsIcon />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
              <IconButton
                type="button"
                onClick={handleLogout}
                title="Sign out"
                sx={{
                  border: 1,
                  borderColor: shellLine,
                  bgcolor: 'rgba(255, 255, 255, 0.58)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.72) inset',
                  '&:hover': { bgcolor: accentSoft, borderColor: accentLine },
                }}
              >
                <LogoutIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        <Box
          sx={{
            width: '100%',
            maxWidth: isDrawerCollapsed ? 'none' : 1680,
            mx: 'auto',
            p: { xs: 1, sm: 1.5, xl: 2 },
            minWidth: 0,
            minHeight: 0,
            flex: 1,
            overflow: isViewportBoundRoute ? 'hidden' : 'auto',
            boxSizing: 'border-box',
          }}
        >
          <WorkspaceFilterProvider value={workspaceFilterContext}>
            <Suspense fallback={<RouteLoadingPanel />}>
              <Outlet />
            </Suspense>
          </WorkspaceFilterProvider>
        </Box>
      </Box>
        <Dialog open={isAccountDialogOpen} onClose={closeAccountDialog} fullWidth maxWidth="xs">
          <Box component="form" onSubmit={submitAccount}>
            <DialogTitle>Set username</DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <TextField
                autoFocus
                disabled={isUpdatingMe}
                error={Boolean(accountError)}
                fullWidth
                helperText={accountError || 'Use this username to sign in and identify your work.'}
                label="Username"
                onChange={(event) => {
                  setAccountUsername(event.target.value);
                  if (accountError) setAccountError('');
                }}
                value={accountUsername}
              />
            </DialogContent>
            <DialogActions>
              <Button disabled={isUpdatingMe} onClick={closeAccountDialog}>Cancel</Button>
              <Button disabled={isUpdatingMe} type="submit" variant="contained">Save</Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Box>
      </PageHeaderProvider>
    </HeaderSearchProvider>
  );
}

function RouteLoadingPanel() {
  return (
    <Box aria-busy="true" aria-label="Loading page" sx={{ minHeight: 180, pt: 0.5 }}>
      <LinearProgress sx={{ height: 2, borderRadius: 999 }} />
    </Box>
  );
}

function mailboxNotificationTooltip(mailboxNotifications) {
  if (!mailboxNotifications.isSupported) return 'Email notifications unavailable';
  if (mailboxNotifications.permission === 'denied') return 'Email notifications blocked';
  if (mailboxNotifications.isEnabled) return 'Disable email notifications';
  return 'Enable email notifications';
}

function HeaderWorkspaceSelect({ activeWorkspaceId, isLoading, onChange, showGlobalOptions = false, workspaces = [] }) {
  const activeLabel = activeWorkspaceId === ALL_WORKSPACES ? 'All workspaces' : workspaceLabel(workspaces, activeWorkspaceId);

  return (
    <FormControl
      size="small"
      sx={{
        display: { xs: 'none', md: 'block' },
        width: 300,
        minWidth: 300,
        maxWidth: 300,
        flex: '0 0 300px',
        '& .MuiInputBase-root': {
          bgcolor: 'rgba(255, 255, 255, 0.72)',
        },
        '& .MuiSelect-select': {
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }}
    >
      <InputLabel>Workspace</InputLabel>
      <Select
        disabled={isLoading}
        label="Workspace"
        value={String(activeWorkspaceId)}
        onChange={(event) => onChange(event.target.value)}
        renderValue={() => activeLabel}
        startAdornment={<ApartmentIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.75 }} />}
      >
        {showGlobalOptions ? <MenuItem value={ALL_WORKSPACES}>All workspaces</MenuItem> : null}
        {showGlobalOptions ? <MenuItem value={UNASSIGNED_WORKSPACE}>Unassigned workspace</MenuItem> : null}
        {workspaces.map((workspace) => (
          <MenuItem key={workspace.id} value={String(workspace.id)}>
            {workspace.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function DashboardNavGroup({ collapsed = false, isOpen = false, onNavigate, onToggle, search = '' }) {
  if (collapsed) {
    return (
      <NavItem
        to={dashboardNavTarget('/admin/dashboard', search)}
        icon={<AnalyticsIcon />}
        label="Dashboard"
        alwaysHighlighted
        collapsed
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 0.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NavItem
            to={dashboardNavTarget('/admin/dashboard', search)}
            icon={<AnalyticsIcon />}
            label="Dashboard"
            alwaysHighlighted
            onNavigate={onNavigate}
          />
        </Box>
        <Tooltip title={isOpen ? 'Collapse dashboard menu' : 'Expand dashboard menu'} placement="right">
          <IconButton
            type="button"
            aria-label={isOpen ? 'Collapse dashboard menu' : 'Expand dashboard menu'}
            aria-controls="admin-dashboard-subnav"
            aria-expanded={isOpen}
            onClick={onToggle}
            sx={{
              width: 34,
              height: 34,
              border: 1,
              borderColor: isOpen ? accentLine : shellLine,
              borderRadius: 1,
              color: isOpen ? accentText : 'text.secondary',
              bgcolor: isOpen ? accentSoft : 'rgba(255,255,255,0.58)',
              flexShrink: 0,
              boxShadow: '0 1px 0 rgba(255,255,255,0.72) inset',
              '&:hover': {
                bgcolor: accentSoft,
                borderColor: accentLine,
                color: accentText,
              },
              '& .MuiSvgIcon-root': {
                transition: (theme) => theme.transitions.create('transform', {
                  duration: theme.transitions.duration.shorter,
                }),
                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
              },
            }}
          >
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <DashboardSubNav id="admin-dashboard-subnav" search={search} onNavigate={onNavigate} />
      </Collapse>
    </Box>
  );
}

function DashboardSubNav({ collapsed = false, id, onNavigate, search = '' }) {
  const items = [
    { to: '/admin/dashboard/users', icon: <PeopleIcon />, label: 'User performance' },
    { to: '/admin/dashboard/bidders', icon: <LeaderboardIcon />, label: 'Bidder performance' },
    { to: '/admin/dashboard/callers', icon: <PhoneInTalkIcon />, label: 'Caller performance' },
    { to: '/admin/dashboard/profiles', icon: <BadgeIcon />, label: 'Profile performance' },
  ];

  return (
    <Box id={id} sx={{ display: 'grid', gap: 0.25, mt: 0.25, mb: 0.5, pl: collapsed ? 0 : 1 }}>
      {items.map((item) => (
        <NavItem
          key={item.to}
          to={dashboardNavTarget(item.to, search)}
          icon={item.icon}
          label={item.label}
          collapsed={collapsed}
          nested={!collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </Box>
  );
}

function dashboardNavTarget(pathname, search = '') {
  return search ? { pathname, search } : pathname;
}

function NavItem({ alwaysHighlighted = false, badgeContent = 0, collapsed = false, icon, label, nested = false, onNavigate, to }) {
  const badgeCount = Math.max(Number(badgeContent || 0), 0);
  const hasBadge = badgeCount > 0;
  const accessibleLabel = hasBadge ? `${label}, ${badgeCount.toLocaleString()} unread` : label;
  const highlightedStyles = {
    bgcolor: 'rgba(0, 103, 192, 0.12)',
    borderColor: accentLine,
    boxShadow: 'inset 3px 0 0 #0067C0, 0 1px 0 rgba(255,255,255,0.72) inset',
    color: accentText,
    fontWeight: 600,
    '& .MuiListItemIcon-root': { color: accentText },
    '& .MuiListItemText-primary': { color: accentText },
  };
  const persistentHighlightStyles = {
    bgcolor: 'rgba(72, 104, 96, 0.1)',
    borderColor: 'rgba(72, 104, 96, 0.22)',
    color: '#324B45',
    boxShadow: '0 1px 0 rgba(255,255,255,0.72) inset',
    fontWeight: 600,
    '& .MuiListItemIcon-root': { color: '#324B45' },
    '& .MuiListItemText-primary': { color: '#324B45' },
  };

  const button = (
    <ListItemButton
      component={NavLink}
      to={to}
      onClick={(event) => {
        markRouteNavigationStart();
        onNavigate?.(event);
      }}
      onFocus={() => prefetchRoute(to)}
      onMouseEnter={() => prefetchRoute(to)}
      onTouchStart={() => prefetchRoute(to)}
      aria-label={accessibleLabel}
      sx={{
        minHeight: collapsed ? 42 : nested ? 32 : 38,
        width: collapsed ? 42 : '100%',
        borderRadius: 1,
        border: 1,
        borderColor: 'transparent',
        mx: collapsed ? 'auto' : 0,
        px: collapsed ? 0 : nested ? 0.75 : 1,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: alwaysHighlighted ? '#324B45' : 'text.secondary',
        '& .MuiListItemIcon-root': { color: alwaysHighlighted ? '#324B45' : 'text.secondary' },
        '&:hover': {
          bgcolor: alwaysHighlighted ? 'rgba(72, 104, 96, 0.14)' : accentSoft,
          borderColor: alwaysHighlighted ? 'rgba(72, 104, 96, 0.28)' : accentLine,
          color: alwaysHighlighted ? '#324B45' : accentText,
          '& .MuiListItemIcon-root': { color: alwaysHighlighted ? '#324B45' : accentText },
          '& .MuiListItemText-primary': { color: alwaysHighlighted ? '#324B45' : accentText },
        },
        ...(alwaysHighlighted ? persistentHighlightStyles : {}),
        '&.active': highlightedStyles,
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: collapsed ? 0 : 32,
          justifyContent: 'center',
          '& .MuiSvgIcon-root': { fontSize: nested ? 17 : 20 },
        }}
      >
        {hasBadge ? (
          <MuiBadge
            badgeContent={badgeCount}
            max={99}
            overlap="circular"
            sx={unreadIconBadgeSx}
          >
            {icon}
          </MuiBadge>
        ) : icon}
      </ListItemIcon>
      {!collapsed ? <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 600, fontSize: nested ? 12 : 14 }} /> : null}
    </ListItemButton>
  );

  if (!collapsed) return button;
  return (
    <Tooltip title={accessibleLabel} placement="right">
      {button}
    </Tooltip>
  );
}

const unreadIconBadgeSx = {
  '& .MuiBadge-badge': {
    minWidth: 16,
    height: 16,
    px: 0.45,
    border: '2px solid #ffffff',
    bgcolor: '#C42B1C',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1,
  },
};

function readSidebarCollapsedPreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
}

function writeSidebarCollapsedPreference(value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(Boolean(value)));
}
