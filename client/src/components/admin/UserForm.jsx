import AddIcon from '@mui/icons-material/Add';
import { Button, FormControl, InputLabel, MenuItem, Paper, Select, TextField } from '@mui/material';
import { canHaveDailyBidGoal, defaultDailyBidGoalForRole, roleOptionsFor } from '../../lib/roles.js';

export default function UserForm({ currentUser, form, isSaving, onChange, onSubmit }) {
  const roleOptions = roleOptionsFor(currentUser);
  const canSetDailyGoal = canHaveDailyBidGoal(form.role);

  function handleRoleChange(role) {
    onChange((current) => ({
      ...current,
      role,
      dailyBidGoal: canHaveDailyBidGoal(role) ? current.dailyBidGoal || defaultDailyBidGoalForRole(role) : '',
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
          md: 'minmax(220px, 1fr) minmax(150px, .65fr) minmax(150px, .65fr) 135px minmax(190px, .8fr) 110px auto',
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
        <InputLabel>Role</InputLabel>
        <Select label="Role" value={form.role} onChange={(event) => handleRoleChange(event.target.value)}>
          {roleOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="Timezone"
        placeholder="America/New_York"
        size="small"
        value={form.timezone || ''}
        onChange={(event) => onChange((current) => ({ ...current, timezone: event.target.value }))}
      />
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
