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
  onView = () => {},
  onReopenProfile,
  onShare,
}) {
  const color = PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green;
  const isClosed = profile.profileStatus === 'closed';
  const showActions = canManage && !profile.isShared;
  const sharedWith = (profile.sharedWith || []).filter((share) => share.username);
  return (
    <Card
      variant="outlined"
      onClick={() => onView(profile)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onView(profile);
      }}
      role="button"
      tabIndex={0}
      sx={{
        borderTop: `4px solid ${color.main}`,
        boxShadow: 1,
        cursor: 'pointer',
        minHeight: 246,
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 150ms ease, transform 150ms ease',
        '&:hover': {
          boxShadow: 2,
          transform: 'translateY(-1px)',
        },
        '&:focus-visible': {
          outline: `2px solid ${color.main}`,
          outlineOffset: 2,
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
        {sharedWith.length ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {sharedWith.map((share) => (
              <Chip
                key={share.id || share.userId || share.username}
                label={`Shared with ${share.username}${share.status === 'pending' ? ' (pending)' : ''}`}
                size="small"
                variant="outlined"
              />
            ))}
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
        {profile.yearsOfExperience ? (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`${profile.yearsOfExperience} yrs`} size="small" />
          </Stack>
        ) : null}
        <ProfileProgress progress={profile.progress} />
      </CardContent>
      {showActions ? (
        <CardActions
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          sx={{ mt: 'auto', px: 1.25, pb: 1.25, gap: 0.5, flexWrap: 'wrap' }}
        >
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

function ProfileProgress({ progress = {} }) {
  const tailored = Number(progress.tailored || 0);
  const bids = Number(progress.bids || 0);
  const done = Number(progress.done || 0);
  const planned = Number(progress.planned || 0);

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      <Chip label={`${tailored.toLocaleString()} tailored`} size="small" variant="outlined" />
      <Chip label={`${bids.toLocaleString()} bids`} size="small" variant="outlined" />
      <Chip label={`${done.toLocaleString()} done`} size="small" variant="outlined" />
      {planned ? <Chip label={`${planned.toLocaleString()} planned`} size="small" variant="outlined" /> : null}
    </Stack>
  );
}

const actionIconSx = {
  width: 38,
  height: 38,
  border: 1,
  borderColor: 'divider',
};
