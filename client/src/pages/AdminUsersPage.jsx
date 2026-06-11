import { useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, Box, IconButton, Stack, Typography } from '@mui/material';
import UserForm from '../components/admin/UserForm.jsx';
import UsersTable from '../components/admin/UsersTable.jsx';
import { useAdminUsers, useCreateUser, useDeleteUser, useUpdateUser } from '../lib/api.js';

const EMPTY_FORM = { email: '', username: '', password: '', role: 'user' };

function normalizeRole(role) {
  return role === 'bidder' ? 'readonly_bidder' : role;
}

export default function AdminUsersPage({ currentUser }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const { data: users = [], isLoading, error: usersError, refetch } = useAdminUsers();
  const { mutate: createUser, isPending: isCreating } = useCreateUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();
  const isSaving = isCreating || isUpdating || isDeleting;

  function handleCreateUser(event) {
    event.preventDefault();
    setError('');
    createUser(form, {
      onSuccess: () => setForm(EMPTY_FORM),
      onError: (err) => setError(err.message),
    });
  }

  function handleSaveUser(userId) {
    setError('');
    updateUser(
      { userId, userData: editing },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditing(EMPTY_FORM);
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  function handleDeleteUser(userId) {
    setError('');
    deleteUser(userId, {
      onError: (err) => setError(err.message),
    });
  }

  function startEditing(user) {
    setEditingId(user.id);
    setEditing({ email: user.email || '', username: user.username, password: '', role: normalizeRole(user.role) });
  }

  return (
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Typography color="text.secondary">{users.length.toLocaleString()} back-office accounts</Typography>
        <IconButton type="button" onClick={() => refetch()} title="Refresh users">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {error || usersError ? <Alert severity="error">{error || usersError?.message}</Alert> : null}

      <UserForm currentUser={currentUser} form={form} isSaving={isSaving} onChange={setForm} onSubmit={handleCreateUser} />
      <UsersTable
        currentUser={currentUser}
        editing={editing}
        editingId={editingId}
        isLoading={isLoading}
        saving={isSaving}
        users={users}
        onCancel={() => setEditingId(null)}
        onDelete={handleDeleteUser}
        onEdit={startEditing}
        onEditingChange={setEditing}
        onSave={handleSaveUser}
      />
    </Box>
  );
}
