import { useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import ApartmentIcon from '@mui/icons-material/Apartment';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EmptyState from '../components/common/EmptyState.jsx';
import ConfirmationDialog from '../components/common/ConfirmationDialog.jsx';
import {
  useAdminWorkspaces,
  useCreateWorkspace,
  useDeleteWorkspace,
  useUpdateWorkspace,
} from '../lib/api.js';
import { formatDateTime } from '../lib/formatters.js';

const EMPTY_WORKSPACE_FORM = { name: '', slug: '' };

export default function AdminWorkspacesPage() {
  const [form, setForm] = useState(EMPTY_WORKSPACE_FORM);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState(null);
  const [editingWorkspace, setEditingWorkspace] = useState(EMPTY_WORKSPACE_FORM);
  const [error, setError] = useState('');
  const [deletingWorkspace, setDeletingWorkspace] = useState(null);
  const { data: workspaces = [], isLoading, error: workspacesError, refetch } = useAdminWorkspaces();
  const { mutate: createWorkspace, isPending: isCreating } = useCreateWorkspace();
  const { mutate: updateWorkspace, isPending: isUpdating } = useUpdateWorkspace();
  const { mutate: deleteWorkspace, isPending: isDeleting } = useDeleteWorkspace();
  const isSaving = isCreating || isUpdating || isDeleting;
  const metrics = useMemo(() => workspaceMetrics(workspaces), [workspaces]);
  const pageError = error || workspacesError?.message || '';

  function handleCreateWorkspace(event) {
    event.preventDefault();
    setError('');
    createWorkspace(form, {
      onSuccess: () => setForm(EMPTY_WORKSPACE_FORM),
      onError: (err) => setError(err.message),
    });
  }

  function startEditingWorkspace(workspace) {
    setEditingWorkspaceId(workspace.id);
    setEditingWorkspace({ name: workspace.name, slug: workspace.slug });
    setError('');
  }

  function cancelEditingWorkspace() {
    setEditingWorkspaceId(null);
    setEditingWorkspace(EMPTY_WORKSPACE_FORM);
  }

  function handleSaveWorkspace(workspaceId) {
    setError('');
    updateWorkspace(
      { workspaceId, workspaceData: editingWorkspace },
      {
        onSuccess: cancelEditingWorkspace,
        onError: (err) => setError(err.message),
      },
    );
  }

  function handleDeleteWorkspace(workspaceId) {
    const workspace = workspaces.find((candidate) => String(candidate.id) === String(workspaceId));
    if (workspace) setDeletingWorkspace(workspace);
  }

  function deleteConfirmedWorkspace() {
    if (!deletingWorkspace) return;
    setError('');
    deleteWorkspace(deletingWorkspace.id, {
      onSuccess: () => setDeletingWorkspace(null),
      onError: (err) => setError(err.message),
    });
  }

  return (
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          gap: 1.25,
          alignItems: 'center',
          boxShadow: 2,
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(240,253,250,0.9) 46%, rgba(239,246,255,0.92))',
          borderColor: 'rgba(37, 99, 235, 0.18)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1,
              bgcolor: '#0f172a',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 10px 22px rgba(15, 23, 42, 0.18)',
              flexShrink: 0,
            }}
          >
            <ApartmentIcon />
          </Box>
          <Box minWidth={0}>
            <Typography fontWeight={600} noWrap>
              Workspace management
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Manage workspace identities and deletion readiness.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          <Metric label="Workspaces" value={metrics.workspaces} />
          <Metric label="Home users" value={metrics.users} />
          <Metric label="Profiles" value={metrics.profiles} />
          <Metric label="Shared bidders" value={metrics.memberships} />
          <Tooltip title="Refresh workspaces">
            <IconButton onClick={() => refetch()} aria-label="Refresh workspaces" sx={{ border: 1, borderColor: 'divider', bgcolor: '#fff' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <Paper
        component="form"
        variant="outlined"
        onSubmit={handleCreateWorkspace}
        sx={{
          p: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1fr) minmax(180px, .65fr) auto' },
          gap: 1.25,
          alignItems: 'center',
          boxShadow: 1,
        }}
      >
        <TextField
          label="Workspace name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
        <TextField
          label="Slug"
          value={form.slug}
          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
        />
        <Button type="submit" variant="contained" disabled={isSaving || !form.name.trim()} startIcon={<AddIcon />}>
          Add workspace
        </Button>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 1, maxHeight: { md: 'calc(100vh - 286px)' } }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Workspace</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell align="right">Home users</TableCell>
              <TableCell align="right">Profiles</TableCell>
              <TableCell align="right">Shared bidders</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? <WorkspaceSkeletonRows /> : null}
            {!isLoading && !workspaces.length ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState title="No workspaces yet" detail="Create a workspace to group users, profiles, bids, calendar entries, and bidder memberships." variant="plain" sx={{ py: 3 }} />
                </TableCell>
              </TableRow>
            ) : null}
            {workspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                editing={editingWorkspace}
                editingId={editingWorkspaceId}
                isSaving={isSaving}
                workspace={workspace}
                onCancel={cancelEditingWorkspace}
                onDelete={handleDeleteWorkspace}
                onEdit={startEditingWorkspace}
                onEditingChange={setEditingWorkspace}
                onSave={handleSaveWorkspace}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <ConfirmationDialog
        open={Boolean(deletingWorkspace)}
        title="Delete workspace?"
        description={deletingWorkspace ? `Permanently delete ${deletingWorkspace.name}? This action cannot be undone.` : ''}
        confirmLabel="Delete workspace"
        confirmColor="error"
        isPending={isDeleting}
        onClose={() => setDeletingWorkspace(null)}
        onConfirm={deleteConfirmedWorkspace}
      />
    </Box>
  );
}

