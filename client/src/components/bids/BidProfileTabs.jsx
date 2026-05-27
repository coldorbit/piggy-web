import { Box, Chip, Paper, Tab, Tabs, Typography } from '@mui/material';
import { PROFILE_BADGE_COLORS, PROFILE_COLORS } from '../profiles/profileConstants.js';

export default function BidProfileTabs({ activeColor, activeProfile, isLoading, profiles, onProfileChange }) {
  return (
    <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, boxShadow: 1 }}>
      {profiles.length ? (
        <Tabs
          value={activeProfile ? String(activeProfile.id) : false}
          onChange={(_event, value) => onProfileChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            minWidth: 0,
            '& .MuiTabs-indicator': { backgroundColor: activeColor.main },
            '& .MuiTab-root': { minHeight: 58, py: 0.75, borderRadius: 2, mr: 0.5 },
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
        <Typography sx={{ flex: 1, color: 'text.secondary', px: 1 }}>
          {isLoading ? 'Loading profiles...' : 'No profiles yet.'}
        </Typography>
      )}
    </Paper>
  );
}

function ProfileTabLabel({ profile }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'center', minWidth: 0 }}>
      <Typography component="span" variant="body2" fontWeight={800} noWrap>
        {profile.name}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.5 }}>
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
