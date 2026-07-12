import { useCallback, useEffect, useRef, useState } from 'react';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArchiveIcon from '@mui/icons-material/Archive';
import { PAGE_SIZE_OPTIONS } from '../../lib/constants.js';
import { downloadAuthenticatedFile, useMarkTailoredResumesDownloaded } from '../../lib/api.js';
import { isSuperadmin } from '../../lib/roles.js';
import EmptyState from '../common/EmptyState.jsx';
import { BID_TABS, REVIEW_STATUSES } from './bidConstants.js';
import { isTodoTailoringLocked } from './bidJobState.js';
import BidJobCard from './BidJobCard.jsx';
import { useBidWorkspace } from './BidWorkspaceContext.jsx';

export default function BidJobsPanel() {
  const {
    activeColor,
    activeProfileIsStatic = false,
    activeProfileId,
    activeTab,
    currentUser,
    isBulkUpdating = false,
    jobs,
    loading,
    page,
    pages,
    pageSize,
    tabCounts,
    onPageChange,
    onPageSizeChange,
    onHiddenChange,
    onBulkMarkApplied,
    onBulkTailorResumes,
    onTabChange,
    onTailorResume,
  } = useBidWorkspace();
  const markTailoredResumesDownloaded = useMarkTailoredResumesDownloaded();
  const jobsScrollRef = useRef(null);
  const [selectedJobIds, setSelectedJobIds] = useState(() => new Set());
  const readyResumeIds = jobs
    .filter((job) => !isReviewBidStatus(job.bid?.status))
    .map((job) => job.tailoredResume)
    .filter((resume) => resume?.status === 'ready' && resume.filePath)
    .map((resume) => resume.id);
  const selectableJobs = jobs.filter((job) => !isJobSelectionDisabled(job, activeTab, currentUser, activeProfileIsStatic));
  const visibleJobKeys = selectableJobs.map((job) => bidJobCardKey(job));
  const visibleJobIdsKey = visibleJobKeys.join('|');
  const selectedVisibleJobs = selectableJobs.filter((job) => selectedJobIds.has(bidJobCardKey(job)));
  const allVisibleJobsSelected = visibleJobKeys.length > 0 && visibleJobKeys.every((jobKey) => selectedJobIds.has(jobKey));

  useEffect(() => {
    setSelectedJobIds(new Set());
  }, [activeProfileId, activeTab]);

  useEffect(() => {
    setSelectedJobIds((current) => {
      const visibleJobKeySet = new Set(visibleJobKeys);
      const next = new Set([...current].filter((jobKey) => visibleJobKeySet.has(jobKey)));
      return next.size === current.size ? current : next;
    });
  }, [visibleJobIdsKey]);

  useEffect(() => {
    jobsScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeProfileId, activeTab, page, pageSize]);

  const toggleJobSelected = useCallback((jobId) => {
    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  function toggleAllVisibleJobs() {
    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (allVisibleJobsSelected) {
        visibleJobKeys.forEach((jobKey) => next.delete(jobKey));
      } else {
        visibleJobKeys.forEach((jobKey) => next.add(jobKey));
      }
      return next;
    });
  }

  function clearSelectedJobs(jobsToClear = selectedVisibleJobs) {
    setSelectedJobIds((current) => {
      const next = new Set(current);
      jobsToClear.forEach((job) => next.delete(bidJobCardKey(job)));
      return next;
    });
  }

  function tailorSelectedJobs() {
    if (onBulkTailorResumes) {
      onBulkTailorResumes(selectedVisibleJobs);
    } else {
      selectedVisibleJobs.forEach((job) => onTailorResume(job));
    }
    clearSelectedJobs();
  }

  function hideSelectedJobs() {
    selectedVisibleJobs.forEach((job) => onHiddenChange(job, true));
    clearSelectedJobs();
  }

  function markSelectedJobsApplied() {
    onBulkMarkApplied(selectedVisibleJobs);
    clearSelectedJobs();
  }

  function exportActiveTabCsv() {
    const csv = activeTab === BID_TABS.tailored ? tailoredJobsCsv(jobs) : jobsInfoCsv(jobs);
    downloadCsv(csv, `${tabLabel(activeTab)}-jobs.csv`);
  }

  async function downloadAllReadyResumes() {
    if (!readyResumeIds.length) return;
    await downloadAuthenticatedFile(
      `/api/bid/tailored-resumes/download?ids=${readyResumeIds.map(encodeURIComponent).join(',')}`,
      'tailored-resumes.zip',
    );
    markTailoredResumesDownloaded(readyResumeIds);
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
            sx={{ fontWeight: 600, '&.Mui-selected': { color: activeColor.dark } }}
          />
          <Tab
            value={BID_TABS.tailored}
            label={`Tailored (${(tabCounts.tailored || 0).toLocaleString()})`}
            sx={{ fontWeight: 600, '&.Mui-selected': { color: activeColor.dark } }}
          />
          <Tab
            value={BID_TABS.done}
            label={`Done (${tabCounts.done.toLocaleString()})`}
            sx={{ fontWeight: 600, '&.Mui-selected': { color: activeColor.dark } }}
          />
          <Tab
            value={BID_TABS.badWork}
            label={`Bad work (${(tabCounts.badWork || 0).toLocaleString()})`}
            sx={{ fontWeight: 600, '&.Mui-selected': { color: activeColor.dark } }}
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
                disabled={!selectedVisibleJobs.length || isBulkUpdating}
                onClick={hideSelectedJobs}
                size="small"
                startIcon={<VisibilityOffIcon />}
                variant="outlined"
                sx={{ my: 0.75, minHeight: 34, whiteSpace: 'nowrap' }}
              >
                Hide selected
              </Button>
              <Button
                disabled={!selectedVisibleJobs.length || isBulkUpdating}
                onClick={tailorSelectedJobs}
                size="small"
                startIcon={activeProfileIsStatic ? <CheckCircleIcon /> : <AutoAwesomeIcon />}
                variant="contained"
                sx={{
                  my: 0.75,
                  minHeight: 34,
                  whiteSpace: 'nowrap',
                  bgcolor: '#0067C0',
                  '&:hover': { bgcolor: '#005FB8' },
                  '&:active': { bgcolor: '#005A9E' },
                  '&.Mui-disabled': {
                    bgcolor: 'rgba(0, 103, 192, 0.38)',
                    color: 'rgba(255, 255, 255, 0.72)',
                  },
                }}
              >
                {activeProfileIsStatic ? 'Mark selected ready' : 'Tailor selected'}
              </Button>
            </>
          ) : (
            <>
              {activeTab === BID_TABS.tailored ? (
                <Button
                  disabled={!selectedVisibleJobs.length || isBulkUpdating}
                  onClick={markSelectedJobsApplied}
                  size="small"
                  startIcon={<CheckCircleIcon />}
                  variant="contained"
                  sx={{ my: 0.75, minHeight: 34, whiteSpace: 'nowrap' }}
                >
                  Mark selected applied
                </Button>
              ) : null}
              <Button
                disabled={!readyResumeIds.length}
                onClick={downloadAllReadyResumes}
                size="small"
                startIcon={<ArchiveIcon />}
                variant="outlined"
                sx={{ my: 0.75, minHeight: 34, whiteSpace: 'nowrap' }}
              >
                Download all
              </Button>
            </>
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
        <Stack ref={jobsScrollRef} spacing={0.75} aria-busy={loading} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
          {loading && !jobs.length ? <BidJobSkeletonList /> : null}
          {!loading && jobs.length === 0 ? (
            <EmptyState
              title={`No ${tabLabel(activeTab)} jobs found`}
              detail="Adjust the search, filters, or selected profile to see more jobs."
              sx={{ flexShrink: 0 }}
            />
          ) : null}
          {jobs.map((job) => (
            <BidJobCard
              key={bidJobCardKey(job)}
              selectionId={bidJobCardKey(job)}
              job={job}
              isSelected={selectedJobIds.has(bidJobCardKey(job))}
              isSelectionDisabled={isJobSelectionDisabled(job, activeTab, currentUser, activeProfileIsStatic)}
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

function isJobSelectionDisabled(job, activeTab, currentUser, activeProfileIsStatic = false) {
  const canRecoverReviewedBid = activeTab === BID_TABS.badWork && isSuperadmin(currentUser);
  const tailoredResumeNotReady = activeTab === BID_TABS.tailored && !activeProfileIsStatic && job.tailoredResume?.status !== 'ready';
  return tailoredResumeNotReady
    || (isReviewBidStatus(job.bid?.status) && !canRecoverReviewedBid)
    || (!activeProfileIsStatic && activeTab === BID_TABS.todo && isTodoTailoringLocked(job));
}

function bidJobCardKey(job) {
  return String(job.groupId || job.id);
}

function isReviewBidStatus(status) {
  return REVIEW_STATUSES.has(status);
}

function tabLabel(tab) {
  if (tab === BID_TABS.tailored) return 'tailored';
  if (tab === BID_TABS.badWork) return 'bad work';
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

function BidJobSkeletonList() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <Paper key={`bid-job-loading-${index}`} variant="outlined" sx={{ p: 1.25, borderRadius: 2, flexShrink: 0 }}>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Skeleton width="58%" />
                <Skeleton width="38%" />
              </Box>
              <Stack direction="row" spacing={0.75}>
                <Skeleton variant="rounded" width={74} height={24} />
                <Skeleton variant="rounded" width={92} height={24} />
              </Stack>
            </Stack>
            <Skeleton variant="rounded" height={44} />
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Skeleton width="35%" />
              <Stack direction="row" spacing={0.75}>
                <Skeleton variant="rounded" width={96} height={32} />
                <Skeleton variant="rounded" width={116} height={32} />
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      ))}
    </>
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
