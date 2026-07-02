import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import {
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Skeleton,
  Select,
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
import EmptyState from '../common/EmptyState.jsx';
import { formatDateTime } from '../../lib/formatters.js';
import { canHaveDailyBidGoal, defaultDailyBidGoalForRole, isAdminRole, isSuperadmin, roleLabel, roleOptionsFor } from '../../lib/roles.js';

export default function UsersTable({
  currentUser,
  editing,
  editingId,
  emptyDetail = 'Created users will appear here for role and access management.',
  emptyTitle = 'No users yet',
  isLoading,
  saving,
  sx,
  users,
  workspaces = [],
  onCancel,
  onDelete,
  onEdit,
  onEditingChange,
  onSave,
}) {
  return (
    <TableContainer component={Paper} variant="outlined" aria-busy={isLoading} sx={{ boxShadow: 1, ...sx }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Timezone</TableCell>
            <TableCell>Daily goal</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last seen</TableCell>
            <TableCell>Last login</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? <UserSkeletonRows /> : null}
          {!isLoading && users.length === 0 ? (
            <EmptyRow title={emptyTitle} detail={emptyDetail} />
          ) : null}
          {users.map((user) => (
            <UserRow
              key={user.id}
              currentUser={currentUser}
              editing={editing}
              editingId={editingId}
              saving={saving}
              user={user}
              workspaces={workspaces}
              onCancel={onCancel}
              onDelete={onDelete}
              onEdit={onEdit}
              onEditingChange={onEditingChange}
              onSave={onSave}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EmptyRow({ detail, title }) {
  return (
    <TableRow>
      <TableCell colSpan={10}>
        <EmptyState title={title} detail={detail} variant="plain" sx={{ py: 3 }} />
      </TableCell>
    </TableRow>
  );
}

function UserSkeletonRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={`user-loading-${index}`}>
      <TableCell>
        <Skeleton width={120} />
        <Skeleton width={80} />
      </TableCell>
      <TableCell><Skeleton width={180} /></TableCell>
      <TableCell><Skeleton variant="rounded" width={96} height={24} /></TableCell>
      <TableCell><Skeleton width={132} /></TableCell>
      <TableCell><Skeleton width={64} /></TableCell>
      <TableCell><Skeleton variant="rounded" width={74} height={24} /></TableCell>
      <TableCell><Skeleton width={112} /></TableCell>
      <TableCell><Skeleton width={112} /></TableCell>
      <TableCell><Skeleton width={112} /></TableCell>
      <TableCell align="right"><Skeleton variant="rounded" width={86} height={30} sx={{ ml: 'auto' }} /></TableCell>
    </TableRow>
  ));
}

function UserRow({ currentUser, editing, editingId, saving, user, workspaces, onCancel, onDelete, onEdit, onEditingChange, onSave }) {
  const isEditing = String(editingId) === String(user.id);
  const isSelf = String(user.id) === String(currentUser.id);
  const roleOptions = roleOptionsWithCurrent(roleOptionsFor(currentUser), editing.role);
  const canEditRole = isSuperadmin(currentUser) || !isAdminRole(user);
  const canSetDailyGoal = canHaveDailyBidGoal(editing.role);
  const workspaceLabel = user.workspace?.name || (user.workspaceId ? `Workspace ${user.workspaceId}` : 'Unassigned workspace');

  function handleRoleChange(role) {
    onEditingChange((current) => ({
      ...current,
      role,
      dailyBidGoal: canHaveDailyBidGoal(role) ? current.dailyBidGoal || defaultDailyBidGoalForRole(role) : '',
    }));
  }

  if (isEditing) {
    return (
      <TableRow hover>
        <TableCell>
          <TextField
            fullWidth
            label="Username"
            size="small"
            value={editing.username}
            onChange={(event) => onEditingChange((current) => ({ ...current, username: event.target.value }))}
          />
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Workspace</InputLabel>
            <Select
              label="Workspace"
              value={String(editing.workspaceId || '')}
              onChange={(event) => onEditingChange((current) => ({ ...current, workspaceId: event.target.value }))}
            >
              <MenuItem value="" disabled>
                Select workspace
              </MenuItem>
              {workspaces.map((workspace) => (
                <MenuItem key={workspace.id} value={String(workspace.id)}>
                  {workspace.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            label="Email"
            size="small"
            value={editing.email}
            onChange={(event) => onEditingChange((current) => ({ ...current, email: event.target.value }))}
          />
        </TableCell>
        <TableCell>
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={editing.role}
              disabled={!canEditRole}
              onChange={(event) => handleRoleChange(event.target.value)}
            >
              {roleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </TableCell>
        <TableCell>
          <TextField
            fullWidth
            label="Timezone"
            placeholder="America/New_York"
            size="small"
            value={editing.timezone || ''}
            onChange={(event) => onEditingChange((current) => ({ ...current, timezone: event.target.value }))}
          />
        </TableCell>
        <TableCell>
          <TextField
            disabled={!canSetDailyGoal}
            inputProps={{ min: 1, max: 1000 }}
            label="Daily goal"
            placeholder={String(defaultDailyBidGoalForRole(editing.role) || '')}
            size="small"
            type="number"
            value={canSetDailyGoal ? editing.dailyBidGoal : ''}
            onChange={(event) => onEditingChange((current) => ({ ...current, dailyBidGoal: event.target.value }))}
            sx={{ width: 110 }}
          />
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell>
          <TextField
            autoComplete="new-password"
            fullWidth
            label="New password"
            size="small"
            type="password"
            value={editing.password}
            onChange={(event) => onEditingChange((current) => ({ ...current, password: event.target.value }))}
          />
        </TableCell>
        <TableCell align="right">
          <Tooltip title="Save user">
            <span>
              <IconButton type="button" disabled={saving} onClick={() => onSave(user.id)} aria-label="Save user">
                <SaveIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Cancel">
            <span>
              <IconButton type="button" disabled={saving} onClick={onCancel} aria-label="Cancel">
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
        <Typography fontWeight={800}>{user.username}</Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {workspaceLabel}
        </Typography>
        {isSelf ? (
          <Typography variant="caption" color="text.secondary">
            Current user
          </Typography>
        ) : null}
      </TableCell>
      <TableCell>{user.email || '-'}</TableCell>
      <TableCell>
        <Chip color={isAdminRole(user) ? 'warning' : 'default'} label={roleLabel(user.role)} size="small" variant="outlined" />
      </TableCell>
      <TableCell>{user.timezone || 'America/New_York'}</TableCell>
      <TableCell>{user.dailyBidGoal ? Number(user.dailyBidGoal).toLocaleString() : '-'}</TableCell>
      <TableCell>
        <Chip
          color={user.isActive ? 'success' : 'default'}
          label={user.isActive ? 'Active' : 'Inactive'}
          size="small"
          variant={user.isActive ? 'filled' : 'outlined'}
        />
      </TableCell>
      <TableCell>{formatDateTime(user.lastSeenAt)}</TableCell>
      <TableCell>{formatDateTime(user.lastLoginAt)}</TableCell>
      <TableCell>{formatDateTime(user.updatedAt || user.createdAt)}</TableCell>
      <TableCell align="right">
        <Tooltip title="Edit user">
          <span>
            <IconButton type="button" disabled={saving} onClick={() => onEdit(user)} aria-label="Edit user">
              <EditIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={isSelf ? 'You cannot delete your own user' : 'Delete user'}>
          <span>
            <IconButton
              color="error"
              type="button"
              disabled={saving || isSelf}
              onClick={() => onDelete(user.id)}
              aria-label="Delete user"
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

function roleOptionsWithCurrent(options, role) {
  if (!role || options.some((option) => option.value === role)) return options;
  return [...options, { value: role, label: roleLabel(role) }];
}
