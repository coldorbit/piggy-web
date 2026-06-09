import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';

export default function FaqPageToolbar({ answerCount, canManageFaqs, onCreate, onRefresh }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
      <Box>
        <Typography color="text.secondary">
          {answerCount.toLocaleString()} {answerCount === 1 ? 'answer' : 'answers'}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
        <IconButton type="button" onClick={onRefresh} title="Refresh FAQs">
          <RefreshIcon />
        </IconButton>
        {canManageFaqs ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
            New FAQ
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
