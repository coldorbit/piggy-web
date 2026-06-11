import AddIcon from '@mui/icons-material/Add';
import { Button, FormControl, InputLabel, MenuItem, Paper, Select, TextField } from '@mui/material';
import { roleOptionsFor } from '../../lib/roles.js';

export default function UserForm({ currentUser, form, isSaving, onChange, onSubmit }) {
  const roleOptions = roleOptionsFor(currentUser);
  return (
    <Paper
      component="form"
      variant="outlined"
      onSubmit={onSubmit}
      sx={{
        p: 1.5,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1fr) minmax(180px, .75fr) minmax(180px, .75fr) 140px auto' },
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
        <Select label="Role" value={form.role} onChange={(event) => onChange((current) => ({ ...current, role: event.target.value }))}>
          {roleOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button type="submit" disabled={isSaving} startIcon={<AddIcon />} variant="contained">
        Add user
      </Button>
    </Paper>
  );
}
