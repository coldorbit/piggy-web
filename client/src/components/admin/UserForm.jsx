import AddIcon from '@mui/icons-material/Add';
import { Button, FormControl, InputLabel, MenuItem, Paper, Select, TextField } from '@mui/material';

export default function UserForm({ form, isSaving, onChange, onSubmit }) {
  return (
    <Paper
      component="form"
      variant="outlined"
      onSubmit={onSubmit}
      sx={{
        p: 1.5,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1fr) minmax(180px, .75fr) 140px auto' },
        gap: 1.25,
        alignItems: 'center',
        boxShadow: 1,
      }}
    >
      <TextField
        autoComplete="username"
        label="Email or username"
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
          <MenuItem value="user">User</MenuItem>
          <MenuItem value="readonly_bidder">Readonly bidder</MenuItem>
          <MenuItem value="editable_bidder">Editable bidder</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
        </Select>
      </FormControl>
      <Button type="submit" disabled={isSaving} startIcon={<AddIcon />} variant="contained">
        Add user
      </Button>
    </Paper>
  );
}
