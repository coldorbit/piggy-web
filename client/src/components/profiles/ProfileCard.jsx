import DeleteIcon from '@mui/icons-material/Delete';
import DraftsIcon from '@mui/icons-material/Drafts';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import ShareIcon from '@mui/icons-material/Share';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { Box, Button, Card, CardActions, CardContent, Chip, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { PROFILE_BADGE_COLORS, PROFILE_COLORS } from './profileConstants.js';

export default function ProfileCard({
  canManage = true,
  canManageLegacy = false,
  canRestore = false,
  canUpdateStatus = false,
  isDeleting,
  isHighlighted = false,
  isUpdatingStatus = false,
  profile,
  onCloseProfile,
  onDelete,
  onEdit,
  onChangeOwner = () => {},
  onMarkDraft = () => {},
  onMarkLegacy = () => {},
  onView = () => {},
  onReopenProfile,
  onShare,
}) {
  const color = PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green;
  const isClosed = profile.profileStatus === 'closed';
  const isDraft = profile.profileStatus === 'draft';
  const isLegacy = profile.profileStatus === 'legacy';
  const showActions = canManage && !profile.isShared;
  const sharedWith = (profile.sharedWith || []).filter((share) => share.username);
  return (
    <Card
      id={`profile-card-${profile.id}`}
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
        borderColor: isHighlighted ? color.main : 'divider',
        borderTop: `4px solid ${color.main}`,
        boxShadow: isHighlighted ? `0 0 0 3px ${color.soft}` : 1,
        cursor: 'pointer',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        flex: { xs: '1 1 100%', sm: '0 1 320px' },
        height: 450,
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
        transition: 'box-shadow 150ms ease, transform 150ms ease',
        '&:hover': {
          boxShadow: 2,
          transform: 'translateY(-1px)',
        },
        '&:focus-visible': {
          outline: `2px solid ${color.main}`,
          outlineOffset: 2,
        },
        width: '100%',
      }}
    >
      <CardContent
        sx={{
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          minHeight: 0,
          minWidth: 0,
          p: 2,
          pb: showActions ? 1 : 2,
          '&:last-child': { pb: showActions ? 1 : 2 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flex: '1 1 auto',
            flexDirection: 'column',
            gap: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: 'auto',
            pr: 0.25,
          }}
        >
          <Box
            sx={{
              alignItems: 'flex-start',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
              <Typography variant="h6" fontWeight={900} noWrap>
                {profile.name}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {[profile.location, profile.email, profile.phone].filter(Boolean).join(' · ') || 'No contact details set.'}
              </Typography>
            </Box>
            <Chip
              label={profile.colorScheme}
              sx={{ ...profileChipSx, bgcolor: color.soft, color: color.dark, fontWeight: 400, justifySelf: 'end' }}
            />
          </Box>
          {profile.isShared ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={chipListSx}>
              <Chip label="Shared" size="small" color="secondary" sx={{ ...profileChipSx, fontWeight: 400 }} />
              {profile.sharedBy ? <Chip label={`From ${profile.sharedBy}`} size="small" variant="outlined" sx={profileChipSx} /> : null}
            </Stack>
          ) : null}
          {profile.ownerUsername ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={chipListSx}>
              <Chip label={`Owner ${profile.ownerUsername}`} size="small" variant="outlined" sx={profileChipSx} />
            </Stack>
          ) : null}
          {profile.workspaceName ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={chipListSx}>
              <Chip label={profile.workspaceName} size="small" sx={{ ...profileChipSx, bgcolor: '#ecfeff', color: '#155e75', fontWeight: 700 }} />
            </Stack>
          ) : null}
          {sharedWith.length ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={chipListSx}>
              {sharedWith.map((share) => (
                <Chip
                  key={share.id || share.userId || share.username}
                  label={`Shared with ${share.username}${share.status === 'pending' ? ' (pending)' : ''}`}
                  size="small"
                  variant="outlined"
                  sx={profileChipSx}
                />
              ))}
            </Stack>
          ) : null}
          <Stack direction="row" spacing={0.75} useFlexGap sx={chipListSx}>
            <Chip
              label={isLegacy ? 'Legacy' : isDraft ? 'Draft' : isClosed ? 'Closed' : 'Active'}
              size="small"
              color={isLegacy || isClosed || isDraft ? 'default' : 'success'}
              variant={isLegacy || isClosed || isDraft ? 'outlined' : 'filled'}
              sx={{
                ...profileChipSx,
                bgcolor: isDraft ? '#fef3c7' : undefined,
                color: isDraft ? '#92400e' : undefined,
                fontWeight: 400,
              }}
            />
            {isClosed && profile.closedReason ? <Chip label={profile.closedReason} size="small" variant="outlined" sx={profileChipSx} /> : null}
            {profile.isStatic ? (
              <Chip
                label={profile.hasStaticResume ? 'Static resume' : 'Static profile'}
                size="small"
                sx={{ ...profileChipSx, bgcolor: '#ecfeff', color: '#155e75', fontWeight: 700 }}
              />
            ) : null}
          </Stack>
          <Stack direction="row" spacing={0.75} useFlexGap sx={chipListSx}>
            <Chip
              label={profile.profileBadge || 'SWE'}
              size="small"
              sx={{ ...profileChipSx, ...(PROFILE_BADGE_COLORS[profile.profileBadge || 'SWE'] || {}), fontWeight: 400 }}
            />
          </Stack>
          {profile.yearsOfExperience ? (
            <Stack direction="row" spacing={1} useFlexGap sx={chipListSx}>
              <Chip label={`${profile.yearsOfExperience} yrs`} size="small" sx={profileChipSx} />
            </Stack>
          ) : null}
        </Box>
        <Box sx={{ borderTop: 1, borderColor: 'divider', flex: '0 0 auto', mt: 1, pt: 1 }}>
          <ProfileProgress progress={profile.progress} />
        </Box>
      </CardContent>
      {showActions ? (
        <CardActions
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          sx={{
            alignItems: 'center',
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flex: '0 0 auto',
            flexWrap: 'wrap',
            gap: 0.5,
            justifyContent: 'flex-start',
            minWidth: 0,
            position: 'static',
            px: 1.25,
            py: 1,
            width: '100%',
            '& .MuiButton-root': {
              flex: '0 1 auto',
              minWidth: 0,
            },
          }}
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
            <Tooltip title="Change owner">
              <IconButton aria-label="Change profile owner" onClick={() => onChangeOwner(profile)} sx={actionIconSx}>
                <ManageAccountsIcon />
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
            isLegacy ? (
              canManageLegacy ? (
                <Button disabled={isUpdatingStatus} startIcon={<LockOpenIcon />} onClick={() => onReopenProfile(profile)} variant="outlined">
                  Reopen
                </Button>
              ) : null
            ) : isDraft ? (
              <Button disabled={isUpdatingStatus} startIcon={<LockOpenIcon />} onClick={() => onReopenProfile(profile)} variant="outlined">
                Activate
              </Button>
            ) : isClosed ? (
              canRestore ? (
                <Button disabled={isUpdatingStatus} startIcon={<LockOpenIcon />} onClick={() => onReopenProfile(profile)} variant="outlined">
                  Reopen
                </Button>
              ) : null
            ) : (
              <>
                {canManageLegacy ? (
                  <Button disabled={isUpdatingStatus} startIcon={<HistoryIcon />} onClick={() => onMarkLegacy(profile)} variant="outlined">
                    Legacy
                  </Button>
                ) : null}
                <Button disabled={isUpdatingStatus} startIcon={<DraftsIcon />} onClick={() => onMarkDraft(profile)} variant="outlined">
                  Draft
                </Button>
                <Button color="warning" disabled={isUpdatingStatus} startIcon={<StopCircleIcon />} onClick={() => onCloseProfile(profile)} variant="outlined">
                  Close
                </Button>
              </>
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
  const dailyGoal = Number(progress.dailyGoal || 0);
  const dailyFinished = Number(progress.dailyFinished || 0);
  const dailyPercent = dailyGoal ? Math.min((dailyFinished / dailyGoal) * 100, 100) : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} useFlexGap sx={chipListSx}>
        <Chip label={`${tailored.toLocaleString()} tailored`} size="small" variant="outlined" sx={profileChipSx} />
        <Chip label={`${bids.toLocaleString()} bids`} size="small" variant="outlined" sx={profileChipSx} />
        <Chip label={`${done.toLocaleString()} done`} size="small" variant="outlined" sx={profileChipSx} />
        {planned ? <Chip label={`${planned.toLocaleString()} planned`} size="small" variant="outlined" sx={profileChipSx} /> : null}
        <Chip
          label={dailyGoal ? `${dailyFinished.toLocaleString()} / ${dailyGoal.toLocaleString()} today` : `${dailyFinished.toLocaleString()} today`}
          size="small"
          variant={dailyGoal ? 'filled' : 'outlined'}
          sx={{ ...profileChipSx, bgcolor: dailyGoal ? '#dbeafe' : undefined, color: dailyGoal ? '#1d4ed8' : undefined, fontWeight: 700 }}
        />
      </Stack>
      {dailyGoal ? (
        <LinearProgress
          variant="determinate"
          value={dailyPercent}
          sx={{
            height: 6,
            borderRadius: 1,
            bgcolor: '#e5e7eb',
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
              bgcolor: dailyFinished >= dailyGoal ? '#15803d' : '#1d4ed8',
            },
          }}
        />
      ) : null}
    </Box>
  );
}

const actionIconSx = {
  flex: '0 0 auto',
  width: 38,
  height: 38,
  border: 1,
  borderColor: 'divider',
};

const chipListSx = {
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  minWidth: 0,
  width: '100%',
};

const profileChipSx = {
  maxWidth: '100%',
  minWidth: 0,
  flexShrink: 1,
  height: 'auto',
  minHeight: 24,
  '& .MuiChip-label': {
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    textOverflow: 'clip',
    whiteSpace: 'normal',
  },
};
