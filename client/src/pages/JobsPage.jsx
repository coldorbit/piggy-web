import { useMemo, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import WorkIcon from '@mui/icons-material/Work';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Typography } from '@mui/material';
import JobDetail from '../components/jobs/JobDetail.jsx';
import JobFiltersToolbar from '../components/jobs/JobFiltersToolbar.jsx';
import JobList from '../components/jobs/JobList.jsx';
import Metric from '../components/jobs/Metric.jsx';
import { useImportJobsCsv, useJobs, useJobsMeta, useMarkJobHidden, useMarkJobSpam } from '../lib/api.js';
import { PAGE_SIZE } from '../lib/constants.js';
import { formatDateTime } from '../lib/formatters.js';
import { matchesSpamFilter, matchesVisibilityFilter } from '../lib/jobFilters.js';

const DEFAULT_FILTERS = {
  search: '',
  roleFamily: 'all',
  source: 'all',
  since: '24h',
  spam: 'all',
  visibility: 'visible',
  sort: 'scraped_desc',
  page: 1,
  limit: PAGE_SIZE,
};

export default function JobsPage({ currentUser }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const {
    data: jobsData,
    isFetching: jobsFetching,
    isLoading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs,
  } = useJobs({
    ...filters,
  });

  const { data: metaData, isLoading: metaLoading, error: metaError, refetch: refetchMeta } = useJobsMeta();
  const { mutateAsync: markSpam } = useMarkJobSpam();
  const { mutateAsync: markHidden } = useMarkJobHidden();
  const { mutate: importJobsCsv, isPending: importingCsv } = useImportJobsCsv();

  const jobs = jobsData?.jobs || [];
  const total = jobsData?.total || 0;
  const meta = metaData || { total: 0, sources: [], latestScrapedAt: null };
  const canImportJobs = ['admin', 'user', 'editable_bidder'].includes(currentUser?.role);

  const selectedJob = useMemo(
    () => jobs.find((job) => String(job.id) === String(selectedId)) || jobs[0] || null,
    [jobs, selectedId],
  );

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  }

  async function updateSpamReview(jobId, isSpam) {
    const updatedJob = await markSpam({ jobId, isSpam });
    if (!matchesSpamFilter(updatedJob, filters.spam)) {
      setSelectedId((current) => (String(current) === String(jobId) ? null : current));
    }
    return updatedJob;
  }

  async function updateHiddenState(jobId, isHidden) {
    const updatedJob = await markHidden({ jobId, isHidden });
    if (!matchesVisibilityFilter(updatedJob, filters.visibility)) {
      setSelectedId((current) => (String(current) === String(jobId) ? null : current));
    }
    return updatedJob;
  }

  function importCsv(event) {
    event.preventDefault();
    setImportMessage('');
    importJobsCsv(
      { csvText },
      {
        onSuccess: (result) => {
          setCsvText('');
          setIsImportOpen(false);
          setImportMessage(
            `Imported ${Number(result.imported || 0).toLocaleString()} jobs. Skipped ${Number(result.skipped || 0).toLocaleString()}.`,
          );
        },
        onError: (importError) => setImportMessage(importError.message),
      },
    );
  }

  async function readCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
  }

  const error = jobsError?.message || metaError?.message || '';
  const loading = jobsLoading || jobsFetching || metaLoading;

  return (
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.75, gridTemplateRows: 'auto auto auto auto 1fr' }}>
      <Grid container spacing={1.25}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Metric icon={<WorkIcon />} label="Total" value={meta.total.toLocaleString()} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Metric icon={<FilterAltIcon />} label="Shown" value={total.toLocaleString()} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Metric icon={<AccessTimeIcon />} label="Latest scrape" value={formatDateTime(meta.latestScrapedAt)} />
        </Grid>
      </Grid>

      <JobFiltersToolbar
        filters={filters}
        meta={meta}
        onFilterChange={updateFilter}
        onRefresh={() => {
          refetchMeta();
          refetchJobs();
        }}
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {importMessage ? <Alert severity={importMessage.startsWith('Imported') ? 'success' : 'error'}>{importMessage}</Alert> : null}

      <Box
        component="section"
        sx={{
          minHeight: 0,
          height: { lg: 'calc(100vh - 310px)' },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(360px, 0.9fr) minmax(420px, 1.1fr)' },
          gap: 1.5,
          alignItems: { xs: 'start', lg: 'stretch' },
        }}
      >
        <JobList
          filters={filters}
          jobs={jobs}
          loading={loading}
          selectedJob={selectedJob}
          total={total}
          importAction={
            canImportJobs ? (
              <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setIsImportOpen(true)}>
                Import CSV
              </Button>
            ) : null
          }
          onPage={(page) => updateFilter('page', page)}
          onPageSize={(limit) => updateFilter('limit', limit)}
          onSelectJob={setSelectedId}
        />
        <JobDetail job={selectedJob} onHiddenChange={updateHiddenState} onSpamReview={updateSpamReview} />
      </Box>

      <Dialog open={isImportOpen} onClose={() => setIsImportOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={importCsv}>
          <DialogTitle>Import Jobs</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
              Choose CSV
              <input type="file" accept=".csv,text/csv" hidden onChange={readCsvFile} />
            </Button>
            <Typography color="text.secondary" variant="body2">
              {csvText ? `${csvText.length.toLocaleString()} characters ready` : 'No file selected'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={importingCsv || !csvText}>
              Import
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
