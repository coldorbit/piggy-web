import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Avatar, Box, ButtonBase, CircularProgress, IconButton, List, ListItem, Paper, Tooltip, Typography } from '@mui/material';
import Pagination from './Pagination.jsx';
import SpamBadge from './SpamBadge.jsx';
import { formatDate } from '../../lib/formatters.js';
import { copyJobDescription, jobDescriptionText } from '../../lib/jobDescription.js';

export default function JobList({ filters, jobs, loading, selectedJob, total, onPage, onPageSize, onSelectJob }) {
  return (
    <Paper
      variant="outlined"
      aria-busy={loading}
      sx={{
        position: 'relative',
        minHeight: 0,
        maxHeight: { lg: '100%' },
        overflow: 'hidden',
        boxShadow: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {loading && jobs.length ? <LoadingOverlay label="Loading jobs..." /> : null}
      {loading && !jobs.length ? <LoadingState label="Loading jobs..." /> : null}
      {!loading && jobs.length === 0 ? <EmptyState>No jobs match the current filters.</EmptyState> : null}
      <List disablePadding sx={{ overflow: 'auto', flex: '0 1 auto' }}>
        {jobs.map((job) => {
          const selected = String(selectedJob?.id) === String(job.id);
          return (
            <ListItem key={job.id} disablePadding divider sx={{ borderColor: 'divider' }}>
              <ButtonBase
                component="div"
                onClick={() => onSelectJob(job.id)}
                sx={{
                  width: '100%',
                  minHeight: 64,
                  px: 1.1,
                  py: 0.85,
                  justifyContent: 'stretch',
                  textAlign: 'left',
                  borderLeft: 4,
                  borderColor: selected ? 'primary.main' : 'transparent',
                  bgcolor: selected ? 'rgba(95, 91, 216, 0.08)' : 'transparent',
                  transition: 'background-color 150ms ease, border-color 150ms ease',
                  '&:hover': { bgcolor: selected ? 'rgba(95, 91, 216, 0.1)' : 'rgba(35, 34, 58, 0.04)' },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
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
                      {job.location ? ` · ${job.location}` : null}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      minWidth: 96,
                      display: 'grid',
                      gap: 0.15,
                      justifyItems: 'end',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5 }}>
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
                      <SpamBadge job={job} />
                    </Box>
                    <Typography color="text.secondary" variant="caption" fontWeight={700} noWrap>
                      {[job.source, formatDate(job.postedAt || job.scrapedAt)].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                </Box>
              </ButtonBase>
            </ListItem>
          );
        })}
      </List>
      <Pagination filters={filters} total={total} onPage={onPage} onPageSize={onPageSize} />
    </Paper>
  );
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

function EmptyState({ children }) {
  return (
    <Box sx={{ p: 3 }}>
      <Typography color="text.secondary">{children}</Typography>
    </Box>
  );
}

function LoadingState({ label }) {
  return (
    <Box sx={{ minHeight: 160, p: 3, display: 'grid', placeItems: 'center', gap: 1 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
    </Box>
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
