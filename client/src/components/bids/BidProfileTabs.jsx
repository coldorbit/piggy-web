import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Chip, Paper, Tab, Tabs, Typography } from '@mui/material';
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
      ) : (
        <EmptyState
          title={isLoading ? 'Loading profiles...' : 'No profiles yet'}
          detail={isLoading ? '' : 'Profiles will appear here once they are active and available.'}
          variant="plain"
          sx={{ flex: 1, p: 1.5, justifyItems: 'start', textAlign: 'left', bgcolor: 'transparent' }}
        />
      )}
    </Paper>
  );
}

function openProfilePage(profile) {
  const url = new URL('/profiles', window.location.origin);
  url.searchParams.set('profileId', profile.id);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function ProfileTabLabel({ profile, onOpenProfilePage, showInterviewCounts }) {
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
      </Box>
    </Box>
  );
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
