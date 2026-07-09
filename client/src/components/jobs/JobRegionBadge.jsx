import { Chip } from '@mui/material';
import { jobRegion } from '../../lib/jobRegion.js';

export default function JobRegionBadge({ job, sx }) {
  const region = jobRegion(job);
  if (!region) return null;

  return (
    <Chip
      label={region.label}
      size="small"
      sx={{
        height: 20,
        bgcolor: region.bgcolor,
        color: region.color,
        fontSize: 11,
        fontWeight: 600,
        '& .MuiChip-label': { px: 0.75 },
        ...sx,
      }}
    />
  );
}
