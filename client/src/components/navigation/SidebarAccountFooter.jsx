import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Avatar, Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import { roleLabel } from '../../lib/roles.js';

const shellLine = 'rgba(0, 0, 0, 0.09)';
const accentSoft = 'rgba(0, 103, 192, 0.1)';
const accentLine = 'rgba(0, 103, 192, 0.28)';
const accentText = '#004E8C';

export default function SidebarAccountFooter({ collapsed = false, onOpen, user = {} }) {
  const username = user.username || 'Account';
  const role = roleLabel(user.role);
  const initial = accountInitial(user);

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        p: collapsed ? 0.75 : 1,
        borderTop: 1,
        borderColor: shellLine,
        bgcolor: 'rgba(255, 255, 255, 0.32)',
      }}
    >
      {collapsed ? (
        <Tooltip title={`${username} · ${role} · Edit account`} placement="right">
          <ButtonBase
            type="button"
            onClick={onOpen}
            aria-label={`Edit account for ${username}`}
            sx={accountButtonSx(true)}
          >
            <AccountAvatar initial={initial} compact />
          </ButtonBase>
        </Tooltip>
      ) : (
        <ButtonBase
          type="button"
          onClick={onOpen}
          aria-label={`Edit account for ${username}`}
          sx={accountButtonSx(false)}
        >
          <AccountAvatar initial={initial} />
          <Box sx={{ minWidth: 0, flex: 1, display: 'grid', gap: 0.1, textAlign: 'left' }}>
            <Typography fontWeight={600} noWrap sx={{ color: 'text.primary', fontSize: 14, lineHeight: 1.3 }}>
              {username}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: accentText, fontWeight: 600, lineHeight: 1.3, textTransform: 'capitalize' }}>
              {role}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ lineHeight: 1.3 }}>
              {user.email || 'Edit account details'}
            </Typography>
          </Box>
          <Box
            aria-hidden="true"
            data-account-edit-icon="true"
            sx={{
              width: 28,
              height: 28,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              color: 'text.secondary',
              bgcolor: 'rgba(255, 255, 255, 0.68)',
              border: 1,
              borderColor: shellLine,
              flexShrink: 0,
            }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
        </ButtonBase>
      )}
    </Box>
  );
}

function AccountAvatar({ compact = false, initial }) {
  return (
    <Avatar
      aria-hidden="true"
      sx={{
        width: compact ? 36 : 40,
        height: compact ? 36 : 40,
        bgcolor: '#0067C0',
        color: '#FFFFFF',
        fontSize: compact ? 14 : 16,
        fontWeight: 700,
        boxShadow: '0 4px 12px rgba(0, 103, 192, 0.22)',
        flexShrink: 0,
      }}
    >
      {initial}
    </Avatar>
  );
}

function accountButtonSx(collapsed) {
  return {
    width: collapsed ? 44 : '100%',
    minHeight: collapsed ? 44 : 64,
    mx: collapsed ? 'auto' : 0,
    p: collapsed ? 0 : 0.75,
    display: 'flex',
    justifyContent: collapsed ? 'center' : 'flex-start',
    alignItems: 'center',
    gap: collapsed ? 0 : 1,
    borderRadius: 2,
    border: 1,
    borderColor: 'transparent',
    bgcolor: 'transparent',
    transition: (theme) => theme.transitions.create(['background-color', 'border-color', 'box-shadow', 'transform'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': {
      bgcolor: accentSoft,
      borderColor: accentLine,
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
      '& [data-account-edit-icon="true"]': {
        color: accentText,
        borderColor: accentLine,
      },
    },
    '&:active': { transform: 'translateY(1px)' },
    '&:focus-visible': { outline: `3px solid ${accentLine}`, outlineOffset: 1 },
  };
}

function accountInitial(user) {
  const value = String(user.username || user.email || 'A').trim();
  return value.charAt(0).toUpperCase() || 'A';
}
