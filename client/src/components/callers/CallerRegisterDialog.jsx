import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

export default function CallerRegisterDialog({ callerForm, isOpen, isSaving, onChange, onClose, onSubmit }) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={onSubmit}>
        <DialogTitle>Register caller</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
          <TextField
            autoFocus
            label="Email"
            required
            type="email"
            value={callerForm.email}
            onChange={(event) => onChange({ ...callerForm, email: event.target.value })}
          />
          <TextField
            label="Username"
            required
            value={callerForm.username}
            onChange={(event) => onChange({ ...callerForm, username: event.target.value })}
          />
          <TextField
            label="Password"
            required
            type="password"
            value={callerForm.password}
            onChange={(event) => onChange({ ...callerForm, password: event.target.value })}
            helperText="Use at least 8 characters."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={isSaving} type="submit" variant="contained">
            Register
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
