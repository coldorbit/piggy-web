import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PublishIcon from '@mui/icons-material/Publish';
import SaveIcon from '@mui/icons-material/Save';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';

export default function FaqEditorToolbar({ isSaving, status, title, onBack, onPublish, onSaveDraft }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'center' }}
      spacing={1.5}
      sx={{
        border: 1,
        borderColor: '#E2E8F0',
        borderRadius: 1,
        bgcolor: '#FFFFFF',
        px: { xs: 1.25, sm: 1.75 },
        py: 1.25,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
        <Tooltip title="Back to FAQs">
          <IconButton type="button" onClick={onBack} aria-label="Back to FAQs" sx={{ border: 1, borderColor: '#CBD5E1' }}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={900} noWrap>
              {title}
            </Typography>
            <Chip label={status} size="small" color={status === 'published' ? 'success' : 'default'} />
          </Stack>
          <Typography color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
            Draft in Markdown, then save or publish.
          </Typography>
        </Box>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent={{ xs: 'stretch', md: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          disabled={isSaving}
          onClick={onSaveDraft}
          sx={{ minWidth: { sm: 132 }, width: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
        >
          Save Draft
        </Button>
        <Button
          variant="contained"
          startIcon={<PublishIcon />}
          disabled={isSaving}
          onClick={onPublish}
          sx={{ minWidth: { sm: 132 }, width: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
        >
          Publish
        </Button>
      </Stack>
    </Stack>
  );
}
