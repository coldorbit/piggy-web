import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

export default function SameCompanyTailoringDialog({ confirmation, onClose, onConfirm }) {
  return (
    <Dialog open={Boolean(confirmation)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Different role at same company</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1, pt: 1 }}>
        <Typography variant="body2">
          {confirmation?.message || 'A recent tailoring request already exists for this company.'}
        </Typography>
        {confirmation?.warning ? (
          <Typography color="text.secondary" variant="body2">
            Proceeding will mark the previous tailored request for {confirmation.warning.priorTitle} as invalid.
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained">Proceed intentionally</Button>
      </DialogActions>
    </Dialog>
  );
}
