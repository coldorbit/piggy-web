import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BadgeIcon from '@mui/icons-material/Badge';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import WorkIcon from '@mui/icons-material/Work';
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLogout } from '../lib/api.js';

const DRAWER_WIDTH = 248;

export default function AppLayout({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { mutate: logout } = useLogout();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isBidRoute = location.pathname.startsWith('/bids');
  const isProfileRoute = location.pathname.startsWith('/profiles');

  async function handleLogout() {
    logout(undefined, {
      onSettled: () => navigate('/', { replace: true }),
    });
  }

  const title = isAdminRoute ? 'Users' : isBidRoute ? 'Applications' : isProfileRoute ? 'Profiles' : 'Jobs';
  const subtitle = isAdminRoute
    ? 'Manage back-office accounts'
    : isBidRoute
      ? 'Track tailored applications by profile'
      : isProfileRoute
        ? 'Shape candidate stories and resume signals'
        : 'Discover, review, and prioritize matched roles';
  const drawerContent = (
    <>
      <Toolbar sx={{ minHeight: 76, gap: 1.25, px: 2 }}>
        <Avatar
          src="/assets/applypilot-logo.png"
          alt="ApplyPilot logo"
          variant="rounded"
          sx={{
            width: 42,
            height: 42,
            bgcolor: 'background.paper',
            boxShadow: '0 10px 24px rgba(95, 91, 216, 0.26)',
          }}
        />
        <Box minWidth={0}>
          <Typography fontWeight={900} lineHeight={1.1}>
            ApplyPilot
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Career command center
          </Typography>
        </Box>
      </Toolbar>
      <Box sx={{ px: 1.25, pb: 1 }}>
        <List component="nav" aria-label="Workspace navigation" sx={{ display: 'grid', gap: 0.5 }}>
          <NavItem to="/jobs" icon={<WorkIcon />} label="Jobs" onNavigate={() => setMobileOpen(false)} />
          <NavItem to="/bids" icon={<AssignmentIcon />} label="Applications" onNavigate={() => setMobileOpen(false)} />
          <NavItem to="/profiles" icon={<BadgeIcon />} label="Profiles" onNavigate={() => setMobileOpen(false)} />
          {user.role === 'admin' ? (
            <NavItem to="/admin/users" icon={<PeopleIcon />} label="Users" onNavigate={() => setMobileOpen(false)} />
          ) : null}
        </List>
      </Box>
      <Box sx={{ mt: 'auto', p: 1.5 }}>
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: 1.25,
            bgcolor: 'rgba(255, 255, 255, 0.72)',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Signed in as
          </Typography>
          <Typography fontWeight={900} noWrap>
            {user.username}
          </Typography>
          <Chip label={roleLabel(user.role)} size="small" sx={{ mt: 1, bgcolor: 'secondary.main', color: '#ffffff' }} />
        </Box>
      </Box>
    </>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
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
            borderRight: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,244,255,0.94))',
            boxShadow: { xs: 4, md: '8px 0 26px rgba(42, 38, 76, 0.07)' },
            display: 'flex',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ minWidth: 0, flex: 1 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            backdropFilter: 'blur(18px)',
            bgcolor: 'rgba(255, 255, 255, 0.84)',
          }}
        >
          <Toolbar sx={{ minHeight: 76, justifyContent: 'space-between', gap: 2, px: { xs: 1.5, sm: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              {!isDesktop ? (
                <IconButton type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                  <MenuIcon />
                </IconButton>
              ) : null}
              <Box minWidth={0}>
                <Typography variant="h5" fontWeight={900} noWrap>
                  {title}
                </Typography>
                <Typography color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {subtitle}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.75 }}>
                <AccountCircleIcon color="action" />
                <Typography color="text.secondary" noWrap>
                  {user.username}
                </Typography>
              </Box>
              <IconButton type="button" onClick={handleLogout} title="Sign out">
                <LogoutIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        <Box sx={{ width: '100%', maxWidth: 1680, mx: 'auto', p: { xs: 1.25, sm: 2, xl: 3 }, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

function NavItem({ icon, label, onNavigate, to }) {
  return (
    <ListItemButton
      component={NavLink}
      to={to}
      onClick={onNavigate}
      sx={{
        minHeight: 46,
        borderRadius: 2,
        color: 'text.secondary',
        '& .MuiListItemIcon-root': { color: 'text.secondary' },
        '&:hover': {
          bgcolor: 'rgba(95, 91, 216, 0.08)',
          color: 'primary.dark',
        },
        '&.active': {
          bgcolor: 'primary.main',
          boxShadow: '0 10px 24px rgba(95, 91, 216, 0.24)',
          color: 'primary.contrastText',
          fontWeight: 800,
          '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
          '& .MuiListItemText-primary': { color: 'primary.contrastText' },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 38 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 700 }} />
    </ListItemButton>
  );
}

function roleLabel(role) {
  if (role === 'readonly_bidder' || role === 'bidder') return 'Readonly bidder';
  if (role === 'editable_bidder') return 'Editable bidder';
  return role;
}
