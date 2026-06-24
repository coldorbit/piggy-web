import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AnalyticsIcon from '@mui/icons-material/Analytics';
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
import StyleIcon from '@mui/icons-material/Style';
import WorkIcon from '@mui/icons-material/Work';
import {
  AppBar,
  Avatar,
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
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useCallback, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLogout, useUpdateMe } from '../lib/authApi.js';
import { useMailboxNotifications } from '../lib/mailboxNotifications.js';
import {
  MARKETPLACE_ACCESS_ROLES,
  ROLES,
  canAccessBidderDirectory,
  canAccessBidWorkspace,
  canAccessConsumption,
  canAccessAssessments,
  canAccessInbox,
  canAccessInterviews,
  canAccessJobs,
  canAccessPersonalDashboard,
  canManageCallers,
  isAdminRole,
  roleLabel,
} from '../lib/roles.js';
import { EMPTY_HEADER_SEARCH, HeaderSearchProvider } from './HeaderSearchContext.jsx';

const DRAWER_WIDTH = 248;
const COLLAPSED_DRAWER_WIDTH = 72;
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'applypilot-sidebar-collapsed';
const shellLine = '#E2E8F0';

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
  const { mutate: logout } = useLogout();
  const { mutate: updateMe, isPending: isUpdatingMe } = useUpdateMe();
  const isAdminDashboardRoute = location.pathname.startsWith('/admin/dashboard');
  const isPersonalDashboardRoute = location.pathname.startsWith('/dashboard');
  const isConsumptionRoute = location.pathname.startsWith('/admin/consumption');
  const isAssessmentRoute = location.pathname.startsWith('/assessments');
  const isAdminRoute = location.pathname.startsWith('/admin/users');
  const isBidRoute = location.pathname.startsWith('/bids');
  const isBidderRoute = location.pathname.startsWith('/bidders');
  const isCallerRoute = location.pathname.startsWith('/callers');
  const isCalendarRoute = location.pathname.startsWith('/calendar');
  const isFaqRoute = location.pathname.startsWith('/faqs');
  const isInboxRoute = location.pathname.startsWith('/inbox');
  const isInterviewRoute = location.pathname.startsWith('/interviews');
  const isMarketplaceRoute = location.pathname.startsWith('/marketplace');
  const isProfileRoute = location.pathname.startsWith('/profiles');
  const isTailoringRoute = location.pathname.startsWith('/tailoring-requests');
  const [headerSearch, setHeaderSearch] = useState(EMPTY_HEADER_SEARCH);
  const headerSearchContext = useMemo(
    () => ({ search: headerSearch, setSearch: setHeaderSearch }),
    [headerSearch],
  );
  const canViewInterviews = canAccessInterviews(user);
  const canAccessMarketplace = MARKETPLACE_ACCESS_ROLES.includes(user.role);
  const canViewCallers = canManageCallers(user);
  const canViewInbox = canAccessInbox(user);
  const canViewBidders = canAccessBidderDirectory(user);
  const canViewAssessments = canAccessAssessments(user);
  const canViewBidWorkspace = canAccessBidWorkspace(user);
  const canViewJobs = canAccessJobs(user);
  const canViewPersonalDashboard = canAccessPersonalDashboard(user);
  const isCaller = user.role === ROLES.caller;
  const isDrawerCollapsed = isDesktop && isSidebarCollapsed;
  const drawerWidth = isDrawerCollapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH;
  const adminDashboardSearch = isAdminDashboardRoute ? location.search : '';
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

  const title = isAdminDashboardRoute || isPersonalDashboardRoute ? 'Dashboard' : isConsumptionRoute ? 'Consumption' : isAssessmentRoute ? 'Assessments' : isAdminRoute ? 'Users' : isTailoringRoute ? 'Tailoring requests' : isFaqRoute ? 'FAQs' : isBidderRoute ? 'Bidders' : isInboxRoute ? 'Inbox' : isMarketplaceRoute ? 'Marketplace' : isCallerRoute ? 'Callers' : isCalendarRoute ? 'Calendar' : isInterviewRoute ? 'Interviews' : isBidRoute ? 'Applications' : isProfileRoute ? 'Profiles' : 'Jobs';
  const subtitle = isAdminDashboardRoute
    ? 'Monitor user and bidder performance'
    : isPersonalDashboardRoute
    ? 'Track your applications, interviews, and profile momentum'
    : isConsumptionRoute
    ? 'Track team spend across currencies and channels'
    : isAssessmentRoute
    ? 'Register assessment links and deadlines by profile'
    : isAdminRoute
    ? 'Manage back-office accounts'
    : isTailoringRoute
      ? 'Review all resume tailoring activity'
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
  const drawerContent = (
    <>
      <Toolbar
        sx={{
          minHeight: 68,
          gap: 1,
          px: isDrawerCollapsed ? 1 : 1.5,
          borderBottom: 1,
          borderColor: shellLine,
          bgcolor: '#ffffff',
          justifyContent: isDrawerCollapsed ? 'center' : 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {!isDrawerCollapsed ? (
            <>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  display: 'grid',
                  placeItems: 'center',
                  border: 1,
                  borderColor: '#DBEAFE',
                  borderRadius: 2,
                  bgcolor: '#EFF6FF',
                  boxShadow: '0 10px 24px rgba(37, 99, 235, 0.14)',
                  flexShrink: 0,
                }}
              >
                <Avatar
                  src="/assets/applypilot-logo.png"
                  alt="ApplyPilot logo"
                  variant="rounded"
                  sx={{ width: 26, height: 26, bgcolor: 'background.paper', borderRadius: 1.25 }}
                />
              </Box>
              <Box minWidth={0}>
                <Typography fontWeight={900} lineHeight={1.1} sx={{ color: 'primary.dark', letterSpacing: 0.2 }}>
                  ApplyPilot
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Career command center
                </Typography>
              </Box>
            </>
          ) : null}
        </Box>
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
                bgcolor: '#ffffff',
                color: 'text.secondary',
                width: 34,
                height: 34,
                flexShrink: 0,
                '&:hover': { bgcolor: '#EFF6FF', borderColor: '#BFDBFE', color: 'primary.dark' },
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
          <NavItem to="/faqs" icon={<HelpOutlinedIcon />} label="FAQs" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
          {isAdminRole(user) ? (
            <NavItem to="/admin/users" icon={<PeopleIcon />} label="Users" collapsed={isDrawerCollapsed} onNavigate={() => setMobileOpen(false)} />
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
                bgcolor: '#F8FAFC',
                color: 'primary.dark',
                '&:hover': { bgcolor: '#EFF6FF', borderColor: '#BFDBFE' },
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
              borderRadius: 1,
              p: 1,
              bgcolor: '#F8FAFC',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Signed in as
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Typography fontWeight={900} noWrap sx={{ minWidth: 0, flex: 1 }}>
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
            <Chip label={roleLabel(user.role)} size="small" sx={{ mt: 1, bgcolor: 'secondary.main', color: '#ffffff' }} />
          </Box>
        )}
      </Box>
    </>
  );

  return (
    <HeaderSearchProvider value={headerSearchContext}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          bgcolor: 'background.default',
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
            background: '#ffffff',
            boxShadow: { xs: 4, md: '8px 0 26px rgba(15, 23, 42, 0.05)' },
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
            bgcolor: 'rgba(255, 255, 255, 0.88)',
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
              <Box
                minWidth={0}
                sx={{
                  borderLeft: { xs: 0, sm: 2 },
                  borderColor: 'primary.main',
                  pl: { xs: 0, sm: 1.25 },
                }}
              >
                <Typography variant="h5" fontWeight={900} noWrap sx={{ color: 'text.primary', letterSpacing: 0.2 }}>
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
                        borderColor: mailboxNotifications.isEnabled ? '#BFDBFE' : shellLine,
                        bgcolor: mailboxNotifications.isEnabled ? '#EFF6FF' : 'rgba(255, 255, 255, 0.72)',
                        color: mailboxNotifications.isEnabled ? 'primary.dark' : 'text.secondary',
                        '&:hover': { bgcolor: '#EFF6FF', borderColor: '#BFDBFE', color: 'primary.dark' },
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
                  bgcolor: 'rgba(255, 255, 255, 0.72)',
                  '&:hover': { bgcolor: '#EFF6FF', borderColor: '#BFDBFE' },
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
            overflow: isCalendarRoute ? 'hidden' : 'auto',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
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
    </HeaderSearchProvider>
  );
}

