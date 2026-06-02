import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Chip } from '@mui/material';

export default function BidderMetricChip({ label }) {
  return (
    <Chip
      icon={<TrendingUpIcon />}
      label={label}
      size="small"
      sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 900, '& .MuiChip-icon': { color: '#1D4ED8' } }}
    />
  );
}
