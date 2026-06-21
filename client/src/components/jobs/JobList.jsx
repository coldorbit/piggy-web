import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Avatar, Box, ButtonBase, Checkbox, Chip, CircularProgress, IconButton, List, ListItem, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import Pagination from './Pagination.jsx';
import SpamBadge from './SpamBadge.jsx';
import JobRegionBadge from './JobRegionBadge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { formatDate } from '../../lib/formatters.js';
import { copyJobDescription, jobDescriptionText } from '../../lib/jobDescription.js';
import { jobSourceImageUrl } from '../../lib/jobSourceImage.js';
import JobIdBadge from './JobIdBadge.jsx';

const SOURCE_CHIP_STYLES = {
  builtin: { bgcolor: '#e8f2ff', color: '#174379' },
  'built in': { bgcolor: '#e8f2ff', color: '#174379' },
  diversityjobs: { bgcolor: '#fde9e5', color: '#8a2f1d' },
  hiringcafe: { bgcolor: '#fff1d6', color: '#70400d' },
  jobright: { bgcolor: '#e6f4ee', color: '#14583f' },
  linkedin: { bgcolor: '#e5f1fb', color: '#075b8f' },
  remotehunter: { bgcolor: '#edf0ff', color: '#343f91' },
  remoteyeah: { bgcolor: '#e2f6f5', color: '#17615e' },
  simplify: { bgcolor: '#f1eafb', color: '#4f357e' },
};

const SOURCE_CHIP_FALLBACK = { bgcolor: '#f3f5f7', color: '#303942' };

