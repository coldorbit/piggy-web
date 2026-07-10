import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

export default function ConfirmationDialog({
  confirmColor = 'primary',
  confirmLabel = 'Confirm',
  description,
  isPending = false,
  onClose,
  onConfirm,
  open = false,
  title = 'Confirm action',
}) {
  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={isPending} onClick={onClose}>Cancel</Button>
        <Button disabled={isPending} onClick={onConfirm} variant="contained" color={confirmColor} autoFocus>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
