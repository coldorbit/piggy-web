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
import { formatDateTime } from '../../lib/formatters.js';

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
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last seen</TableCell>
            <TableCell>Last login</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? <EmptyRow>Loading users...</EmptyRow> : null}
          {!isLoading && users.length === 0 ? <EmptyRow>No users yet.</EmptyRow> : null}
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

function EmptyRow({ children }) {
  return (
    <TableRow>
      <TableCell colSpan={7}>
        <Typography color="text.secondary">{children}</Typography>
      </TableCell>
    </TableRow>
  );
}

function UserRow({ currentUser, editing, editingId, saving, user, onCancel, onDelete, onEdit, onEditingChange, onSave }) {
  const isEditing = String(editingId) === String(user.id);
  const isSelf = user.username === currentUser.username;

  if (isEditing) {
    return (
      <TableRow hover>
        <TableCell>
          <TextField
            fullWidth
            size="small"
            value={editing.username}
            onChange={(event) => onEditingChange((current) => ({ ...current, username: event.target.value }))}
          />
        </TableCell>
        <TableCell>
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={editing.role}
              onChange={(event) => onEditingChange((current) => ({ ...current, role: event.target.value }))}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="bidder">Readonly bidder</MenuItem>
              <MenuItem value="readonly_bidder">Readonly bidder</MenuItem>
              <MenuItem value="editable_bidder">Editable bidder</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
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
      <TableCell>
        <Chip color={user.role === 'admin' ? 'warning' : 'default'} label={roleLabel(user.role)} size="small" variant="outlined" />
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

function roleLabel(role) {
  if (role === 'readonly_bidder' || role === 'bidder') return 'readonly bidder';
  if (role === 'editable_bidder') return 'editable bidder';
  return role;
}
