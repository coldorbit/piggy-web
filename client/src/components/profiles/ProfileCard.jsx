import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ShareIcon from '@mui/icons-material/Share';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { Box, Button, Card, CardActions, CardContent, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { PROFILE_BADGE_COLORS, PROFILE_COLORS } from './profileConstants.js';

export default function ProfileCard({
  canManage = true,
  canRestore = false,
  canUpdateStatus = false,
  isDeleting,
  isUpdatingStatus = false,
  profile,
  onCloseProfile,
  onDelete,
  onEdit,
  onReopenProfile,
  onShare,
}) {
  const color = PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green;
  const isClosed = profile.profileStatus === 'closed';
  const showActions = canManage && !profile.isShared;
  return (
    <Card
      variant="outlined"
      sx={{
        borderTop: `4px solid ${color.main}`,
        boxShadow: 1,
        minHeight: 246,
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 150ms ease, transform 150ms ease',
        '&:hover': {
          boxShadow: 2,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ display: 'grid', gap: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) max-content',
            gap: 1,
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          <Box minWidth={0}>
            <Typography variant="h6" fontWeight={900} noWrap>
              {profile.name}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {[profile.location, profile.email, profile.phone].filter(Boolean).join(' · ') || 'No contact details set.'}
            </Typography>
          </Box>
          <Chip
            label={profile.colorScheme}
            sx={{ bgcolor: color.soft, color: color.dark, fontWeight: 400, justifySelf: 'end' }}
          />
        </Box>
        {profile.isShared ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip label="Shared" size="small" color="secondary" sx={{ fontWeight: 400 }} />
            {profile.sharedBy ? <Chip label={`From ${profile.sharedBy}`} size="small" variant="outlined" /> : null}
          </Stack>
        ) : null}
        {profile.ownerUsername ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip label={`Owner ${profile.ownerUsername}`} size="small" variant="outlined" />
          </Stack>
        ) : null}
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            label={isClosed ? 'Closed' : 'Active'}
            size="small"
            color={isClosed ? 'default' : 'success'}
            variant={isClosed ? 'outlined' : 'filled'}
            sx={{ fontWeight: 400 }}
          />
          {isClosed && profile.closedReason ? <Chip label={profile.closedReason} size="small" variant="outlined" /> : null}
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            label={profile.profileBadge || 'SWE'}
            size="small"
            sx={{ ...(PROFILE_BADGE_COLORS[profile.profileBadge || 'SWE'] || {}), fontWeight: 400 }}
          />
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {profile.yearsOfExperience ? <Chip label={`${profile.yearsOfExperience} yrs`} size="small" /> : null}
          {profile.companies?.length ? <Chip label={`${profile.companies.length} companies`} size="small" /> : null}
          {profile.education?.length ? <Chip label={`${profile.education.length} education`} size="small" /> : null}
        </Stack>
      </CardContent>
      {showActions ? (
        <CardActions sx={{ mt: 'auto', px: 1.25, pb: 1.25, gap: 0.5, flexWrap: 'wrap' }}>
          <>
            <Tooltip title="Edit profile">
              <IconButton aria-label="Edit profile" onClick={() => onEdit(profile)} sx={actionIconSx}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share profile">
              <IconButton aria-label="Share profile" onClick={() => onShare(profile)} sx={actionIconSx}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete profile">
              <span>
                <IconButton
                  aria-label="Delete profile"
                  color="error"
                  disabled={isDeleting}
                  onClick={() => onDelete(profile.id)}
                  sx={actionIconSx}
                >
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          </>
          {canUpdateStatus ? (
            isClosed ? (
              canRestore ? (
                <Button disabled={isUpdatingStatus} startIcon={<LockOpenIcon />} onClick={() => onReopenProfile(profile)} variant="outlined">
                  Reopen
                </Button>
              ) : null
            ) : (
              <Button color="warning" disabled={isUpdatingStatus} startIcon={<StopCircleIcon />} onClick={() => onCloseProfile(profile)} variant="outlined">
                Close
              </Button>
            )
          ) : null}
        </CardActions>
      ) : null}
    </Card>
  );
}

const actionIconSx = {
  width: 38,
  height: 38,
  border: 1,
  borderColor: 'divider',
};
