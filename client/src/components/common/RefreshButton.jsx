import RefreshIcon from '@mui/icons-material/Refresh';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';

export default function RefreshButton({
  isRefreshing = false,
  label = 'Refresh',
  lastUpdatedAt = null,
  onRefresh,
  sx,
}) {
  const updatedLabel = formatUpdatedLabel(lastUpdatedAt);

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="flex-end"
      sx={{ minWidth: 0, ...sx }}
    >
      {updatedLabel ? (
        <Typography variant="caption" color="text.secondary" noWrap>
          {updatedLabel}
        </Typography>
      ) : null}
      <Button
        type="button"
        size="small"
        variant="outlined"
        onClick={onRefresh}
        disabled={isRefreshing}
        startIcon={
          isRefreshing ? <CircularProgress color="inherit" size={14} /> : <RefreshIcon fontSize="small" />
        }
        sx={{ minHeight: 36, whiteSpace: 'nowrap' }}
      >
        {label}
      </Button>
    </Stack>
  );
}

function formatUpdatedLabel(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `Updated ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
