import { useEffect, useMemo, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import WorkIcon from '@mui/icons-material/Work';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Typography } from '@mui/material';
import JobDetail from '../components/jobs/JobDetail.jsx';
import JobFiltersDrawer from '../components/jobs/JobFiltersDrawer.jsx';
import JobList from '../components/jobs/JobList.jsx';
import Metric from '../components/jobs/Metric.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { useDeleteJob, useImportJobsCsv, useJobs, useJobsMeta, useMarkJobHidden, useMarkJobSpam } from '../lib/api.js';
import { PAGE_SIZE } from '../lib/constants.js';
import { formatDateTime } from '../lib/formatters.js';
import { matchesSpamFilter, matchesVisibilityFilter } from '../lib/jobFilters.js';
import { readPersistedFilters, writePersistedFilters } from '../lib/persistedFilters.js';
import { ROLES, isAdminRole } from '../lib/roles.js';

const JOB_FILTER_KEYS = ['search', 'roleFamily', 'source', 'since', 'spam', 'visibility', 'origin', 'sort', 'page', 'limit'];
const JOB_FILTERS_STORAGE_KEY = 'applypilot.jobs.filters';
const PASTED_JOB_HEADERS = ['title', 'company', 'url', 'location', 'category', 'postedAt', 'source', 'sourceUrl', 'listingText'];

const DEFAULT_FILTERS = {
  search: '',
  roleFamily: 'all',
  source: 'all',
  since: '24h',
  spam: 'all',
  visibility: 'visible',
  origin: 'all',
  sort: 'scraped_desc',
  page: 1,
  limit: PAGE_SIZE,
};

