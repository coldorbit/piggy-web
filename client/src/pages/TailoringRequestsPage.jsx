import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
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
import { useMemo, useState } from 'react';
import { authUrl, useTailoringRequests } from '../lib/api.js';
import { formatDateTime } from '../lib/formatters.js';

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'dead_letter', label: 'Dead letter' },
  { value: 'invalid', label: 'Invalid' },
];

export default function TailoringRequestsPage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const filters = useMemo(() => ({ status, search, page: page + 1, limit: rowsPerPage }), [page, rowsPerPage, search, status]);
  const { data, isFetching, isLoading, error, refetch } = useTailoringRequests(filters);
  const requests = data?.requests || [];
  const statusCounts = data?.statusCounts || {};
  const totalCount = Object.values(statusCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const filteredCount = Number(data?.total || 0);

  function handleStatusChange(nextStatus) {
    setStatus(nextStatus);
    setPage(0);
  }

  function handleSearchChange(nextSearch) {
    setSearch(nextSearch);
    setPage(0);
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {error ? <Alert severity="error">{error.message}</Alert> : null}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} justifyContent="space-between">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: 0 }}>
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
            sx={{ width: { xs: '100%', sm: 190 } }}
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Search"
            placeholder="Role, company, profile, user, URL"
            size="small"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            sx={{ width: { xs: '100%', sm: 360 } }}
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
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'space-between', lg: 'flex-end' }}>
          <Typography color="text.secondary">
            {filteredCount.toLocaleString()} matching{totalCount ? ` · ${totalCount.toLocaleString()} total` : ''}
          </Typography>
          <IconButton type="button" onClick={() => refetch()} title="Refresh tailoring requests">
            {isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(5, minmax(0, 1fr))' }, gap: 1 }}>
        {statusOptions.slice(1).map((option) => (
          <Paper key={option.value} variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {option.label}
            </Typography>
            <Typography fontWeight={900}>{Number(statusCounts[option.value] || 0).toLocaleString()}</Typography>
          </Paper>
        ))}
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table size="small" sx={{ minWidth: 1120 }}>
          <TableHead>
            <TableRow>
              <TableCell>Request</TableCell>
              <TableCell>Job</TableCell>
              <TableCell>Profile</TableCell>
              <TableCell>Requester</TableCell>
              <TableCell>Attempts</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                    <CircularProgress size={22} />
                    <Typography color="text.secondary">Loading tailoring requests...</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && !requests.length ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No tailoring requests match these filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {requests.map((request) => (
              <TailoringRequestRow key={request.id} request={request} />
            ))}
          </TableBody>
        </Table>
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
      </TableContainer>
    </Box>
  );
}

function TailoringRequestRow({ request }) {
  const resumeUrl = request.status === 'ready' && request.filePath ? authUrl(`/api/bid/tailored-resumes/${encodeURIComponent(request.id)}/download`) : '';

  return (
    <TableRow hover>
      <TableCell>
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography fontWeight={900}>#{request.id}</Typography>
            <Chip label={statusLabel(request.status)} size="small" sx={statusSx(request.status)} />
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
          <Typography fontWeight={800}>{request.job?.title || 'Untitled role'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[request.job?.company, request.job?.location, request.job?.source].filter(Boolean).join(' · ') || 'Job details unavailable'}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography fontWeight={800}>{request.profile?.name || 'Unknown profile'}</Typography>
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
            <Button component="a" href={resumeUrl} size="small" startIcon={<DownloadIcon />} download>
              Resume
            </Button>
          ) : null}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function statusLabel(status) {
  if (status === 'dead_letter') return 'Dead letter';
  return status ? status.replace(/_/g, ' ') : 'Unknown';
}

function statusSx(status) {
  if (status === 'ready') return { bgcolor: '#DCFCE7', color: '#166534', fontWeight: 800 };
  if (status === 'processing') return { bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 800 };
  if (status === 'requested') return { bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 800 };
  if (status === 'dead_letter') return { bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 800 };
  if (status === 'invalid') return { bgcolor: '#E5E7EB', color: '#374151', fontWeight: 800 };
  return { bgcolor: '#F8FAFC', color: '#475569', fontWeight: 800 };
}
