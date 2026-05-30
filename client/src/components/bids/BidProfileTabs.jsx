import { Box, Chip, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { PROFILE_BADGE_COLORS, PROFILE_COLORS } from '../profiles/profileConstants.js';

export default function BidProfileTabs({ activeColor, activeProfile, isLoading, profiles, onProfileChange }) {
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
                label={<ProfileTabLabel profile={profile} />}
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
        <Typography sx={{ flex: 1, color: 'text.secondary', px: 1.25, py: 1.5 }}>
          {isLoading ? 'Loading profiles...' : 'No profiles yet.'}
        </Typography>
      )}
    </Paper>
  );
}

function ProfileTabLabel({ profile }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'start', minWidth: 0, width: '100%' }}>
      <Typography component="span" variant="body2" fontWeight={800} noWrap>
        {profile.name}
      </Typography>
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
      </Box>
    </Box>
  );
}
