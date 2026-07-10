import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { Divider, IconButton, Paper, Stack, Typography } from '@mui/material';

export default function DiagramNavigationControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onPanLeft,
  onPanRight,
  onPanUp,
  onPanDown,
}) {
  return (
    <Paper
      role="toolbar"
      aria-label="Diagram navigation controls"
      elevation={3}
      onPointerDown={(event) => event.stopPropagation()}
      sx={{
        position: 'absolute',
        zIndex: 20,
        top: 12,
        right: 12,
        p: 0.5,
        maxWidth: 'calc(100% - 24px)',
        bgcolor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.25}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, whiteSpace: 'nowrap' }}>View only</Typography>
        <Divider orientation="vertical" flexItem />
        <IconButton size="small" aria-label="Zoom out" title="Zoom out" onClick={onZoomOut}><ZoomOutIcon fontSize="small" /></IconButton>
        <Typography variant="caption" aria-live="polite" sx={{ minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Typography>
        <IconButton size="small" aria-label="Zoom in" title="Zoom in" onClick={onZoomIn}><ZoomInIcon fontSize="small" /></IconButton>
        <IconButton size="small" aria-label="Fit diagram to view" title="Fit diagram to view" onClick={onReset}><CenterFocusStrongIcon fontSize="small" /></IconButton>
        <Divider orientation="vertical" flexItem />
        <IconButton size="small" aria-label="Move diagram left" title="Move diagram left" onClick={onPanLeft}><KeyboardArrowLeftIcon fontSize="small" /></IconButton>
        <Stack spacing={0}>
          <IconButton size="small" aria-label="Move diagram up" title="Move diagram up" onClick={onPanUp} sx={{ p: 0 }}><KeyboardArrowUpIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="Move diagram down" title="Move diagram down" onClick={onPanDown} sx={{ p: 0 }}><KeyboardArrowDownIcon fontSize="small" /></IconButton>
        </Stack>
        <IconButton size="small" aria-label="Move diagram right" title="Move diagram right" onClick={onPanRight}><KeyboardArrowRightIcon fontSize="small" /></IconButton>
      </Stack>
    </Paper>
  );
}
