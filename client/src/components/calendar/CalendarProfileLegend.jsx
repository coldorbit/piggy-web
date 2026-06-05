import { Box, Chip } from '@mui/material';
import { PROFILE_COLORS } from '../profiles/profileConstants.js';

export default function CalendarProfileLegend({ profiles }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', minHeight: 32 }}>
      {profiles.slice(0, 10).map((profile) => {
        const color = PROFILE_COLORS[profile.colorScheme] || PROFILE_COLORS.green;
        return (
          <Chip
            key={profile.id}
            label={profile.name}
            size="small"
            sx={{
              bgcolor: color.soft,
              color: color.dark,
              border: 1,
              borderColor: color.main,
              maxWidth: 180,
              '& .MuiChip-label': {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }}
          />
        );
      })}
    </Box>
  );
}