export default function JobList({
  filters,
  jobs,
  loading,
  selectedJob,
  selectedJobIds = new Set(),
  total,
  onPage,
  onPageSize,
  onSelectJob,
  onSelectedChange = () => {},
}) {
  return (
    <Paper
      variant="outlined"
      aria-busy={loading}
      sx={{
        position: 'relative',
        minHeight: 0,
        minWidth: 0,
        maxHeight: { lg: '100%' },
        overflow: 'hidden',
        boxShadow: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {loading && jobs.length ? <LoadingOverlay label="Loading jobs..." /> : null}
      {loading && !jobs.length ? <JobListSkeleton /> : null}
      {!loading && jobs.length === 0 ? (
        <EmptyState
          title="No jobs found"
          detail="Adjust the filters or import new jobs to refresh the list."
          variant="plain"
          sx={{ alignSelf: 'stretch' }}
        />
      ) : null}
      <List disablePadding sx={{ overflowY: 'auto', overflowX: 'hidden', flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
        {jobs.map((job) => {
          const selected = String(selectedJob?.id) === String(job.id);
          const checked = selectedJobIds.has(String(job.id));
          const isLinkedInJob = String(job.source || '').trim().toLowerCase() === 'linkedin';
          return (
            <ListItem key={job.id} disablePadding divider sx={{ minWidth: 0, borderColor: 'divider' }}>
              <Box
                sx={{
                  width: '100%',
                  minWidth: 0,
                  minHeight: 64,
                  display: 'grid',
                  gridTemplateColumns: '34px minmax(0, 1fr)',
                  alignItems: 'stretch',
                  borderLeft: 4,
                  borderColor: selected ? 'primary.main' : 'transparent',
                  bgcolor: selected ? '#EFF6FF' : 'transparent',
                  transition: 'background-color 150ms ease, border-color 150ms ease',
                  '&:hover': { bgcolor: selected ? '#DBEAFE' : '#F8FAFC' },
                }}
              >
                <Box sx={{ display: 'grid', placeItems: 'center' }}>
                  <Checkbox
                    checked={checked}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => onSelectedChange(job.id)}
                    inputProps={{ 'aria-label': `Select ${job.title || 'job'}` }}
                    size="small"
                    sx={{ p: 0.5 }}
                  />
                </Box>
                <ButtonBase
                  component="div"
                  onClick={() => onSelectJob(job.id)}
                  sx={{
                    width: '100%',
                    minWidth: 0,
                    minHeight: 64,
                    px: 1.1,
                    py: 0.85,
                    justifyContent: 'stretch',
                    textAlign: 'left',
                  }}
                >
                <Box
                  sx={{
                    width: '100%',
                    minWidth: 0,
                    display: 'grid',
                    gridTemplateColumns: job.companyLogoUrl ? '36px minmax(0, 1fr) max-content' : 'minmax(0, 1fr) max-content',
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  {job.companyLogoUrl ? <CompanyLogo job={job} /> : null}
                  <Box minWidth={0}>
                    <Typography fontWeight={900} variant="body2" noWrap>
                      {job.title || 'Untitled role'}
                    </Typography>
                    <Typography color="text.secondary" variant="caption" noWrap>
                      {job.company ? (
                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                          {job.company}
                        </Box>
                      ) : (
                        'Unknown company'
                      )}
                      {job.locationOptions?.length > 1 ? ` · ${job.locationOptions[0]?.locationLabel || job.location || 'Multiple locations'}` : job.location ? ` · ${job.location}` : null}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      minWidth: 96,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      display: 'grid',
                      gap: 0.15,
                      justifyItems: 'end',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, minWidth: 0, overflow: 'hidden' }}>
                      <JobIdBadge job={job} />
                      <Tooltip title="Copy description">
                        <span>
                          <IconButton
                            size="small"
                            disabled={!jobDescriptionText(job)}
                            sx={{ width: 28, height: 28 }}
                            onClick={(event) => {
                              event.stopPropagation();
                              copyJobDescription(job);
                            }}
                            aria-label="Copy job description"
                          >
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {job.isManual ? <ManualJobBadge /> : null}
                      <JobRegionBadge job={job} />
                      {job.locationOptions?.length > 1 ? <LocationCountBadge count={job.locationOptions.length} /> : null}
                      <SpamBadge job={job} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, minWidth: 0, overflow: 'hidden' }}>
                      {job.source ? <SourceBadge isManual={job.isManual} source={job.source} sourceUrl={job.sourceUrl} /> : null}
                      {job.applyMode && !isLinkedInJob ? <ApplyModeBadge applyMode={job.applyMode} /> : null}
                      <Typography color="text.secondary" variant="caption" fontWeight={700} noWrap>
                        {formatDate(job.postedAt || job.scrapedAt)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                </ButtonBase>
              </Box>
            </ListItem>
          );
        })}
      </List>
      <Pagination filters={filters} total={total} onPage={onPage} onPageSize={onPageSize} />
    </Paper>
  );
}

function LocationCountBadge({ count }) {
  return (
    <Chip
      label={`${count} locations`}
      size="small"
      sx={{
        height: 20,
        bgcolor: '#F0FDFA',
        color: '#115E59',
        fontSize: 11,
        fontWeight: 900,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

function ManualJobBadge() {
  return (
    <Chip
      label="Manual"
      size="small"
      sx={{
        height: 20,
        bgcolor: '#ECFDF5',
        color: '#0F766E',
        fontSize: 11,
        fontWeight: 900,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

function ApplyModeBadge({ applyMode }) {
  return (
    <Chip
      label={applyMode}
      size="small"
      sx={{
        height: 20,
        maxWidth: 148,
        bgcolor: '#f8e0e7',
        color: '#7c263a',
        fontSize: 11,
        fontWeight: 800,
        '& .MuiChip-label': {
          px: 0.75,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }}
    />
  );
}

function SourceBadge({ isManual, source, sourceUrl }) {
  const logoUrl = jobSourceImageUrl({ isManual, source, sourceUrl, size: 32 });

  return (
    <Chip
      avatar={<Avatar alt={`${source} logo`} src={logoUrl}>{sourceInitial(source)}</Avatar>}
      label={source}
      size="small"
      sx={{
        ...(SOURCE_CHIP_STYLES[String(source).toLowerCase()] || SOURCE_CHIP_FALLBACK),
        height: 20,
        maxWidth: 112,
        fontSize: 11,
        fontWeight: 800,
        '& .MuiChip-label': {
          px: 0.75,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        '& .MuiChip-avatar': {
          width: 16,
          height: 16,
          ml: 0.55,
          mr: -0.35,
          bgcolor: 'background.paper',
          color: 'inherit',
          fontSize: 9,
          fontWeight: 900,
        },
      }}
    />
  );
}

function sourceInitial(source) {
  return String(source || '?').trim().charAt(0).toUpperCase();
}

function CompanyLogo({ job }) {
  return (
    <Avatar
      alt={`${job.company || 'Company'} logo`}
      src={job.companyLogoUrl}
      variant="rounded"
      imgProps={{ referrerPolicy: 'no-referrer', loading: 'lazy' }}
      sx={{
        width: 36,
        height: 36,
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        color: 'text.secondary',
        fontSize: 13,
        fontWeight: 900,
      }}
    >
      {(job.company || job.title || '?').trim().charAt(0).toUpperCase()}
    </Avatar>
  );
}

function JobListSkeleton() {
  return (
    <List disablePadding aria-hidden="true" sx={{ overflow: 'hidden', flex: '1 1 auto' }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <ListItem key={`job-loading-${index}`} disablePadding divider sx={{ minHeight: 64, px: 1.1, py: 0.85 }}>
          <Box
            sx={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '36px minmax(0, 1fr) max-content',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <Skeleton variant="rounded" width={36} height={36} />
            <Box sx={{ minWidth: 0 }}>
              <Skeleton width="62%" />
              <Skeleton width="42%" />
            </Box>
            <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'end' }}>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Skeleton variant="rounded" width={54} height={20} />
                <Skeleton variant="rounded" width={68} height={20} />
                <Skeleton variant="rounded" width={42} height={20} />
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Skeleton variant="rounded" width={76} height={20} />
                <Skeleton width={56} />
              </Box>
            </Box>
          </Box>
        </ListItem>
      ))}
    </List>
  );
}

function LoadingOverlay({ label }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'rgba(255, 255, 255, 0.62)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <Box sx={{ display: 'grid', placeItems: 'center', gap: 1 }}>
        <CircularProgress size={30} />
        <Typography color="text.secondary" variant="body2">
          {label}
        </Typography>
      </Box>
    </Box>
  );
}
