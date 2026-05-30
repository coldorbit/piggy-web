import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
} from '@mui/material';

export default function JobFiltersToolbar({ filters, meta, onFilterChange, onRefresh, variant = 'paper', ariaLabel = 'Job filters' }) {
  const content = (
    <>
      <TextField
        size="small"
        placeholder="Search title, company, location"
        value={filters.search}
        onChange={(event) => onFilterChange('search', event.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <FormControl size="small">
        <InputLabel>Role</InputLabel>
        <Select label="Role" value={filters.roleFamily || 'all'} onChange={(event) => onFilterChange('roleFamily', event.target.value)}>
          <MenuItem value="all">All roles</MenuItem>
          <MenuItem value="software">Software engineering</MenuItem>
          <MenuItem value="data">Data engineering</MenuItem>
          <MenuItem value="ai_ml">AI/ML</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small">
        <InputLabel>Source</InputLabel>
        <Select label="Source" value={filters.source} onChange={(event) => onFilterChange('source', event.target.value)}>
          <MenuItem value="all">All sources</MenuItem>
          {(meta?.sources || []).map((source) => (
            <MenuItem key={source.source} value={source.source}>
              {source.source} ({source.count})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small">
        <InputLabel>Age</InputLabel>
        <Select label="Age" value={filters.since} onChange={(event) => onFilterChange('since', event.target.value)}>
          <MenuItem value="24h">Last 24 hours</MenuItem>
          <MenuItem value="3d">Last 3 days</MenuItem>
          <MenuItem value="7d">Last 7 days</MenuItem>
          <MenuItem value="30d">Last 30 days</MenuItem>
          <MenuItem value="all">All time</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small">
        <InputLabel>Review</InputLabel>
        <Select label="Review" value={filters.spam} onChange={(event) => onFilterChange('spam', event.target.value)}>
          <MenuItem value="all">All reviews</MenuItem>
          <MenuItem value="unreviewed">Unreviewed</MenuItem>
          <MenuItem value="not_spam">Not spam</MenuItem>
          <MenuItem value="spam">Spam</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small">
        <InputLabel>Visibility</InputLabel>
        <Select label="Visibility" value={filters.visibility || 'visible'} onChange={(event) => onFilterChange('visibility', event.target.value)}>
          <MenuItem value="visible">Visible</MenuItem>
          <MenuItem value="hidden">Hidden</MenuItem>
          <MenuItem value="all">All jobs</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small">
        <InputLabel>Sort</InputLabel>
        <Select label="Sort" value={filters.sort} onChange={(event) => onFilterChange('sort', event.target.value)}>
          <MenuItem value="scraped_desc">Newest scraped</MenuItem>
          <MenuItem value="posted_desc">Newest posted</MenuItem>
          <MenuItem value="title_asc">Title A-Z</MenuItem>
        </Select>
      </FormControl>
      <Tooltip title="Refresh jobs">
        <IconButton
          type="button"
          onClick={onRefresh}
          aria-label="Refresh jobs"
          sx={{
            justifySelf: variant === 'panel' ? 'end' : { lg: 'end' },
            width: 38,
            height: 38,
            border: 1,
            borderColor: 'primary.main',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              bgcolor: 'primary.dark',
              borderColor: 'primary.dark',
            },
          }}
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </>
  );

  const sx = {
    display: 'grid',
    gridTemplateColumns:
      variant === 'panel'
        ? '1fr'
        : {
            xs: '1fr',
            lg: 'minmax(220px, 1fr) 200px 180px 140px 140px 140px 150px auto',
          },
    gap: 1,
    alignItems: variant === 'panel' ? 'stretch' : 'center',
    '& .MuiInputBase-root': {
      bgcolor: 'background.paper',
    },
    '& .MuiFormControl-root, & .MuiTextField-root': {
      minWidth: 0,
    },
    '& .MuiOutlinedInput-root': {
      minHeight: 40,
    },
  };

  if (variant === 'inline' || variant === 'panel') {
    return (
      <Box component="section" aria-label={ariaLabel} sx={sx}>
        {content}
      </Box>
    );
  }

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label={ariaLabel}
      sx={{ p: 1.25, boxShadow: 1, ...sx }}
    >
      {content}
    </Paper>
  );
}
