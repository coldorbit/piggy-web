import { useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { Alert, Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Skeleton, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import SuperadminWorkspaceLens, { ALL_WORKSPACES, filterRowsByWorkspace } from '../components/admin/SuperadminWorkspaceLens.jsx';
import UserForm from '../components/admin/UserForm.jsx';
import UsersTable from '../components/admin/UsersTable.jsx';
import { useAdminUsers, useAdminWorkspaces, useCreateUser, useCreateWorkspace, useDeleteUser, useDeleteWorkspace, useUpdateUser, useUpdateWorkspace } from '../lib/api.js';
import { BIDDER_ROLES, ROLES, canHaveDailyBidGoal, defaultDailyBidGoalForRole, isSuperadmin, roleLabel, roleOptionsFor } from '../lib/roles.js';

const DEFAULT_USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
const EMPTY_FORM = { email: '', username: '', password: '', role: 'user', workspaceId: '', workspaceMembershipIds: [], dailyBidGoal: '', timezone: DEFAULT_USER_TIMEZONE };
const EMPTY_WORKSPACE_FORM = { name: '', slug: '' };
const ROLE_ORDER = [
  ROLES.superadmin,
  ROLES.admin,
  ROLES.user,
  ROLES.financeManager,
  ROLES.internal,
  ROLES.guest,
  ROLES.caller,
  ROLES.readonlyBidder,
  ROLES.editableBidder,
];
const ROLE_ACCENTS = {
  [ROLES.superadmin]: { main: '#7c3aed', dark: '#5b21b6', soft: '#ede9fe' },
  [ROLES.admin]: { main: '#d97706', dark: '#92400e', soft: '#fef3c7' },
  [ROLES.user]: { main: '#2563eb', dark: '#1d4ed8', soft: '#dbeafe' },
  [ROLES.financeManager]: { main: '#059669', dark: '#047857', soft: '#d1fae5' },
  [ROLES.internal]: { main: '#475569', dark: '#334155', soft: '#e2e8f0' },
  [ROLES.guest]: { main: '#0f766e', dark: '#115e59', soft: '#ccfbf1' },
  [ROLES.caller]: { main: '#0891b2', dark: '#0e7490', soft: '#cffafe' },
  [ROLES.readonlyBidder]: { main: '#4f46e5', dark: '#3730a3', soft: '#e0e7ff' },
  [ROLES.editableBidder]: { main: '#be185d', dark: '#9d174d', soft: '#fce7f3' },
};

function normalizeRole(role) {
  return role === 'bidder' ? 'readonly_bidder' : role;
}

export default function AdminUsersPage({ currentUser }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(EMPTY_FORM);
  const [workspaceForm, setWorkspaceForm] = useState(EMPTY_WORKSPACE_FORM);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState(null);
  const [editingWorkspace, setEditingWorkspace] = useState(EMPTY_WORKSPACE_FORM);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(ALL_WORKSPACES);
  const [error, setError] = useState('');
  const [activeRole, setActiveRole] = useState(ROLES.user);
  const superadminView = isSuperadmin(currentUser);

  const { data: users = [], isLoading, error: usersError, refetch } = useAdminUsers();
  const { data: workspaces = [], isLoading: workspacesLoading, error: workspacesError } = useAdminWorkspaces();
  const { mutate: createUser, isPending: isCreating } = useCreateUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();
  const { mutate: createWorkspace, isPending: isCreatingWorkspace } = useCreateWorkspace();
  const { mutate: updateWorkspace, isPending: isUpdatingWorkspace } = useUpdateWorkspace();
  const { mutate: deleteWorkspace, isPending: isDeletingWorkspace } = useDeleteWorkspace();
  const isSaving = isCreating || isUpdating || isDeleting || isCreatingWorkspace || isUpdatingWorkspace || isDeletingWorkspace;
  const workspaceUsers = useMemo(
    () => filterRowsByWorkspace(users, activeWorkspaceId),
    [activeWorkspaceId, users],
  );
  const roleSections = useMemo(() => roleSectionsForUsers(workspaceUsers), [workspaceUsers]);
  const activeSection = roleSections.find((section) => section.role === activeRole) || roleSections[0];
  const visibleUsers = useMemo(
    () => workspaceUsers.filter((user) => normalizeRole(user.role) === activeSection.role),
    [activeSection.role, workspaceUsers],
  );
  const createRoleValues = useMemo(() => new Set(roleOptionsFor(currentUser).map((option) => option.value)), [currentUser]);
  const canCreateActiveRole = createRoleValues.has(activeSection.role);
  const defaultWorkspaceId = activeWorkspaceId !== ALL_WORKSPACES ? activeWorkspaceId : String(workspaces[0]?.id || '');

  useEffect(() => {
    if (!canCreateActiveRole) return;
    setForm((current) => {
      const nextWorkspaceId = current.workspaceId || defaultWorkspaceId;
      if (current.role === activeSection.role && String(current.workspaceId || '') === String(nextWorkspaceId || '')) return current;
      return {
      ...current,
      role: activeSection.role,
      workspaceId: nextWorkspaceId,
      workspaceMembershipIds: BIDDER_ROLES.includes(activeSection.role) ? current.workspaceMembershipIds || [] : [],
      dailyBidGoal: canHaveDailyBidGoal(activeSection.role)
          ? current.dailyBidGoal || defaultDailyBidGoalForRole(activeSection.role)
          : '',
      };
    });
  }, [activeSection.role, canCreateActiveRole, defaultWorkspaceId]);

  useEffect(() => {
    if (activeWorkspaceId === ALL_WORKSPACES || workspaces.some((workspace) => String(workspace.id) === String(activeWorkspaceId))) return;
    setActiveWorkspaceId(ALL_WORKSPACES);
  }, [activeWorkspaceId, workspaces]);

  function handleCreateUser(event) {
    event.preventDefault();
    setError('');
    createUser({ ...form, workspaceId: form.workspaceId || defaultWorkspaceId }, {
      onSuccess: () => setForm({ ...EMPTY_FORM, role: activeSection.role, workspaceId: defaultWorkspaceId }),
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

  function handleCreateWorkspace(event) {
    event.preventDefault();
    setError('');
    createWorkspace(workspaceForm, {
      onSuccess: (workspace) => {
        setWorkspaceForm(EMPTY_WORKSPACE_FORM);
        setActiveWorkspaceId(String(workspace.id));
      },
      onError: (err) => setError(err.message),
    });
  }

  function startEditingWorkspace(workspace) {
    setEditingWorkspaceId(workspace.id);
    setEditingWorkspace({ name: workspace.name, slug: workspace.slug });
    setError('');
  }

  function handleSaveWorkspace(workspaceId) {
    setError('');
    updateWorkspace(
      { workspaceId, workspaceData: editingWorkspace },
      {
        onSuccess: () => {
          setEditingWorkspaceId(null);
          setEditingWorkspace(EMPTY_WORKSPACE_FORM);
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  function handleDeleteWorkspace(workspaceId) {
    setError('');
    deleteWorkspace(workspaceId, {
      onSuccess: () => {
        if (String(activeWorkspaceId) === String(workspaceId)) setActiveWorkspaceId(ALL_WORKSPACES);
      },
      onError: (err) => setError(err.message),
    });
  }

  function startEditing(user) {
    setEditingId(user.id);
    setEditing({
      email: user.email || '',
      username: user.username,
      password: '',
      role: normalizeRole(user.role),
      workspaceId: user.workspaceId || '',
      workspaceMembershipIds: (user.workspaceMemberships || []).map((membership) => String(membership.workspaceId)),
      dailyBidGoal: user.dailyBidGoal ?? '',
      timezone: user.timezone || DEFAULT_USER_TIMEZONE,
    });
  }

  function handleRoleChange(role) {
    setActiveRole(role);
    setEditingId(null);
    setEditing(EMPTY_FORM);
    setError('');
  }

  return (
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {error || usersError || workspacesError ? <Alert severity="error">{error || usersError?.message || workspacesError?.message}</Alert> : null}
      {superadminView ? (
        <SuperadminWorkspaceLens
          activeWorkspaceId={activeWorkspaceId}
          isLoading={workspacesLoading}
          rows={users}
          subtitle={`${visibleUsers.length.toLocaleString()} ${activeSection.label} accounts in view`}
          title="User workspaces"
          workspaces={workspaces}
          metrics={[
            { label: 'Active', value: workspaceUsers.filter((user) => user.isActive).length },
            { label: 'Admins', value: workspaceUsers.filter((user) => [ROLES.superadmin, ROLES.admin].includes(user.role)).length },
          ]}
          onWorkspaceChange={(value) => {
            setActiveWorkspaceId(value);
            setEditingId(null);
            setError('');
          }}
        />
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)', xl: '240px minmax(0, 1fr)' },
          gap: 1.5,
          alignItems: 'stretch',
          height: { xs: 'auto', md: superadminView ? 'calc(100vh - 214px)' : 'calc(100vh - 108px)', xl: superadminView ? 'calc(100vh - 230px)' : 'calc(100vh - 124px)' },
          minHeight: { md: 0 },
          minWidth: 0,
        }}
      >
        <UserRoleTabs
          activeRole={activeSection.role}
          isLoading={isLoading}
          roles={roleSections}
          onRoleChange={handleRoleChange}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, minWidth: 0 }}>
          <WorkspacePanel
            activeWorkspaceId={activeWorkspaceId}
            editingWorkspace={editingWorkspace}
            editingWorkspaceId={editingWorkspaceId}
            form={workspaceForm}
            isLoading={workspacesLoading}
            isSaving={isSaving}
            workspaces={workspaces}
            onActiveWorkspaceChange={(value) => {
              setActiveWorkspaceId(value);
              setEditingId(null);
            }}
            onCancelEdit={() => {
              setEditingWorkspaceId(null);
              setEditingWorkspace(EMPTY_WORKSPACE_FORM);
            }}
            onCreate={handleCreateWorkspace}
            onDelete={handleDeleteWorkspace}
            onEdit={startEditingWorkspace}
            onEditingChange={setEditingWorkspace}
            onFormChange={setWorkspaceForm}
            onSave={handleSaveWorkspace}
          />
          <Paper
            variant="outlined"
            sx={{
              px: 1.25,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
              boxShadow: 1,
              flexShrink: 0,
            }}
          >
            <Box minWidth={0}>
              <Typography fontWeight={900}>{titleCase(activeSection.label)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {visibleUsers.length.toLocaleString()} of {workspaceUsers.length.toLocaleString()} back-office accounts
              </Typography>
            </Box>
            <IconButton type="button" onClick={() => refetch()} title="Refresh users" aria-label="Refresh users">
              <RefreshIcon />
            </IconButton>
          </Paper>
          {canCreateActiveRole ? (
            <UserForm currentUser={currentUser} form={form} isSaving={isSaving || !workspaces.length} workspaces={workspaces} onChange={setForm} onSubmit={handleCreateUser} />
          ) : null}
          <UsersTable
            currentUser={currentUser}
            editing={editing}
            editingId={editingId}
            emptyDetail={`No ${activeSection.label} accounts belong to this role yet.`}
            emptyTitle={`No ${activeSection.label} users`}
            isLoading={isLoading}
            saving={isSaving}
            sx={{ flex: 1, minHeight: 0 }}
            users={visibleUsers}
            workspaces={workspaces}
            onCancel={() => setEditingId(null)}
            onDelete={handleDeleteUser}
            onEdit={startEditing}
            onEditingChange={setEditing}
            onSave={handleSaveUser}
          />
        </Box>
      </Box>
    </Box>
  );
}

function WorkspacePanel({
  activeWorkspaceId,
  editingWorkspace,
  editingWorkspaceId,
  form,
  isLoading,
  isSaving,
  workspaces,
  onActiveWorkspaceChange,
  onCancelEdit,
  onCreate,
  onDelete,
  onEdit,
  onEditingChange,
  onFormChange,
  onSave,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        display: 'grid',
        gap: 1,
        boxShadow: 1,
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box minWidth={0}>
          <Typography fontWeight={900}>Workspaces</Typography>
          <Typography variant="body2" color="text.secondary">
            {workspaces.length.toLocaleString()} workspace{workspaces.length === 1 ? '' : 's'}
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>View users</InputLabel>
          <Select label="View users" value={String(activeWorkspaceId)} onChange={(event) => onActiveWorkspaceChange(event.target.value)}>
            <MenuItem value={ALL_WORKSPACES}>All workspaces</MenuItem>
            {workspaces.map((workspace) => (
              <MenuItem key={workspace.id} value={String(workspace.id)}>
                {workspace.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box component="form" onSubmit={onCreate} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 1fr) minmax(160px, .7fr) auto' }, gap: 1 }}>
        <TextField
          label="Workspace name"
          size="small"
          value={form.name}
          onChange={(event) => onFormChange((current) => ({ ...current, name: event.target.value }))}
        />
        <TextField
          label="Slug"
          size="small"
          value={form.slug}
          onChange={(event) => onFormChange((current) => ({ ...current, slug: event.target.value }))}
        />
        <Button type="submit" variant="outlined" disabled={isSaving || !form.name.trim()} startIcon={<AddIcon />}>
          Add
        </Button>
      </Box>

      {isLoading ? (
        <Skeleton variant="rounded" height={38} />
      ) : (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {workspaces.map((workspace) => {
            const isEditing = String(editingWorkspaceId || '') === String(workspace.id);
            const canDelete = Number(workspace.userCount || 0) === 0;
            return isEditing ? (
              <Box key={workspace.id} sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  label="Name"
                  size="small"
                  value={editingWorkspace.name}
                  onChange={(event) => onEditingChange((current) => ({ ...current, name: event.target.value }))}
                />
                <TextField
                  label="Slug"
                  size="small"
                  value={editingWorkspace.slug}
                  onChange={(event) => onEditingChange((current) => ({ ...current, slug: event.target.value }))}
                />
                <Tooltip title="Save workspace">
                  <span>
                    <IconButton disabled={isSaving || !editingWorkspace.name.trim()} onClick={() => onSave(workspace.id)} aria-label="Save workspace">
                      <SaveIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button type="button" size="small" onClick={onCancelEdit}>Cancel</Button>
              </Box>
            ) : (
              <Chip
                key={workspace.id}
                label={`${workspace.name} · ${Number(workspace.userCount || 0).toLocaleString()} users`}
                variant={String(activeWorkspaceId) === String(workspace.id) ? 'filled' : 'outlined'}
                onClick={() => onActiveWorkspaceChange(String(workspace.id))}
                onDelete={canDelete ? () => onDelete(workspace.id) : undefined}
                deleteIcon={canDelete ? <DeleteIcon /> : undefined}
                sx={{ fontWeight: 800 }}
              />
            );
          })}
          {workspaces.map((workspace) => (
            <Button key={`edit-${workspace.id}`} type="button" size="small" onClick={() => onEdit(workspace)}>
              Edit {workspace.name}
            </Button>
          ))}
        </Box>
      )}
    </Paper>
  );
}

function UserRoleTabs({ activeRole, isLoading, roles, onRoleChange }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const activeColor = roleColor(activeRole);

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        overflow: 'hidden',
        boxShadow: 1,
        alignSelf: 'stretch',
        height: { xs: 'auto', md: '100%' },
        minHeight: 0,
      }}
    >
      <Box sx={{ px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
          Roles
        </Typography>
      </Box>
      {isLoading && !roles.some((role) => role.count) ? (
        <RoleTabSkeletons />
      ) : (
        <Tabs
          orientation={isDesktop ? 'vertical' : 'horizontal'}
          value={activeRole}
          onChange={(_event, value) => onRoleChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            bgcolor: 'rgba(255, 255, 255, 0.72)',
            '& .MuiTabs-indicator': { backgroundColor: activeColor.main },
            '& .MuiTabs-scroller': {
              overflowY: { md: 'auto !important' },
            },
            '& .MuiTabs-flexContainer': {
              alignItems: 'stretch',
            },
            '& .MuiTab-root': {
              minHeight: 64,
              alignItems: isDesktop ? 'stretch' : 'center',
              borderRadius: 0,
              borderBottom: isDesktop ? 1 : 0,
              borderRight: isDesktop ? 0 : 1,
              borderColor: 'divider',
              px: 1.25,
              py: 1,
            },
          }}
        >
          {roles.map((role) => {
            const color = roleColor(role.role);
            return (
              <Tab
                key={role.role}
                value={role.role}
                label={<RoleTabLabel role={role} />}
                sx={{
                  color: color.dark,
                  fontWeight: 800,
                  textAlign: 'left',
                  '&.Mui-selected': {
                    color: color.dark,
                    backgroundColor: color.soft,
                  },
                }}
              />
            );
          })}
        </Tabs>
      )}
    </Paper>
  );
}

function RoleTabLabel({ role }) {
  const color = roleColor(role.role);

  return (
    <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'stretch', minWidth: 0, width: '100%' }}>
      <Typography component="span" variant="body2" fontWeight={900} noWrap sx={{ minWidth: 0 }}>
        {titleCase(role.label)}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        <Chip
          label={`${role.count.toLocaleString()} total`}
          size="small"
          sx={{ height: 20, fontSize: 11, fontWeight: 900, bgcolor: color.soft, color: color.dark, '& .MuiChip-label': { px: 0.75 } }}
        />
        {role.activeCount ? (
          <Chip
            label={`${role.activeCount.toLocaleString()} active`}
            size="small"
            sx={{ height: 20, fontSize: 11, fontWeight: 900, bgcolor: '#dcfce7', color: '#166534', '& .MuiChip-label': { px: 0.75 } }}
          />
        ) : null}
      </Box>
    </Box>
  );
}

function RoleTabSkeletons() {
  return (
    <Box sx={{ display: 'grid', alignContent: 'start' }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Box key={`user-role-loading-${index}`} sx={{ minHeight: 64, px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Skeleton width="68%" />
          <Skeleton width="46%" />
        </Box>
      ))}
    </Box>
  );
}

function roleSectionsForUsers(users) {
  const counts = new Map();
  for (const user of users) {
    const role = normalizeRole(user.role);
    const current = counts.get(role) || { role, label: roleLabel(role), count: 0, activeCount: 0 };
    current.count += 1;
    if (user.isActive) current.activeCount += 1;
    counts.set(role, current);
  }

  const orderedRoles = [...ROLE_ORDER, ...[...counts.keys()].filter((role) => !ROLE_ORDER.includes(role))];
  return orderedRoles.map((role) => counts.get(role) || { role, label: roleLabel(role), count: 0, activeCount: 0 });
}

function roleColor(role) {
  return ROLE_ACCENTS[role] || { main: '#64748b', dark: '#334155', soft: '#f1f5f9' };
}

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
}
