import { useEffect, useState } from 'react';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  MenuItem,
  Pagination as MuiPagination,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArchiveIcon from '@mui/icons-material/Archive';
import { PAGE_SIZE_OPTIONS } from '../../lib/constants.js';
import { authUrl, useMarkTailoredResumesDownloaded } from '../../lib/api.js';
import { BID_TABS } from './bidConstants.js';
import { isTodoTailoringLocked } from './bidJobState.js';
import BidJobCard from './BidJobCard.jsx';
import { useBidWorkspace } from './BidWorkspaceContext.jsx';

export default function BidJobsPanel() {
  const {
    activeColor,
    activeProfileId,
    activeTab,
    jobs,
    loading,
    page,
    pages,
    pageSize,
    tabCounts,
    onPageChange,
    onPageSizeChange,
    onHiddenChange,
    onTabChange,
    onTailorResume,
  } = useBidWorkspace();
  const markTailoredResumesDownloaded = useMarkTailoredResumesDownloaded();
  const [selectedJobIds, setSelectedJobIds] = useState(() => new Set());
  const readyResumeIds = jobs
    .map((job) => job.tailoredResume)
    .filter((resume) => resume?.status === 'ready' && resume.filePath)
    .map((resume) => resume.id);
  const downloadAllUrl = authUrl(`/api/bid/tailored-resumes/download?ids=${readyResumeIds.map(encodeURIComponent).join(',')}`);
  const selectableJobs = jobs.filter((job) => !isJobSelectionDisabled(job, activeTab));
  const visibleJobIds = selectableJobs.map((job) => job.id);
  const visibleJobIdsKey = visibleJobIds.join('|');
  const selectedVisibleJobs = selectableJobs.filter((job) => selectedJobIds.has(job.id));
  const allVisibleJobsSelected = visibleJobIds.length > 0 && visibleJobIds.every((jobId) => selectedJobIds.has(jobId));

  useEffect(() => {
    setSelectedJobIds(new Set());
  }, [activeProfileId, activeTab]);

  useEffect(() => {
    setSelectedJobIds((current) => {
      const visibleJobIdSet = new Set(visibleJobIds);
      const next = new Set([...current].filter((jobId) => visibleJobIdSet.has(jobId)));
      return next.size === current.size ? current : next;
    });
  }, [visibleJobIdsKey]);

  function toggleJobSelected(jobId) {
    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }

  function toggleAllVisibleJobs() {
    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (allVisibleJobsSelected) {
        visibleJobIds.forEach((jobId) => next.delete(jobId));
      } else {
        visibleJobIds.forEach((jobId) => next.add(jobId));
      }
      return next;
    });
  }

  function tailorSelectedJobs() {
    selectedVisibleJobs.forEach((job) => onTailorResume(job));
  }

  function hideSelectedJobs() {
    selectedVisibleJobs.forEach((job) => onHiddenChange(job, true));
    setSelectedJobIds((current) => {
      const next = new Set(current);
      selectedVisibleJobs.forEach((job) => next.delete(job.id));
      return next;
    });
  }

  function exportActiveTabCsv() {
    const csv = activeTab === BID_TABS.tailored ? tailoredJobsCsv(jobs) : jobsInfoCsv(jobs);
    downloadCsv(csv, `${tabLabel(activeTab)}-jobs.csv`);
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        boxShadow: 1,
        height: { xs: 'auto', md: '100%' },
        minHeight: { md: 0 },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1,
          px: 1.25,
          py: 0.5,
          flexShrink: 0,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_event, value) => onTabChange(value)}
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': { backgroundColor: activeColor.main },
            '& .MuiTab-root': { minHeight: 44 },
          }}
        >
          <Tab
            value={BID_TABS.todo}
            label={`Todo (${tabCounts.todo.toLocaleString()})`}
            sx={{ fontWeight: 800, '&.Mui-selected': { color: activeColor.dark } }}
          />
          <Tab
            value={BID_TABS.tailored}
            label={`Tailored (${(tabCounts.tailored || 0).toLocaleString()})`}
            sx={{ fontWeight: 800, '&.Mui-selected': { color: activeColor.dark } }}
          />
          <Tab
            value={BID_TABS.done}
            label={`Done (${tabCounts.done.toLocaleString()})`}
            sx={{ fontWeight: 800, '&.Mui-selected': { color: activeColor.dark } }}
          />
        </Tabs>
        <Stack direction="row" spacing={0.75} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
          <Button
            disabled={!jobs.length}
            onClick={toggleAllVisibleJobs}
            size="small"
            startIcon={allVisibleJobsSelected ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
            variant="outlined"
            sx={{ my: 0.75, minHeight: 34, whiteSpace: 'nowrap' }}
          >
            {allVisibleJobsSelected ? 'Clear selection' : 'Select all'}
          </Button>
          <Button
            disabled={!jobs.length}
            onClick={exportActiveTabCsv}
            size="small"
            startIcon={<FileDownloadIcon />}
            variant="outlined"
            sx={{ my: 0.75, minHeight: 34, whiteSpace: 'nowrap' }}
          >
            Export CSV
          </Button>
          {activeTab === BID_TABS.todo ? (
            <>
              <Button
                disabled={!selectedVisibleJobs.length}
                onClick={hideSelectedJobs}
                size="small"
                startIcon={<VisibilityOffIcon />}
                variant="outlined"
                sx={{ my: 0.75, minHeight: 34, whiteSpace: 'nowrap' }}
              >
                Hide selected
              </Button>
              <Button
                disabled={!selectedVisibleJobs.length}
                onClick={tailorSelectedJobs}
                size="small"
                startIcon={<AutoAwesomeIcon />}
                variant="contained"
                sx={{
                  my: 0.75,
                  minHeight: 34,
                  whiteSpace: 'nowrap',
                  bgcolor: '#2563eb',
                  '&:hover': { bgcolor: '#1d4ed8' },
                  '&.Mui-disabled': {
                    bgcolor: '#bfdbfe',
                    color: '#eff6ff',
                  },
                }}
              >
                Tailor selected
              </Button>
            </>
          ) : (
            <Button
              component="a"
              disabled={!readyResumeIds.length}
              href={readyResumeIds.length ? downloadAllUrl : undefined}
              onClick={() => markTailoredResumesDownloaded(readyResumeIds)}
              download="tailored-resumes.zip"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              startIcon={<ArchiveIcon />}
              variant="outlined"
              sx={{ my: 0.75, minHeight: 34, whiteSpace: 'nowrap' }}
            >
              Download all
            </Button>
          )}
        </Stack>
      </Box>

      <Box
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: { xs: 1, sm: 1.5 },
          minHeight: { xs: 320, md: 0 },
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading && jobs.length ? <LoadingOverlay label="Loading bid workspace..." /> : null}
        <Stack spacing={0.75} aria-busy={loading} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
          {loading && !jobs.length ? <LoadingState label="Loading bid workspace..." /> : null}
          {!loading && jobs.length === 0 ? (
            <EmptyState>No {tabLabel(activeTab)} jobs match this search.</EmptyState>
          ) : null}
          {jobs.map((job) => (
            <BidJobCard
              key={job.id}
              job={job}
              isSelected={selectedJobIds.has(job.id)}
              isSelectionDisabled={isJobSelectionDisabled(job, activeTab)}
              onSelectedChange={toggleJobSelected}
              onResumeDownload={markTailoredResumesDownloaded}
            />
          ))}
        </Stack>
        {!loading ? (
          <Box sx={{ pt: 1.5, mt: 'auto', flexShrink: 0 }}>
            <Paper
              variant="outlined"
              sx={{
                minHeight: 56,
                px: 1.25,
                py: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                bgcolor: 'rgba(246, 249, 248, 0.72)',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="center"
                alignItems="center"
                spacing={1}
                sx={{ width: '100%', textAlign: 'center' }}
              >
                <FormControl size="small" sx={{ minWidth: 76 }}>
                  <Select
                    value={Number(pageSize || PAGE_SIZE_OPTIONS[0])}
                    onChange={(event) => onPageSizeChange(Number(event.target.value))}
                    displayEmpty
                    sx={{ height: 32 }}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <MuiPagination
                  count={pages}
                  page={page}
                  onChange={(_event, nextPage) => onPageChange(nextPage)}
                  shape="rounded"
                  color="primary"
                  sx={{ '& .MuiPagination-ul': { justifyContent: 'center' } }}
                />
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: '32px' }}>
                    Page {page} of {pages}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
}

function isJobSelectionDisabled(job, activeTab) {
  return activeTab === BID_TABS.todo && isTodoTailoringLocked(job);
}

function tabLabel(tab) {
  if (tab === BID_TABS.tailored) return 'tailored';
  return tab === BID_TABS.todo ? 'todo' : 'done';
}

function jobsInfoCsv(jobs) {
  return csvFromRows(
    ['jobLink', 'title', 'company', 'location', 'category', 'source', 'postedAt', 'scrapedAt', 'manualJob', 'bidStatus', 'resumeStatus', 'listingText'],
    jobs.map((job) => ({
      jobLink: job.url || '',
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      category: job.category || '',
      source: job.source || '',
      postedAt: job.postedAt || '',
      scrapedAt: job.scrapedAt || '',
      manualJob: job.isManual ? 'yes' : 'no',
      bidStatus: job.bid?.status || '',
      resumeStatus: job.tailoredResume?.status || '',
      listingText: job.listingText || '',
    })),
  );
}

function tailoredJobsCsv(jobs) {
  return csvFromRows(
    ['jobLink', 'title', 'company', 'resumeFileName'],
    jobs.map((job) => ({
      jobLink: job.url || '',
      title: job.title || '',
      company: job.company || '',
      resumeFileName: resumeFileName(job.tailoredResume?.filePath),
    })),
  );
}

function csvFromRows(headers, rows) {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function resumeFileName(filePath) {
  if (!filePath) return '';
  return String(filePath).split('/').pop() || '';
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function EmptyState({ children }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography color="text.secondary">{children}</Typography>
    </Paper>
  );
}

function LoadingState({ label }) {
  return (
    <Paper
      variant="outlined"
      sx={{ minHeight: 180, p: 3, display: 'grid', placeItems: 'center', gap: 1 }}
    >
      <CircularProgress size={30} />
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
    </Paper>
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