export default function JobsPage({ currentUser }) {
  const [filters, setFilters] = useState(() => readPersistedFilters(JOB_FILTERS_STORAGE_KEY, DEFAULT_FILTERS, JOB_FILTER_KEYS));
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLocationByJobId, setSelectedLocationByJobId] = useState({});
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [pastedJobRow, setPastedJobRow] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importResult, setImportResult] = useState(null);
  const { setSearch: setHeaderSearch } = useHeaderSearch();

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
  const { mutateAsync: deleteJob, isPending: deletingJob } = useDeleteJob();
  const { mutateAsync: markSpam } = useMarkJobSpam();
  const { mutateAsync: markHidden } = useMarkJobHidden();
  const { mutate: importJobsCsv, isPending: importingCsv } = useImportJobsCsv();

  const jobs = jobsData?.jobs || [];
  const total = jobsData?.total || 0;
  const meta = metaData || { total: 0, sources: [], latestScrapedAt: null };
  const canImportJobs = [ROLES.superadmin, ROLES.admin, ROLES.user, ROLES.editableBidder].includes(currentUser?.role);

  const selectedJob = useMemo(
    () => jobs.find((job) => String(job.id) === String(selectedId)) || jobs[0] || null,
    [jobs, selectedId],
  );
  const selectedLocationId = selectedJob ? selectedLocationByJobId[selectedJob.id] || selectedJob.locationOptions?.[0]?.id || selectedJob.id : '';
  const selectedLocationJob = useMemo(
    () => selectedLocationForJob(selectedJob, selectedLocationId),
    [selectedJob, selectedLocationId],
  );

  useEffect(() => {
    writePersistedFilters(JOB_FILTERS_STORAGE_KEY, filters, JOB_FILTER_KEYS);
  }, [filters]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  }

  useEffect(() => {
    setHeaderSearch({
      isVisible: true,
      placeholder: 'Search jobs',
      value: filters.search || '',
      onChange: (value) => updateFilter('search', value),
    });
  }, [filters.search, setHeaderSearch]);

  useEffect(() => {
    return () => setHeaderSearch(EMPTY_HEADER_SEARCH);
  }, [setHeaderSearch]);

  async function updateSpamReview(jobId, isSpam) {
    const updatedJob = await markSpam({ jobId, isSpam });
    if (!matchesSpamFilter(updatedJob, filters.spam)) {
      clearSelectionForLocation(jobId);
    }
    return updatedJob;
  }

  async function updateHiddenState(jobId, isHidden) {
    const updatedJob = await markHidden({ jobId, isHidden });
    if (!matchesVisibilityFilter(updatedJob, filters.visibility)) {
      clearSelectionForLocation(jobId);
    }
    return updatedJob;
  }

  async function deleteJobPermanently(jobId) {
    await deleteJob({ jobId });
    clearSelectionForLocation(jobId);
  }

  function clearSelectionForLocation(jobId) {
    setSelectedId((current) => {
      const selectedLocationIds = new Set((selectedJob?.locationOptions || []).map((option) => String(option.id)));
      return selectedLocationIds.has(String(jobId)) || String(current) === String(jobId) ? null : current;
    });
  }

  function selectJob(jobId) {
    setSelectedId(jobId);
    const job = jobs.find((item) => String(item.id) === String(jobId));
    if (!job?.locationOptions?.length || selectedLocationByJobId[job.id]) return;
    setSelectedLocationByJobId((current) => ({ ...current, [job.id]: job.locationOptions[0].id }));
  }

  function selectJobLocation(locationJobId) {
    if (!selectedJob) return;
    setSelectedLocationByJobId((current) => ({ ...current, [selectedJob.id]: locationJobId }));
  }

  function importCsv(event) {
    event.preventDefault();
    submitJobsImport(csvText, {
      onSuccess: () => {
        setCsvText('');
        setIsImportOpen(false);
      },
    });
  }

  function importPastedJob() {
    submitJobsImport(csvFromPastedJobRow(pastedJobRow), {
      onSuccess: () => {
        setPastedJobRow('');
        setIsImportOpen(false);
      },
    });
  }

  function submitJobsImport(nextCsvText, options = {}) {
    setImportMessage('');
    setImportResult(null);
    importJobsCsv(
      { csvText: nextCsvText },
      {
        onSuccess: (result) => {
          options.onSuccess?.(result);
          setImportResult(result);
        },
        onError: (importError) => {
          setImportResult(null);
          setImportMessage(importError.message);
        },
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
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.75, gridTemplateRows: 'auto auto auto 1fr' }}>
      <Grid container spacing={1.25}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Metric
            icon={<WorkIcon />}
            label="Total"
            value={meta.total.toLocaleString()}
            action={
              canImportJobs ? (
                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setIsImportOpen(true)}>
                  Import
                </Button>
              ) : null
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Metric icon={<FilterAltIcon />} label="Shown" value={total.toLocaleString()} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Metric icon={<AccessTimeIcon />} label="Latest scrape" value={formatDateTime(meta.latestScrapedAt)} />
        </Grid>
      </Grid>

      <JobFiltersDrawer
        isOpen={isFilterPanelOpen}
        filters={filters}
        meta={meta}
        onClose={() => setIsFilterPanelOpen(false)}
        onFilterChange={updateFilter}
        onOpen={() => setIsFilterPanelOpen(true)}
        onRefresh={() => {
          refetchMeta();
          refetchJobs();
        }}
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {importMessage ? <Alert severity={importMessage.startsWith('Imported') ? 'success' : 'error'}>{importMessage}</Alert> : null}
      {importResult ? <ImportCsvResultAlert result={importResult} /> : null}

      <Box
        component="section"
        sx={{
          minHeight: 0,
          height: { lg: 'calc(100vh - 230px)' },
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
          onPage={(page) => updateFilter('page', page)}
          onPageSize={(limit) => updateFilter('limit', limit)}
          onSelectJob={selectJob}
        />
        <JobDetail
          canDelete={isAdminRole(currentUser)}
          isDeleting={deletingJob}
          job={selectedLocationJob}
          groupJob={selectedJob}
          selectedLocationId={selectedLocationId}
          onDelete={deleteJobPermanently}
          onHiddenChange={updateHiddenState}
          onLocationChange={selectJobLocation}
          onSpamReview={updateSpamReview}
        />
      </Box>

      <Dialog open={isImportOpen} onClose={() => setIsImportOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={importCsv}>
          <DialogTitle>Import Jobs</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
            <TextField
              label="Paste one job row"
              value={pastedJobRow}
              onChange={(event) => setPastedJobRow(event.target.value)}
              placeholder={PASTED_JOB_HEADERS.join('\t')}
              multiline
              minRows={4}
              maxRows={8}
              fullWidth
              sx={{ mt: 2 }}
            />
            <Button
              type="button"
              variant="contained"
              startIcon={<ContentPasteIcon />}
              disabled={importingCsv || !pastedJobRow.trim()}
              onClick={importPastedJob}
            >
              Import pasted row
            </Button>
            <Typography color="text.secondary" variant="body2">
              Column order: {PASTED_JOB_HEADERS.join(', ')}
            </Typography>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
              Choose CSV
              <input type="file" accept=".csv,text/csv" hidden onChange={readCsvFile} />
            </Button>
            <Typography color="text.secondary" variant="body2">
              {csvText ? `${csvText.length.toLocaleString()} characters ready` : 'No file selected'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={importingCsv || !csvText}>
              Import CSV
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

function csvFromPastedJobRow(value) {
  const rowText = String(value || '').trim();
  const firstLine = rowText.split(/\r?\n/, 1)[0] || '';
  const pastedHeaders = firstLine.split('\t').map((item) => item.trim()).join(',');
  const body = pastedHeaders === PASTED_JOB_HEADERS.join(',') ? rowText.split(/\r?\n/).slice(1).join('\n') : rowText;
  return [PASTED_JOB_HEADERS.join('\t'), body].join('\n');
}

function ImportCsvResultAlert({ result }) {
  const duplicatesInCsv = result?.duplicates?.inCsv || [];
  const existingDuplicates = result?.duplicates?.existing || [];
  const duplicateCount = Number(result?.duplicateCount || duplicatesInCsv.length + existingDuplicates.length);
  const duplicateItems = [
    ...existingDuplicates.map((item) => ({
      key: `existing-${item.rowNumber || ''}-${item.url}`,
      label: `Row ${item.rowNumber || '?'} already exists: ${item.url}`,
    })),
    ...duplicatesInCsv.map((item) => ({
      key: `csv-${item.rowNumber || ''}-${item.url}`,
      label: `Row ${item.rowNumber || '?'} duplicates row ${item.firstRowNumber || '?'}: ${item.url}`,
    })),
  ];
  const visibleDuplicates = duplicateItems.slice(0, 10);
  const hiddenDuplicateCount = Math.max(0, duplicateItems.length - visibleDuplicates.length);

  return (
    <Alert severity="success">
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Typography fontWeight={900}>CSV import completed</Typography>
        <Typography variant="body2">
          {Number(result?.successfulImports ?? result?.imported ?? 0).toLocaleString()} imported from{' '}
          {Number(result?.totalRows || 0).toLocaleString()} rows. {Number(result?.skipped || 0).toLocaleString()} skipped.
          {duplicateCount ? ` ${duplicateCount.toLocaleString()} duplicate link${duplicateCount === 1 ? '' : 's'} found.` : ''}
        </Typography>
        {duplicateCount ? (
          <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'grid', gap: 0.35 }}>
            {visibleDuplicates.map((item) => (
              <Typography component="li" variant="body2" key={item.key}>
                {item.label}
              </Typography>
            ))}
            {hiddenDuplicateCount ? <Typography variant="body2">+{hiddenDuplicateCount.toLocaleString()} more duplicate links.</Typography> : null}
          </Box>
        ) : null}
      </Box>
    </Alert>
  );
}

function selectedLocationForJob(job, selectedLocationId) {
  if (!job) return null;
  const locationOption = (job.locationOptions || []).find((option) => String(option.id) === String(selectedLocationId));
  return locationOption || job;
}
