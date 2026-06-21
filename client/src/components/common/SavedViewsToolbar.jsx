import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import TuneIcon from '@mui/icons-material/Tune';
import { Box, Button, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Tooltip, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { createSavedViewId, readSavedViews, writeSavedViews } from '../../lib/persistedFilters.js';

export default function SavedViewsToolbar({
  currentView,
  defaultViews = [],
  helperText = 'Save the filters operators rebuild most often.',
  onApplyView,
  storageKey,
  title = 'Saved views',
}) {
  const normalizedDefaults = useMemo(
    () => defaultViews.map((view) => ({ ...view, isDefault: true })),
    [defaultViews],
  );
  const [views, setViews] = useState(() => readSavedViews(storageKey, normalizedDefaults));
  const [selectedViewId, setSelectedViewId] = useState('');
  const selectedView = views.find((view) => view.id === selectedViewId) || null;

  function applyView(viewId) {
    const view = views.find((item) => item.id === viewId);
    setSelectedViewId(viewId);
    if (view) onApplyView(view.payload);
  }

  function saveCurrentView() {
    const label = window.prompt('Name this saved view');
    const trimmedLabel = String(label || '').trim();
    if (!trimmedLabel) return;
    const nextView = {
      id: createSavedViewId(trimmedLabel),
      label: trimmedLabel,
      payload: currentView,
      createdAt: new Date().toISOString(),
    };
    const nextViews = [...views, nextView];
    setViews(nextViews);
    setSelectedViewId(nextView.id);
    writeSavedViews(storageKey, nextViews, normalizedDefaults);
  }

  function deleteSelectedView() {
    if (!selectedView || selectedView.isDefault) return;
    const nextViews = views.filter((view) => view.id !== selectedView.id);
    setViews(nextViews);
    setSelectedViewId('');
    writeSavedViews(storageKey, nextViews, normalizedDefaults);
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.25,
        py: 1,
        borderRadius: 1,
        boxShadow: 1,
        bgcolor: '#ffffff',
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' }, gap: 1, alignItems: 'center' }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <TuneIcon fontSize="small" color="primary" />
            <Typography fontWeight={900}>{title}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {helperText}
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
            <InputLabel>View</InputLabel>
            <Select label="View" value={selectedViewId} onChange={(event) => applyView(event.target.value)} displayEmpty>
              <MenuItem value="">
                <Typography color="text.secondary">Choose saved view</Typography>
              </MenuItem>
              {views.map((view) => (
                <MenuItem key={view.id} value={view.id}>
                  {view.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button startIcon={<BookmarkAddIcon />} variant="outlined" size="small" onClick={saveCurrentView} sx={{ minHeight: 36, whiteSpace: 'nowrap' }}>
            Save current
          </Button>
          <Tooltip title={selectedView?.isDefault ? 'Default views cannot be deleted' : 'Delete selected saved view'}>
            <Box component="span" sx={{ display: 'inline-flex', justifyContent: { xs: 'stretch', sm: 'center' } }}>
              <IconButton
                aria-label="Delete saved view"
                disabled={!selectedView || selectedView.isDefault}
                onClick={deleteSelectedView}
                sx={{
                  width: { xs: '100%', sm: 36 },
                  height: 36,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Tooltip>
        </Stack>
      </Box>
    </Paper>
  );
}
