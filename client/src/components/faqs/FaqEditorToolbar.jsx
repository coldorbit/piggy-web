import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PublishIcon from '@mui/icons-material/Publish';
import SaveIcon from '@mui/icons-material/Save';
import { Box, Button, Stack, Typography } from '@mui/material';

export default function FaqEditorToolbar({ isSaving, title, onBack, onPublish, onSaveDraft }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
      <Box>
        <Typography variant="h6" fontWeight={900}>
          {title}
        </Typography>
        <Typography color="text.secondary">Draft in Markdown, then save or publish.</Typography>
      </Box>
      <Stack direction="row" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back
        </Button>
        <Button variant="outlined" startIcon={<SaveIcon />} disabled={isSaving} onClick={onSaveDraft}>
          Save Draft
        </Button>
        <Button variant="contained" startIcon={<PublishIcon />} disabled={isSaving} onClick={onPublish}>
          Publish
        </Button>
      </Stack>
    </Stack>
  );
}
