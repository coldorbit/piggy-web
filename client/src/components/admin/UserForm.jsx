import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, ListItemText, MenuItem, Paper, Select, Switch, TextField } from '@mui/material';
import { BIDDER_ROLES, ROLES, canHaveDailyBidGoal, defaultDailyBidGoalForRole, isSuperadmin, roleOptionsFor } from '../../lib/roles.js';

export default function UserForm({ currentUser, form, isSaving, workspaces = [], onChange, onSubmit }) {
  const roleOptions = roleOptionsFor(currentUser);
  const canSetDailyGoal = canHaveDailyBidGoal(form.role);
  const canSetExtraWorkspaces = isSuperadmin(currentUser) && BIDDER_ROLES.includes(form.role);
  const canGrantProfileHub = isSuperadmin(currentUser) && form.role === ROLES.admin;

  function handleRoleChange(role) {
    onChange((current) => ({
      ...current,
      role,
      workspaceMembershipIds: BIDDER_ROLES.includes(role) ? current.workspaceMembershipIds || [] : [],
      dailyBidGoal: canHaveDailyBidGoal(role) ? current.dailyBidGoal || defaultDailyBidGoalForRole(role) : '',
      profileHubAccess: role === ROLES.admin ? Boolean(current.profileHubAccess) : false,
    }));
  }

  return (
    <Paper
      component="form"
      variant="outlined"
      onSubmit={onSubmit}
      sx={{
        p: 1.5,
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: 'minmax(180px, 1fr) minmax(150px, .65fr) minmax(150px, .65fr) minmax(150px, .65fr) 135px minmax(180px, .75fr) 110px auto',
        },
        gap: 1.25,
        alignItems: 'center',
        boxShadow: 1,
      }}
    >
      <TextField
        autoComplete="email"
        label="Email"
        size="small"
        value={form.email}
        onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))}
      />
      <TextField
        autoComplete="username"
        label="Username"
        size="small"
        value={form.username}
        onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))}
      />
      <TextField
        autoComplete="new-password"
        label="Password"
        size="small"
        type="password"
        value={form.password}
        onChange={(event) => onChange((current) => ({ ...current, password: event.target.value }))}
      />
      <FormControl size="small">
        <InputLabel>Workspace</InputLabel>
        <Select label="Workspace" value={String(form.workspaceId || '')} onChange={(event) => onChange((current) => ({ ...current, workspaceId: event.target.value }))}>
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
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <FormControl size="small">
          <InputLabel>Role</InputLabel>
          <Select label="Role" value={form.role} onChange={(event) => handleRoleChange(event.target.value)}>
            {roleOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {canGrantProfileHub ? (
          <FormControlLabel
            control={<Switch size="small" checked={Boolean(form.profileHubAccess)} onChange={(event) => onChange((current) => ({ ...current, profileHubAccess: event.target.checked }))} />}
            label="Profile Hub"
            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 12 } }}
          />
        ) : null}
      </Box>
      <TextField
        label="Timezone"
        placeholder="America/New_York"
        size="small"
        value={form.timezone || ''}
        onChange={(event) => onChange((current) => ({ ...current, timezone: event.target.value }))}
      />
      {canSetExtraWorkspaces ? (
        <AdditionalWorkspacesSelect
          homeWorkspaceId={form.workspaceId}
          value={form.workspaceMembershipIds || []}
          workspaces={workspaces}
          onChange={(workspaceMembershipIds) => onChange((current) => ({ ...current, workspaceMembershipIds }))}
        />
      ) : null}
      <TextField
        disabled={!canSetDailyGoal}
        inputProps={{ min: 1, max: 1000 }}
        label="Daily goal"
        placeholder={String(defaultDailyBidGoalForRole(form.role) || '')}
        size="small"
        type="number"
        value={canSetDailyGoal ? form.dailyBidGoal : ''}
        onChange={(event) => onChange((current) => ({ ...current, dailyBidGoal: event.target.value }))}
      />
      <Button type="submit" disabled={isSaving} startIcon={<AddIcon />} variant="contained">
        Add user
      </Button>
    </Paper>
  );
}

function AdditionalWorkspacesSelect({ homeWorkspaceId, onChange, value, workspaces }) {
  const selected = (value || []).map(String).filter((workspaceId) => String(workspaceId) !== String(homeWorkspaceId || ''));

  return (
    <FormControl size="small">
      <InputLabel>Additional workspaces</InputLabel>
      <Select
        label="Additional workspaces"
        multiple
        value={selected}
        onChange={(event) => {
          const nextValue = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;
          onChange(nextValue.map(String).filter((workspaceId) => String(workspaceId) !== String(homeWorkspaceId || '')));
        }}
        renderValue={(selectedIds) => selectedIds.map((workspaceId) => workspaceName(workspaces, workspaceId)).join(', ')}
      >
        {workspaces.map((workspace) => {
          const disabled = String(workspace.id) === String(homeWorkspaceId || '');
          return (
            <MenuItem key={workspace.id} value={String(workspace.id)} disabled={disabled}>
              <Checkbox checked={selected.includes(String(workspace.id))} />
              <ListItemText primary={workspace.name} secondary={disabled ? 'Home workspace' : null} />
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
}

function workspaceName(workspaces, workspaceId) {
  return workspaces.find((workspace) => String(workspace.id) === String(workspaceId))?.name || `Workspace ${workspaceId}`;
}
