import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';

export default function CallersHeader({ callerCount, isLoading, onRegister }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
      <Typography color="text.secondary">
        {callerCount.toLocaleString()} caller{callerCount === 1 ? '' : 's'}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        {isLoading ? <CircularProgress size={22} /> : null}
        <Button startIcon={<PersonAddIcon />} variant="contained" onClick={onRegister}>
          Register caller
        </Button>
      </Stack>
    </Stack>
  );
}
