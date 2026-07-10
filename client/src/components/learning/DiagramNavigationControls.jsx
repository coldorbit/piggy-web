import AddIcon from '@mui/icons-material/Add';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RemoveIcon from '@mui/icons-material/Remove';
import { ButtonBase, IconButton, Paper, Stack } from '@mui/material';

const controlButtonSx = {
  width: 32,
  height: 32,
  p: 0,
  borderRadius: 1,
  color: '#1f1f24',
  '&:hover': { bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.14)' },
  '&:focus-visible': { outline: '2px solid #6965db', outlineOffset: 1 },
};

export default function DiagramNavigationControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
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
      elevation={0}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      sx={{
        position: 'absolute',
        zIndex: 20,
        bottom: 12,
        left: 12,
        p: 0.375,
        maxWidth: 'calc(100% - 24px)',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: 2,
        bgcolor: 'rgba(255, 255, 255, 0.98)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.14)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Stack direction="row" alignItems="center" spacing={0.125} sx={{ p: 0.25, borderRadius: 1.5, bgcolor: '#f1f1f3' }}>
          <IconButton size="small" aria-label="Zoom out" title="Zoom out" onClick={onZoomOut} sx={controlButtonSx}><RemoveIcon fontSize="small" /></IconButton>
          <ButtonBase
            aria-label={`Reset zoom, currently ${Math.round(zoom * 100)} percent`}
            title="Reset zoom"
            onClick={onResetZoom}
            sx={{ ...controlButtonSx, width: 'auto', minWidth: 46, px: 0.5, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          </ButtonBase>
          <IconButton size="small" aria-label="Zoom in" title="Zoom in" onClick={onZoomIn} sx={controlButtonSx}><AddIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="Fit diagram to view" title="Fit diagram to view" onClick={onReset} sx={controlButtonSx}><CenterFocusStrongIcon fontSize="small" /></IconButton>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.125} sx={{ p: 0.25, borderRadius: 1.5, bgcolor: '#f1f1f3' }}>
          <IconButton size="small" aria-label="Move diagram left" title="Move diagram left" onClick={onPanLeft} sx={controlButtonSx}><KeyboardArrowLeftIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="Move diagram up" title="Move diagram up" onClick={onPanUp} sx={controlButtonSx}><KeyboardArrowUpIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="Move diagram down" title="Move diagram down" onClick={onPanDown} sx={controlButtonSx}><KeyboardArrowDownIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="Move diagram right" title="Move diagram right" onClick={onPanRight} sx={controlButtonSx}><KeyboardArrowRightIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>
    </Paper>
  );
}
