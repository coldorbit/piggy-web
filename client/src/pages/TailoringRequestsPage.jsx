import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EmptyState from '../components/common/EmptyState.jsx';
import ContextualFaqPanel from '../components/faqs/ContextualFaqPanel.jsx';
import RefreshButton from '../components/common/RefreshButton.jsx';
import { downloadAuthenticatedFile, useBidProfiles, useCreateManualTailoredResume, useTailoringRequests } from '../lib/api.js';
import { formatDateTime } from '../lib/formatters.js';

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'requested', label: 'Queued' },
  { value: 'processing', label: 'Tailoring' },
  { value: 'ready', label: 'Ready' },
  { value: 'dead_letter', label: 'Blocked' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'invalid', label: 'Invalid' },
];
const DATE_PRESETS = new Set(['today', 'yesterday', 'this_week', 'last_week', 'all', 'custom']);

const emptyManualForm = {
  profileId: '',
  company: '',
  role: '',
  jobUrl: '',
  jobDescription: '',
};

export default function TailoringRequestsPage() {
  const [status, setStatus] = useState('all');
  const [profileId, setProfileId] = useState('all');
  const [since, setSince] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [manualValidationError, setManualValidationError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const filters = useMemo(
    () => ({ status, profileId, since, dateFrom, dateTo, search, page: page + 1, limit: rowsPerPage }),
    [dateFrom, dateTo, page, profileId, rowsPerPage, search, since, status],
  );
  const { data, isFetching, isLoading, error, refetch } = useTailoringRequests(filters, {
    refetchInterval: (query) => {
      const activeRequests = query.state.data?.requests || [];
      return activeRequests.some((request) => ['requested', 'processing'].includes(request.status)) ? 5000 : false;
    },
  });
  const { data: profiles = [] } = useBidProfiles({ scope: 'manage' });
  const createManualTailoring = useCreateManualTailoredResume();
  const requests = data?.requests || [];
  const statusCounts = data?.statusCounts || {};
  const profileOptions = data?.profiles || [];
  const totalCount = Object.values(statusCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const filteredCount = Number(data?.total || 0);
  const manualProfileOptions = profiles.filter((profile) => (profile.profileStatus || 'active') === 'active');
  const manualError = createManualTailoring.error;
  const canSubmitManual =
    manualForm.profileId &&
    manualForm.company.trim() &&
    manualForm.role.trim() &&
    manualForm.jobUrl.trim() &&
    manualForm.jobDescription.trim() &&
    !createManualTailoring.isPending;

  useEffect(() => {
    if (data) setLastUpdatedAt(new Date());
  }, [data]);

  function handleStatusChange(nextStatus) {
    setStatus(nextStatus);
    setPage(0);
  }

  function handleProfileChange(nextProfileId) {
    setProfileId(nextProfileId);
    setPage(0);
  }

  function handleSinceChange(nextSince) {
    setSince(nextSince);
    if (nextSince !== 'custom') {
      setDateFrom('');
      setDateTo('');
    }
    setPage(0);
  }

  function handleCustomRangeChange([start, end]) {
    setDateFrom(formatDateOnly(start));
    setDateTo(formatDateOnly(end));
    setPage(0);
  }

  function handleSearchChange(nextSearch) {
    setSearch(nextSearch);
    setPage(0);
  }

  function updateManualForm(field, value) {
    if (manualValidationError) setManualValidationError('');
    setManualForm((current) => ({ ...current, [field]: value }));
  }

  function submitManualTailoring(event) {
    event.preventDefault();
    if (!canSubmitManual) return;
    const jobUrl = normalizedHttpUrl(manualForm.jobUrl);
    if (!jobUrl) {
      setManualValidationError('Enter a valid job URL.');
      return;
    }
    createManualTailoring.mutate(
      {
        profileId: manualForm.profileId,
        company: manualForm.company,
        role: manualForm.role,
        jobUrl,
        jobDescription: manualForm.jobDescription,
      },
      {
        onSuccess: () => {
          setManualForm(emptyManualForm);
          setStatus('all');
          setProfileId('all');
          setSince('all');
          setDateFrom('');
          setDateTo('');
          setSearch('');
          setPage(0);
          refetch();
        },
      },
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateRows: 'auto auto auto auto minmax(0, 1fr)',
        gap: 1.5,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {manualError ? <Alert severity="error">{manualError.message}</Alert> : null}
      {manualValidationError ? <Alert severity="error">{manualValidationError}</Alert> : null}

      <Accordion variant="outlined" disableGutters sx={{ borderRadius: 2, overflow: 'hidden', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48, '& .MuiAccordionSummary-content': { my: 1 } }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AutoAwesomeIcon fontSize="small" color="primary" />
            <Typography fontWeight={600}>Manual tailoring</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box component="form" noValidate onSubmit={submitManualTailoring} sx={{ display: 'grid', gap: 1.25 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) auto' }, gap: 1, alignItems: 'start' }}>
              <TextField
                select
                label="Profile"
                value={manualForm.profileId}
                onChange={(event) => updateManualForm('profileId', event.target.value)}
                required
              >
                {manualProfileOptions.map((profile) => (
                  <MenuItem key={profile.id} value={String(profile.id)}>
                    {profile.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Company"
                value={manualForm.company}
                onChange={(event) => updateManualForm('company', event.target.value)}
                required
              />
              <TextField
                label="Role / position title"
                value={manualForm.role}
                onChange={(event) => updateManualForm('role', event.target.value)}
                required
              />
              <TextField
                label="Job URL"
                type="url"
                value={manualForm.jobUrl}
                onChange={(event) => updateManualForm('jobUrl', event.target.value)}
                error={Boolean(manualValidationError)}
                helperText={manualValidationError ? 'Use a full URL or paste a domain and path.' : ''}
                required
              />
              <Button type="submit" variant="contained" startIcon={createManualTailoring.isPending ? <CircularProgress color="inherit" size={16} /> : <AutoAwesomeIcon />} disabled={!canSubmitManual} sx={{ minHeight: 37 }}>
                Tailor
              </Button>
            </Box>
            <TextField
              label="Job description"
              value={manualForm.jobDescription}
              onChange={(event) => updateManualForm('jobDescription', event.target.value)}
              placeholder="Paste the full JD content"
              multiline
              minRows={6}
              maxRows={12}
              required
              fullWidth
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      <TailoringFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        isFetching={isFetching}
        lastUpdatedAt={lastUpdatedAt}
        onCustomRangeChange={handleCustomRangeChange}
        onProfileChange={handleProfileChange}
        onRefresh={refetch}
        onSearchChange={handleSearchChange}
        onSinceChange={handleSinceChange}
        onStatusChange={handleStatusChange}
        profileId={profileId}
        profileOptions={profileOptions}
        search={search}
        since={since}
        status={status}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))', xl: 'repeat(7, minmax(0, 1fr))' }, gap: 1 }}>
        <TailoringCountCard label="Total requests" value={totalCount || filteredCount} active={status === 'all'} />
        {statusOptions.slice(1).map((option) => (
          <TailoringCountCard
            key={option.value}
            label={option.label}
            value={statusCounts[option.value] || 0}
            active={status === option.value}
          />
        ))}
      </Box>

      <ContextualFaqPanel
        keywords={['tailoring', 'tailor', 'resume', 'queued', 'ready', 'blocked', 'manual']}
        title="Tailoring FAQs"
      />

      <Paper variant="outlined" sx={{ borderRadius: 2, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto' }}>
        <TableContainer sx={{ minHeight: 0, overflow: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1280 }}>
            <TableHead>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>Job</TableCell>
                <TableCell>Profile</TableCell>
                <TableCell>Requester</TableCell>
                <TableCell>Attempts</TableCell>
                <TableCell>Review</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TailoringRequestSkeletonRows />
              ) : null}
              {!isLoading && !requests.length ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      title="No tailoring requests found"
                      detail="Adjust the filters or create a manual tailoring request above."
                      variant="plain"
                      sx={{ py: 4 }}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
              {requests.map((request) => (
                <TailoringRequestRow key={request.id} request={request} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredCount}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
        />
      </Paper>
    </Box>
  );
}

function TailoringFilters({
  dateFrom,
  dateTo,
  isFetching,
  lastUpdatedAt,
  onCustomRangeChange,
  onProfileChange,
  onRefresh,
  onSearchChange,
  onSinceChange,
  onStatusChange,
  profileId,
  profileOptions,
  search,
  since,
  status,
}) {
  const sinceValue = DATE_PRESETS.has(since) ? since : 'all';

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} sx={{ minWidth: 0 }}>
      <TextField select label="Status" size="small" value={status} onChange={(event) => onStatusChange(event.target.value)} sx={{ width: { xs: '100%', lg: 180 } }}>
        {statusOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField select label="Profile" size="small" value={profileId} onChange={(event) => onProfileChange(event.target.value)} sx={{ width: { xs: '100%', lg: 260 } }}>
        <MenuItem value="all">All profiles</MenuItem>
        {profileOptions.map((profile) => (
          <MenuItem key={profile.id || 'unknown'} value={String(profile.id || '')}>
            {profile.name} ({Number(profile.count || 0).toLocaleString()})
          </MenuItem>
        ))}
      </TextField>
      <TextField select label="Date" size="small" value={sinceValue} onChange={(event) => onSinceChange(event.target.value)} sx={{ width: { xs: '100%', lg: 160 } }}>
        <MenuItem value="today">Today</MenuItem>
        <MenuItem value="yesterday">Yesterday</MenuItem>
        <MenuItem value="this_week">This week</MenuItem>
        <MenuItem value="last_week">Last week</MenuItem>
        <MenuItem value="all">All time</MenuItem>
        <MenuItem value="custom">Custom range</MenuItem>
      </TextField>
      {sinceValue === 'custom' ? (
        <Box sx={{ width: { xs: '100%', lg: 220 } }}>
          <DatePicker
            selected={parseDateOnly(dateFrom)}
            startDate={parseDateOnly(dateFrom)}
            endDate={parseDateOnly(dateTo)}
            onChange={onCustomRangeChange}
            selectsRange
            isClearable
            dateFormat="MMM d, yyyy"
            maxDate={new Date()}
            popperClassName="job-date-range-picker"
            customInput={<DateRangeInput />}
          />
        </Box>
      ) : null}
      <TextField
        label="Search"
        placeholder="Role, company, profile, user, URL"
        size="small"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        sx={{ flex: 1, minWidth: { xs: 0, lg: 280 } }}
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
      <RefreshButton
        isRefreshing={isFetching}
        lastUpdatedAt={lastUpdatedAt}
        onRefresh={onRefresh}
        sx={{ alignSelf: { xs: 'stretch', lg: 'center' } }}
      />
    </Stack>
  );
}

function TailoringCountCard({ active = false, label, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderRadius: 1,
        borderColor: active ? 'primary.main' : 'divider',
        borderWidth: active ? 2 : 1,
        bgcolor: active ? 'rgba(0, 103, 192, 0.10)' : 'background.paper',
      }}
    >
      <Typography variant="caption" color={active ? 'primary.main' : 'text.secondary'} fontWeight={active ? 900 : 500}>
        {label}
      </Typography>
      <Typography fontWeight={600}>{Number(value || 0).toLocaleString()}</Typography>
    </Paper>
  );
}

function TailoringRequestSkeletonRows() {
  return Array.from({ length: 7 }).map((_, index) => (
    <TableRow key={`tailoring-request-loading-${index}`}>
      <TableCell>
        <Stack spacing={0.75}>
          <Skeleton width={90} />
          <Skeleton width={150} />
        </Stack>
      </TableCell>
      <TableCell>
        <Skeleton width="72%" />
        <Skeleton width="52%" />
      </TableCell>
      <TableCell>
        <Skeleton width={130} />
        <Skeleton width={90} />
      </TableCell>
      <TableCell><Skeleton width={96} /></TableCell>
      <TableCell><Skeleton width={54} /></TableCell>
      <TableCell>
        <Skeleton width={126} />
        <Skeleton width={90} />
      </TableCell>
      <TableCell>
        <Skeleton width={126} />
        <Skeleton width={90} />
      </TableCell>
      <TableCell align="right"><Skeleton variant="rounded" width={88} height={30} sx={{ ml: 'auto' }} /></TableCell>
    </TableRow>
  ));
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

function normalizedHttpUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url.toString() : '';
  } catch {
    return '';
  }
}

function TailoringRequestRow({ request }) {
  const resumeUrl = request.status === 'ready' && request.filePath ? `/api/bid/tailored-resumes/${encodeURIComponent(request.id)}/download` : '';
  const resumeFilename = request.filePath ? String(request.filePath).split('/').pop() || 'tailored-resume.docx' : 'tailored-resume.docx';

  return (
    <TableRow hover>
      <TableCell>
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography fontWeight={600}>#{request.id}</Typography>
            <Chip label={statusLabel(request.status)} size="small" sx={statusSx(request.status)} />
            {request.requestType === 'manual' ? <Chip label="Manual" size="small" variant="outlined" sx={{ fontWeight: 600 }} /> : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Created {formatDateTime(request.createdAt)}
          </Typography>
          {request.lastError ? (
            <Typography variant="caption" color="error" sx={{ maxWidth: 280 }}>
              {request.lastError}
            </Typography>
          ) : null}
        </Stack>
      </TableCell>
      <TableCell>
        <Stack spacing={0.25}>
          <Typography fontWeight={600}>{request.job?.title || 'Untitled role'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[request.job?.company, request.job?.location, request.job?.source].filter(Boolean).join(' · ') || 'Job details unavailable'}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography fontWeight={600}>{request.profile?.name || 'Unknown profile'}</Typography>
        <Typography variant="body2" color="text.secondary">
          {request.profile?.ownerUsername || 'Unknown owner'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography>{request.requester?.username || 'Unknown user'}</Typography>
      </TableCell>
      <TableCell>
        <Typography>
          {Number(request.attempts || 0).toLocaleString()} / {Number(request.maxAttempts || 0).toLocaleString()}
        </Typography>
      </TableCell>
      <TableCell>
        <ResumeReviewSummary review={request.review} />
      </TableCell>
      <TableCell>
        <Typography>{formatDateTime(request.updatedAt)}</Typography>
        {request.readyAt ? (
          <Typography variant="caption" color="text.secondary">
            Ready {formatDateTime(request.readyAt)}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {request.job?.url ? (
            <Tooltip title="Open job">
              <IconButton component="a" href={request.job.url} target="_blank" rel="noreferrer" size="small">
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          {resumeUrl ? (
            <Button onClick={() => downloadAuthenticatedFile(resumeUrl, resumeFilename)} size="small" startIcon={<DownloadIcon />}>
              Resume
            </Button>
          ) : null}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function ResumeReviewSummary({ review }) {
  const coverage = review?.atsKeywordCoverage;
  const confidence = review?.confidence;
  const truthfulness = review?.truthfulness || {};
  return (
    <Stack spacing={0.5} sx={{ minWidth: 180, maxWidth: 260 }}>
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Chip label={approvalLabel(review?.approval?.status)} size="small" sx={reviewChipSx(review?.approval?.status)} />
        {confidence !== undefined && confidence !== null ? (
          <Chip label={`${Math.round(Number(confidence) * 100)}% confidence`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        ) : null}
      </Stack>
      {coverage ? (
        <Typography variant="caption" color="text.secondary">
          ATS {Math.round(Number(coverage.score || 0) * 100)}% · {Number(coverage.covered?.length || 0)}/{Number(coverage.total || 0)} keywords
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary">ATS coverage unavailable</Typography>
      )}
      {truthfulness.flags?.length ? (
        <Typography variant="caption" color="error" sx={{ overflowWrap: 'anywhere' }}>
          {truthfulness.flags[0].message}
        </Typography>
      ) : (
        <Typography variant="caption" color="success.main">Truthfulness checks clear</Typography>
      )}
    </Stack>
  );
}

function approvalLabel(status) {
  if (status === 'pending_approval') return 'Needs approval';
  if (status === 'needs_review') return 'Review flags';
  if (status === 'not_ready') return 'Not ready';
  return status ? status.replace(/_/g, ' ') : 'Review';
}

function reviewChipSx(status) {
  if (status === 'pending_approval') return { bgcolor: 'rgba(0, 103, 192, 0.16)', color: '#005A9E', fontWeight: 600 };
  if (status === 'needs_review') return { bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600 };
  return { bgcolor: 'rgba(246, 248, 251, 0.86)', color: '#475569', fontWeight: 600 };
}

function statusLabel(status) {
  if (status === 'requested') return 'Queued';
  if (status === 'processing') return 'Tailoring';
  if (status === 'dead_letter') return 'Blocked';
  return status ? status.replace(/_/g, ' ') : 'Unknown';
}

function statusSx(status) {
  if (status === 'ready') return { bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 };
  if (status === 'processing') return { bgcolor: 'rgba(0, 103, 192, 0.16)', color: '#005A9E', fontWeight: 600 };
  if (status === 'requested') return { bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600 };
  if (status === 'dead_letter') return { bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600 };
  if (status === 'cancelled') return { bgcolor: '#F3E8FF', color: '#6B21A8', fontWeight: 600 };
  if (status === 'invalid') return { bgcolor: '#E5E7EB', color: '#374151', fontWeight: 600 };
  return { bgcolor: 'rgba(246, 248, 251, 0.86)', color: '#475569', fontWeight: 600 };
}
