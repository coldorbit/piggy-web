import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined';
import { Box } from '@mui/material';

export default function LowAttentionCallMarker() {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{ alignItems: 'center', display: 'inline-flex', flexShrink: 0, fontSize: 10, fontWeight: 600, gap: 0.25, lineHeight: 1 }}
    >
      <DoNotDisturbOnOutlinedIcon sx={{ fontSize: 12 }} />
      Lost
    </Box>
  );
}