function mailboxNotificationTooltip(mailboxNotifications) {
  if (!mailboxNotifications.isSupported) return 'Email notifications unavailable';
  if (mailboxNotifications.permission === 'denied') return 'Email notifications blocked';
  if (mailboxNotifications.isEnabled) return 'Disable email notifications';
  return 'Enable email notifications';
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
              borderColor: isOpen ? '#0D9488' : shellLine,
              borderRadius: 1,
              color: isOpen ? '#0F766E' : 'text.secondary',
              bgcolor: isOpen ? '#CCFBF1' : '#ffffff',
              flexShrink: 0,
              '&:hover': {
                bgcolor: '#CCFBF1',
                borderColor: '#0D9488',
                color: '#115E59',
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
    bgcolor: 'primary.main',
    borderColor: 'primary.main',
    boxShadow: '0 10px 24px rgba(37, 99, 235, 0.22)',
    color: 'primary.contrastText',
    fontWeight: 800,
    '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
    '& .MuiListItemText-primary': { color: 'primary.contrastText' },
  };
  const persistentHighlightStyles = {
    bgcolor: '#F0FDFA',
    borderColor: '#14B8A6',
    borderLeftWidth: 4,
    color: '#0F766E',
    boxShadow: 'inset 0 0 0 1px rgba(20, 184, 166, 0.12)',
    fontWeight: 800,
    '& .MuiListItemIcon-root': { color: '#0F766E' },
    '& .MuiListItemText-primary': { color: '#0F766E' },
  };

  const button = (
    <ListItemButton
      component={NavLink}
      to={to}
      onClick={onNavigate}
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
        color: alwaysHighlighted ? '#0F766E' : 'text.secondary',
        '& .MuiListItemIcon-root': { color: alwaysHighlighted ? '#0F766E' : 'text.secondary' },
        '&:hover': {
          bgcolor: alwaysHighlighted ? '#CCFBF1' : '#EFF6FF',
          borderColor: alwaysHighlighted ? '#0D9488' : '#DBEAFE',
          color: alwaysHighlighted ? '#115E59' : 'primary.dark',
          '& .MuiListItemIcon-root': { color: alwaysHighlighted ? '#115E59' : 'primary.dark' },
          '& .MuiListItemText-primary': { color: alwaysHighlighted ? '#115E59' : 'primary.dark' },
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
      {!collapsed ? <ListItemText primary={label} primaryTypographyProps={{ fontWeight: nested ? 650 : 700, fontSize: nested ? 12 : 13 }} /> : null}
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
    bgcolor: '#DC2626',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 900,
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
