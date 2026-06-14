import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Chip, LinearProgress, Paper, Skeleton, Tab, Tabs, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import EmptyState from '../common/EmptyState.jsx';
import { PROFILE_BADGE_COLORS, PROFILE_COLORS } from '../profiles/profileConstants.js';

export default function BidProfileTabs({ activeColor, activeProfile, isLoading, profiles, onProfileChange, showInterviewCounts = false }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        overflow: 'hidden',
        boxShadow: 1,
        alignSelf: 'stretch',
        height: { xs: 'auto', md: '100%' },
        minHeight: 0,
      }}
    >
      <Box sx={{ px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
          Profiles
        </Typography>
      </Box>
      {profiles.length ? (
        <Tabs
          orientation={isDesktop ? 'vertical' : 'horizontal'}
          value={activeProfile ? String(activeProfile.id) : false}
          onChange={(_event, value) => onProfileChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            bgcolor: 'rgba(255, 255, 255, 0.72)',
            '& .MuiTabs-indicator': { backgroundColor: activeColor.main },
            '& .MuiTabs-scroller': {
              overflowY: { md: 'auto !important' },
            },
            '& .MuiTabs-flexContainer': {
              alignItems: 'stretch',
            },
            '& .MuiTab-root': {
              minHeight: 64,
              alignItems: isDesktop ? 'stretch' : 'center',
              borderRadius: 0,
              borderBottom: isDesktop ? 1 : 0,
              borderRight: isDesktop ? 0 : 1,
              borderColor: 'divider',
              px: 1.25,
              py: 1,
            },
          }}
        >
          {profiles.map((profile) => {
            const color = PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green;
            return (
              <Tab
                key={profile.id}
                value={String(profile.id)}
                label={<ProfileTabLabel profile={profile} showInterviewCounts={showInterviewCounts} onOpenProfilePage={openProfilePage} />}
                sx={{
                  color: color.dark,
                  fontWeight: 800,
                  textAlign: 'left',
                  '&.Mui-selected': {
                    color: color.dark,
                    backgroundColor: color.soft,
                  },
                }}
              />
            );
          })}
        </Tabs>
      ) : isLoading ? (
        <ProfileTabSkeletons />
      ) : (
        <EmptyState
          title="No profiles yet"
          detail="Profiles will appear here once they are active and available."
          variant="plain"
          sx={{ flex: 1, p: 1.5, justifyItems: 'start', textAlign: 'left', bgcolor: 'transparent' }}
        />
      )}
    </Paper>
  );
}

function ProfileTabSkeletons() {
  return (
    <Box sx={{ display: 'grid', alignContent: 'start' }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Box key={`profile-tab-loading-${index}`} sx={{ minHeight: 64, px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Skeleton width="72%" />
          <Skeleton width="46%" />
        </Box>
      ))}
    </Box>
  );
}

function openProfilePage(profile) {
  const url = new URL('/profiles', window.location.origin);
  url.searchParams.set('profileId', profile.id);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function ProfileTabLabel({ profile, onOpenProfilePage, showInterviewCounts }) {
  const dailyGoal = profileDailyGoal(profile);

  function handleOpen(event) {
    event.preventDefault();
    event.stopPropagation();
    onOpenProfilePage(profile);
  }

  return (
    <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'stretch', minWidth: 0, width: '100%' }}>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, width: '100%' }}>
        <Typography component="span" variant="body2" fontWeight={800} noWrap sx={{ flex: 1, minWidth: 0 }}>
          {profile.name}
        </Typography>
        <Box
          component="span"
          role="button"
          tabIndex={0}
          aria-label={`Open ${profile.name || 'profile'} profile page in a new window`}
          title="Open profile page"
          onClick={handleOpen}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            handleOpen(event);
          }}
          sx={openProfileIconSx}
        >
          <OpenInNewIcon />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 0.5 }}>
        {profile.isShared ? (
          <Chip
            label="Shared"
            size="small"
            color="secondary"
            sx={{ height: 20, fontSize: 11, fontWeight: 800, '& .MuiChip-label': { px: 0.75 } }}
          />
        ) : null}
        {profile.profileStatus === 'legacy' ? (
          <Chip
            label="Legacy"
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: 11, fontWeight: 800, bgcolor: '#f3f4f6', color: '#4b5563', '& .MuiChip-label': { px: 0.75 } }}
          />
        ) : null}
        <Chip
          label={profile.profileBadge || 'SWE'}
          size="small"
          sx={{
            ...(PROFILE_BADGE_COLORS[profile.profileBadge || 'SWE'] || {}),
            height: 20,
            fontSize: 11,
            fontWeight: 800,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
        {showInterviewCounts ? (
          <>
            <Chip
              label={`${Number(profile.progress?.totalInterviews || 0).toLocaleString()} total`}
              size="small"
              sx={{ height: 20, fontSize: 11, fontWeight: 800, bgcolor: '#EFF6FF', color: '#1D4ED8', '& .MuiChip-label': { px: 0.75 } }}
            />
            <Chip
              label={`${Number(profile.progress?.activeInterviews || 0).toLocaleString()} active`}
              size="small"
              sx={{ height: 20, fontSize: 11, fontWeight: 800, bgcolor: '#ECFDF5', color: '#0F766E', '& .MuiChip-label': { px: 0.75 } }}
            />
          </>
        ) : null}
        {dailyGoal ? (
          <Chip
            label={`${dailyGoal.finished.toLocaleString()} / ${dailyGoal.goal.toLocaleString()} today`}
            size="small"
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 900,
              bgcolor: dailyGoal.bgcolor,
              color: dailyGoal.color,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        ) : null}
      </Box>
      {dailyGoal ? (
        <LinearProgress
          variant="determinate"
          value={dailyGoal.percent}
          sx={{
            height: 4,
            borderRadius: 1,
            bgcolor: '#e5e7eb',
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
              bgcolor: dailyGoal.color,
            },
          }}
        />
      ) : null}
    </Box>
  );
}

function profileDailyGoal(profile) {
  const goal = Number(profile?.progress?.dailyGoal || 0);
  if (!goal) return null;

  const finished = Number(profile?.progress?.dailyFinished || 0);
  const percent = Math.min((finished / goal) * 100, 100);
  const isComplete = finished >= goal;
  const isOnTrack = isComplete || percent + 2 >= dayProgressPercent();
  if (isComplete) return { goal, finished, percent, color: '#15803d', bgcolor: '#dcfce7' };
  if (isOnTrack) return { goal, finished, percent, color: '#1d4ed8', bgcolor: '#dbeafe' };
  return { goal, finished, percent, color: '#b45309', bgcolor: '#ffedd5' };
}

function dayProgressPercent(value = new Date()) {
  const minutes = value.getHours() * 60 + value.getMinutes();
  return (minutes / (24 * 60)) * 100;
}

const openProfileIconSx = {
  width: 20,
  height: 20,
  borderRadius: 0.75,
  color: 'text.secondary',
  display: 'inline-grid',
  flexShrink: 0,
  placeItems: 'center',
  '&:hover': {
    bgcolor: 'action.hover',
    color: 'primary.main',
  },
  '&:focus-visible': {
    outline: '2px solid currentColor',
    outlineOffset: 1,
  },
  '& .MuiSvgIcon-root': {
    fontSize: 14,
  },
};