function WorkspaceRow({ editing, editingId, isSaving, onCancel, onDelete, onEdit, onEditingChange, onSave, workspace }) {
  const isEditing = String(editingId || '') === String(workspace.id);
  const userCount = Number(workspace.userCount || 0);
  const membershipCount = Number(workspace.membershipCount || 0);
  const profileCount = Number(workspace.profileCount || 0);
  const canDelete = userCount === 0 && membershipCount === 0 && profileCount === 0;

  if (isEditing) {
    return (
      <TableRow hover>
        <TableCell>
          <TextField
            fullWidth
            label="Name"
            value={editing.name}
            onChange={(event) => onEditingChange((current) => ({ ...current, name: event.target.value }))}
          />
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            label="Slug"
            value={editing.slug}
            onChange={(event) => onEditingChange((current) => ({ ...current, slug: event.target.value }))}
          />
        </TableCell>
        <TableCell align="right">{userCount.toLocaleString()}</TableCell>
        <TableCell align="right">{profileCount.toLocaleString()}</TableCell>
        <TableCell align="right">{membershipCount.toLocaleString()}</TableCell>
        <TableCell>{formatDateTime(workspace.updatedAt || workspace.createdAt)}</TableCell>
        <TableCell align="right">
          <Tooltip title="Save workspace">
            <span>
              <IconButton disabled={isSaving || !editing.name.trim()} onClick={() => onSave(workspace.id)} aria-label="Save workspace">
                <SaveIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Cancel">
            <span>
              <IconButton disabled={isSaving} onClick={onCancel} aria-label="Cancel">
                <CloseIcon />
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow hover>
      <TableCell>
        <Typography fontWeight={600}>{workspace.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          ID {workspace.id}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={workspace.slug} variant="outlined" sx={{ fontWeight: 600 }} />
      </TableCell>
      <TableCell align="right">{userCount.toLocaleString()}</TableCell>
      <TableCell align="right">{profileCount.toLocaleString()}</TableCell>
      <TableCell align="right">{membershipCount.toLocaleString()}</TableCell>
      <TableCell>{formatDateTime(workspace.updatedAt || workspace.createdAt)}</TableCell>
      <TableCell align="right">
        <Tooltip title="Edit workspace">
          <span>
            <IconButton type="button" disabled={isSaving} onClick={() => onEdit(workspace)} aria-label="Edit workspace">
              <EditIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={canDelete ? 'Delete workspace' : 'Transfer users and profiles, then remove bidder memberships before deleting'}>
          <span>
            <IconButton
              color="error"
              type="button"
              disabled={isSaving || !canDelete}
              onClick={() => onDelete(workspace.id)}
              aria-label="Delete workspace"
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

function Metric({ label, value }) {
  return (
    <Box sx={{ minWidth: 92, px: 1, py: 0.55, border: 1, borderColor: 'rgba(15, 23, 42, 0.08)', borderRadius: 1, bgcolor: 'rgba(255,255,255,0.76)' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography fontWeight={600} lineHeight={1.1}>
        {Number(value || 0).toLocaleString()}
      </Typography>
    </Box>
  );
}

function WorkspaceSkeletonRows() {
  return Array.from({ length: 5 }).map((_, index) => (
    <TableRow key={`workspace-loading-${index}`}>
      <TableCell>
        <Skeleton width={160} />
        <Skeleton width={56} />
      </TableCell>
      <TableCell><Skeleton variant="rounded" width={120} height={24} /></TableCell>
      <TableCell align="right"><Skeleton width={48} sx={{ ml: 'auto' }} /></TableCell>
      <TableCell align="right"><Skeleton width={48} sx={{ ml: 'auto' }} /></TableCell>
      <TableCell align="right"><Skeleton width={48} sx={{ ml: 'auto' }} /></TableCell>
      <TableCell><Skeleton width={120} /></TableCell>
      <TableCell align="right"><Skeleton variant="rounded" width={80} height={30} sx={{ ml: 'auto' }} /></TableCell>
    </TableRow>
  ));
}

function workspaceMetrics(workspaces) {
  return workspaces.reduce(
    (totals, workspace) => ({
      workspaces: totals.workspaces + 1,
      users: totals.users + Number(workspace.userCount || 0),
      profiles: totals.profiles + Number(workspace.profileCount || 0),
      memberships: totals.memberships + Number(workspace.membershipCount || 0),
    }),
    { memberships: 0, profiles: 0, users: 0, workspaces: 0 },
  );
}
