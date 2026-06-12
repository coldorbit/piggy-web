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
import { isAdminRole, isSuperadmin, roleLabel, roleOptionsFor } from '../../lib/roles.js';

export default function UsersTable({
  currentUser,
  editing,
  editingId,
  isLoading,
  saving,
  users,
  onCancel,
  onDelete,
  onEdit,
  onEditingChange,
  onSave,
}) {
  return (
    <TableContainer component={Paper} variant="outlined" aria-busy={isLoading} sx={{ boxShadow: 1 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last seen</TableCell>
            <TableCell>Last login</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? <EmptyRow title="Loading users..." /> : null}
          {!isLoading && users.length === 0 ? (
            <EmptyRow title="No users yet" detail="Created users will appear here for role and access management." />
          ) : null}
          {users.map((user) => (
            <UserRow
              key={user.id}
              currentUser={currentUser}
              editing={editing}
              editingId={editingId}
              saving={saving}
              user={user}
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
      <TableCell colSpan={8}>
        <EmptyState title={title} detail={detail} variant="plain" sx={{ py: 3 }} />
      </TableCell>
    </TableRow>
  );
}

function UserRow({ currentUser, editing, editingId, saving, user, onCancel, onDelete, onEdit, onEditingChange, onSave }) {
  const isEditing = String(editingId) === String(user.id);
  const isSelf = String(user.id) === String(currentUser.id);
  const roleOptions = roleOptionsWithCurrent(roleOptionsFor(currentUser), editing.role);
  const canEditRole = isSuperadmin(currentUser) || !isAdminRole(user);

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
              onChange={(event) => onEditingChange((current) => ({ ...current, role: event.target.value }))}
            >
              {roleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
