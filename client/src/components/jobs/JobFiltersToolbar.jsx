import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tooltip,
} from '@mui/material';

export default function JobFiltersToolbar({ filters, meta, onFilterChange, onRefresh, variant = 'paper', ariaLabel = 'Job filters' }) {
  const appliedProfiles = meta?.appliedProfiles || [];
  const showAppliedProfileFilter = Boolean(meta?.showAppliedProfileFilter);
  const appliedProfileValue = appliedProfiles.some((profile) => String(profile.id) === String(filters.appliedProfileId))
    ? String(filters.appliedProfileId)
    : 'all';
  const content = (
    <>
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
      {showAppliedProfileFilter && appliedProfiles.length ? (
        <FormControl
          size="small"
          sx={{
            '& .MuiInputLabel-root': {
              color: '#b91c1c',
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: '#b91c1c',
            },
            '& .MuiOutlinedInput-root': {
              bgcolor: '#fff1f2',
              '& fieldset': {
                borderColor: '#ef4444',
                borderWidth: 2,
              },
              '&:hover fieldset': {
                borderColor: '#dc2626',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#b91c1c',
                borderWidth: 2,
              },
            },
            '& .MuiSelect-icon': {
              color: '#b91c1c',
            },
          }}
        >
          <InputLabel>Applied using</InputLabel>
          <Select
            label="Applied using"
            value={appliedProfileValue}
            onChange={(event) => onFilterChange('appliedProfileId', event.target.value)}
          >
            <MenuItem value="all">None</MenuItem>
            {appliedProfiles.map((profile) => (
              <MenuItem key={profile.id} value={String(profile.id)}>
                {profile.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}
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
        <InputLabel>Origin</InputLabel>
        <Select label="Origin" value={filters.origin || 'all'} onChange={(event) => onFilterChange('origin', event.target.value)}>
          <MenuItem value="all">Manual & scraped</MenuItem>
          <MenuItem value="manual">Manual jobs</MenuItem>
          <MenuItem value="scraped">Scraped jobs</MenuItem>
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
            lg: showAppliedProfileFilter && appliedProfiles.length
              ? '150px 150px 130px 130px 130px 130px 140px auto'
              : '170px 160px 130px 130px 130px 150px auto',
          },
    gap: variant === 'panel' ? 1.25 : 1,
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
