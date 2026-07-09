import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Chip } from '@mui/material';

export default function BidderMetricChip({ label }) {
  return (
    <Chip
      icon={<TrendingUpIcon />}
      label={label}
      size="small"
      sx={{ bgcolor: 'rgba(0, 103, 192, 0.10)', color: '#005A9E', fontWeight: 900, '& .MuiChip-icon': { color: '#005A9E' } }}
    />
  );
}
