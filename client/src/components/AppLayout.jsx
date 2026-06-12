import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BadgeIcon from '@mui/icons-material/Badge';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EditIcon from '@mui/icons-material/Edit';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PaidIcon from '@mui/icons-material/Paid';
import PeopleIcon from '@mui/icons-material/People';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import SearchIcon from '@mui/icons-material/Search';
import StyleIcon from '@mui/icons-material/Style';
import WorkIcon from '@mui/icons-material/Work';
import {
  AppBar,
  Avatar,
  Box,
  Button,
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
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLogout, useUpdateMe } from '../lib/authApi.js';
import { CALLER_BLOCKED_ROLES, INTERVIEW_ROLES, MARKETPLACE_ACCESS_ROLES, ROLES, canAccessConsumption, isAdminRole, roleLabel } from '../lib/roles.js';
import { EMPTY_HEADER_SEARCH, HeaderSearchProvider } from './HeaderSearchContext.jsx';

const DRAWER_WIDTH = 248;
const shellLine = '#E2E8F0';

export default function AppLayout({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [accountUsername, setAccountUsername] = useState(user.username || '');
  const [accountError, setAccountError] = useState('');
  const { mutate: logout } = useLogout();
  const { mutate: updateMe, isPending: isUpdatingMe } = useUpdateMe();
  const isAdminDashboardRoute = location.pathname.startsWith('/admin/dashboard');
  const isConsumptionRoute = location.pathname.startsWith('/admin/consumption');
  const isAdminRoute = location.pathname.startsWith('/admin/users');
  const isBidRoute = location.pathname.startsWith('/bids');
  const isBidderRoute = location.pathname.startsWith('/bidders');
  const isCallerRoute = location.pathname.startsWith('/callers');
  const isCalendarRoute = location.pathname.startsWith('/calendar');
  const isFaqRoute = location.pathname.startsWith('/faqs');
  const isInterviewRoute = location.pathname.startsWith('/interviews');
  const isMarketplaceRoute = location.pathname.startsWith('/marketplace');
  const isProfileRoute = location.pathname.startsWith('/profiles');
  const isTailoringRoute = location.pathname.startsWith('/tailoring-requests');
  const [headerSearch, setHeaderSearch] = useState(EMPTY_HEADER_SEARCH);
  const headerSearchContext = useMemo(
    () => ({ search: headerSearch, setSearch: setHeaderSearch }),
    [headerSearch],
  );
  const canAccessInterviews = INTERVIEW_ROLES.includes(user.role);
  const canAccessMarketplace = MARKETPLACE_ACCESS_ROLES.includes(user.role);
  const canManageCallers = !CALLER_BLOCKED_ROLES.includes(user.role);
  const isCaller = user.role === 'caller';

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

  const title = isAdminDashboardRoute ? 'Dashboard' : isConsumptionRoute ? 'Consumption' : isAdminRoute ? 'Users' : isTailoringRoute ? 'Tailoring requests' : isFaqRoute ? 'FAQs' : isBidderRoute ? 'Bidders' : isMarketplaceRoute ? 'Marketplace' : isCallerRoute ? 'Callers' : isCalendarRoute ? 'Calendar' : isInterviewRoute ? 'Interviews' : isBidRoute ? 'Applications' : isProfileRoute ? 'Profiles' : 'Jobs';
  const subtitle = isAdminDashboardRoute
    ? 'Monitor user and bidder performance'
    : isConsumptionRoute
    ? 'Track team spend across currencies and channels'
    : isAdminRoute
    ? 'Manage back-office accounts'
    : isTailoringRoute
      ? 'Review all resume tailoring activity'
    : isFaqRoute
      ? 'Browse answers and publish help content'
    : isBidderRoute
      ? 'Review bidder output and interview pass-through'
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
          px: 1.5,
          borderBottom: 1,
          borderColor: shellLine,
          bgcolor: '#ffffff',
        }}
      >
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
      </Toolbar>
      <Box sx={{ px: 1, py: 1 }}>
        <List component="nav" aria-label="Workspace navigation" sx={{ display: 'grid', gap: 0.35 }}>
          {isAdminRole(user) ? (
            <NavItem to="/admin/dashboard" icon={<AnalyticsIcon />} label="Dashboard" alwaysHighlighted onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canAccessConsumption(user) ? (
            <NavItem to="/admin/consumption" icon={<PaidIcon />} label="Consumption" onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {!isCaller ? <NavItem to="/jobs" icon={<WorkIcon />} label="Jobs" onNavigate={() => setMobileOpen(false)} /> : null}
          {!isCaller ? <NavItem to="/bids" icon={<AssignmentIcon />} label="Applications" onNavigate={() => setMobileOpen(false)} /> : null}
          {!isCaller && [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.financeManager, ROLES.bidder, ROLES.readonlyBidder, ROLES.editableBidder].includes(user.role) ? (
            <NavItem to="/bidders" icon={<LeaderboardIcon />} label="Bidders" onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canAccessInterviews ? (
            <NavItem to="/interviews" icon={<EventNoteIcon />} label="Interviews" onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canAccessInterviews ? (
            <NavItem to="/calendar" icon={<CalendarMonthIcon />} label="Calendar" onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canAccessMarketplace ? (
            <NavItem to="/marketplace" icon={<HandshakeIcon />} label="Marketplace" onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {canManageCallers ? (
            <NavItem to="/callers" icon={<PhoneInTalkIcon />} label="Callers" onNavigate={() => setMobileOpen(false)} />
          ) : null}
          {!isCaller ? <NavItem to="/profiles" icon={<BadgeIcon />} label="Profiles" onNavigate={() => setMobileOpen(false)} /> : null}
          {!isCaller ? (
            <NavItem to="/tailoring-requests" icon={<StyleIcon />} label="Tailoring" onNavigate={() => setMobileOpen(false)} />
          ) : null}
          <NavItem to="/faqs" icon={<HelpOutlinedIcon />} label="FAQs" onNavigate={() => setMobileOpen(false)} />
          {isAdminRole(user) ? (
            <NavItem to="/admin/users" icon={<PeopleIcon />} label="Users" onNavigate={() => setMobileOpen(false)} />
          ) : null}
        </List>
      </Box>
      <Box sx={{ mt: 'auto', p: 1 }}>
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
          width: { md: DRAWER_WIDTH },
          flexShrink: { md: 0 },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: shellLine,
            background: '#ffffff',
            boxShadow: { xs: 4, md: '8px 0 26px rgba(15, 23, 42, 0.05)' },
            display: 'flex',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ minWidth: 0, flex: 1, height: '100vh', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
            maxWidth: 1680,
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
            <DialogContent sx={{ pt: 1 }}>
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

function NavItem({ alwaysHighlighted = false, icon, label, onNavigate, to }) {
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

  return (
    <ListItemButton
      component={NavLink}
      to={to}
      onClick={onNavigate}
      sx={{
        minHeight: 38,
        borderRadius: 1,
        border: 1,
        borderColor: 'transparent',
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
    <ListItemIcon sx={{ minWidth: 32, '& .MuiSvgIcon-root': { fontSize: 20 } }}>{icon}</ListItemIcon>
    <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 700, fontSize: 13 }} />
  </ListItemButton>
  );
}
