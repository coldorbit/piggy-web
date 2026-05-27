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
import { authUrl } from '../../lib/api.js';
import { BID_TABS } from './bidConstants.js';
import BidJobCard from './BidJobCard.jsx';

export default function BidJobsPanel({
  activeColor,
  activeTab,
  creatingBid,
  draftsForJob,
  jobs,
  loading,
  page,
  pages,
  pageSize,
  tabCounts,
  total,
  updatingBid,
  tailoringByJobId = {},
  onDraftChange,
  onPageChange,
  onPageSizeChange,
  onStatusChange,
  onTabChange,
  onHiddenChange,
  onTailorResume,
}) {
  const isSaving = creatingBid || updatingBid;
  const readyResumeIds = jobs
    .map((job) => job.tailoredResume)
    .filter((resume) => resume?.status === 'ready' && resume.filePath)
    .map((resume) => resume.id);
  const downloadAllUrl = authUrl(`/api/bid/tailored-resumes/download?ids=${readyResumeIds.map(encodeURIComponent).join(',')}`);

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', boxShadow: 1 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1,
          px: 1.25,
          py: 0.5,
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
        <Button
          component="a"
          disabled={!readyResumeIds.length}
          href={readyResumeIds.length ? downloadAllUrl : undefined}
          size="small"
          startIcon={<ArchiveIcon />}
          variant="outlined"
          sx={{ my: 0.75, minHeight: 34, whiteSpace: 'nowrap' }}
        >
          Download all
        </Button>
      </Box>

      <Box
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: { xs: 1, sm: 1.5 },
          minHeight: 320,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading && jobs.length ? <LoadingOverlay label="Loading bid workspace..." /> : null}
        <Stack spacing={0.75} aria-busy={loading} sx={{ flex: 1 }}>
          {loading && !jobs.length ? <LoadingState label="Loading bid workspace..." /> : null}
          {!loading && jobs.length === 0 ? (
            <EmptyState>No {tabLabel(activeTab)} jobs match this search.</EmptyState>
          ) : null}
          {jobs.map((job) => (
            <BidJobCard
              key={job.id}
              accent={activeColor}
              draft={draftsForJob(job)}
              isSaving={isSaving}
              job={job}
              statusDefault={activeTab === BID_TABS.done ? 'submitted' : undefined}
              onDraftChange={onDraftChange}
              onStatusChange={onStatusChange}
              onHiddenChange={onHiddenChange}
              onTailorResume={onTailorResume}
              showStatusControl={activeTab === BID_TABS.done}
              showAppliedAction={activeTab === BID_TABS.tailored && job.tailoredResume?.status === 'ready'}
              showTailorAction={activeTab === BID_TABS.todo || job.tailoredResume?.status === 'dead_letter'}
              isTailoring={Boolean(tailoringByJobId[job.id])}
            />
          ))}
        </Stack>
        {!loading ? (
          <Box sx={{ pt: 1.5, mt: 'auto' }}>
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

function tabLabel(tab) {
  if (tab === BID_TABS.tailored) return 'tailored';
  return tab === BID_TABS.todo ? 'todo' : 'done';
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
