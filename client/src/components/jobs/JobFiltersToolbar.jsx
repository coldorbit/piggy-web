import RefreshIcon from '@mui/icons-material/Refresh';
import { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  Avatar,
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
} from '@mui/material';
import { jobSourceImageUrl } from '../../lib/jobSourceImage.js';

const DATE_PRESETS = new Set(['today', 'yesterday', 'this_week', 'last_week', 'all', 'custom']);

export default function JobFiltersToolbar({ filters, meta, onFilterChange, onRefresh, variant = 'paper', ariaLabel = 'Job filters' }) {
  const appliedProfiles = meta?.appliedProfiles || [];
  const sourceOptions = meta?.sources || [];
  const showAppliedProfileFilter = Boolean(meta?.showAppliedProfileFilter);
  const appliedProfileValue = appliedProfiles.some((profile) => String(profile.id) === String(filters.appliedProfileId))
    ? String(filters.appliedProfileId)
    : 'all';
  const sinceValue = DATE_PRESETS.has(filters.since) ? filters.since : 'today';
  const customRangeStart = parseDateOnly(filters.dateFrom);
  const customRangeEnd = parseDateOnly(filters.dateTo);

  function updateSince(value) {
    onFilterChange('since', value);
    if (value !== 'custom') {
      onFilterChange('dateFrom', '');
      onFilterChange('dateTo', '');
    }
  }

  function updateCustomRange([start, end]) {
    onFilterChange('dateFrom', formatDateOnly(start));
    onFilterChange('dateTo', formatDateOnly(end));
  }

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
        <Select
          label="Source"
          value={filters.source}
          onChange={(event) => onFilterChange('source', event.target.value)}
          renderValue={(value) => {
            if (value === 'all') return 'All sources';
            return <SourceOption source={value} compact />;
          }}
        >
          <MenuItem value="all">All sources</MenuItem>
          {sourceOptions.map((source) => (
            <MenuItem key={source.source} value={source.source}>
              <SourceOption source={source.source} count={source.count} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small">
        <InputLabel>Location</InputLabel>
        <Select label="Location" value={filters.locationRegion || 'all'} onChange={(event) => onFilterChange('locationRegion', event.target.value)}>
          <MenuItem value="all">All locations</MenuItem>
          <MenuItem value="canada">Canada</MenuItem>
          <MenuItem value="us_worldwide">US/Worldwide</MenuItem>
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
        <InputLabel>Date</InputLabel>
        <Select label="Date" value={sinceValue} onChange={(event) => updateSince(event.target.value)}>
          <MenuItem value="today">Today</MenuItem>
          <MenuItem value="yesterday">Yesterday</MenuItem>
          <MenuItem value="this_week">This week</MenuItem>
          <MenuItem value="last_week">Last week</MenuItem>
          <MenuItem value="all">All time</MenuItem>
          <MenuItem value="custom">Custom range</MenuItem>
        </Select>
      </FormControl>
      {sinceValue === 'custom' ? (
        <DatePicker
          selected={customRangeStart}
          startDate={customRangeStart}
          endDate={customRangeEnd}
          onChange={updateCustomRange}
          selectsRange
          isClearable
          dateFormat="MMM d, yyyy"
          maxDate={new Date()}
          popperClassName="job-date-range-picker"
          customInput={<DateRangeInput />}
        />
      ) : null}
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
              ? `145px 145px 145px 130px 130px ${sinceValue === 'custom' ? '210px ' : ''}130px 130px 130px 140px auto`
              : `155px 150px 145px 130px ${sinceValue === 'custom' ? '210px ' : ''}130px 130px 130px 140px auto`,
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
    '& .react-datepicker-wrapper, & .react-datepicker__input-container': {
      display: 'block',
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

const DateRangeInput = forwardRef(function DateRangeInput({ value, onClick, onChange }, ref) {
  return (
    <TextField
      inputRef={ref}
      label="Range"
      value={value || ''}
      onClick={onClick}
      onChange={onChange}
      size="small"
      fullWidth
    />
  );
});

function SourceOption({ source, count, compact = false }) {
  const logoUrl = jobSourceImageUrl({
    isManual: String(source || '').trim().toLowerCase() === 'manual',
    source,
    size: 32,
  });

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Avatar
        alt={`${source} logo`}
        src={logoUrl}
        sx={{
          width: compact ? 18 : 20,
          height: compact ? 18 : 20,
          bgcolor: 'background.paper',
          color: 'text.secondary',
          fontSize: 10,
          fontWeight: 900,
          border: 1,
          borderColor: 'divider',
          flex: '0 0 auto',
        }}
      >
        {sourceInitial(source)}
      </Avatar>
      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {source}
        {count === undefined ? null : ` (${count})`}
      </Box>
    </Box>
  );
}

function sourceInitial(source) {
  return String(source || '?').trim().charAt(0).toUpperCase();
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value) {
  if (!value) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
