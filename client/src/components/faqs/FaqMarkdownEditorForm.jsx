import { Box, TextField, Typography } from '@mui/material';
import MDEditor from '@uiw/react-md-editor/nohighlight';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

export default function FaqMarkdownEditorForm({ form, onChange }) {
  return (
    <Box
      component="section"
      sx={{
        display: 'grid',
        gap: 1.5,
        border: 1,
        borderColor: 'rgba(0, 0, 0, 0.09)',
        borderRadius: 1,
        bgcolor: '#FFFFFF',
        p: { xs: 1.25, sm: 1.75 },
      }}
    >
      <TextField
        label="Question"
        value={form.title}
        onChange={(event) => onChange('title', event.target.value)}
        fullWidth
        required
        size="small"
      />
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
          Answer
        </Typography>
        <Box
          data-color-mode="light"
          sx={{
            overflow: 'hidden',
            border: 1,
            borderColor: '#CBD5E1',
            borderRadius: 1,
            '& .w-md-editor': {
              boxShadow: 'none',
              borderRadius: 0,
            },
            '& .w-md-editor-content': {
              minHeight: 0,
            },
            '& .w-md-editor-text, & .w-md-editor-text-input, & .w-md-editor-preview': {
              overflowY: 'auto !important',
            },
            '& .w-md-editor-toolbar': {
              borderBottomColor: 'rgba(0, 0, 0, 0.09)',
            },
            '& .wmde-markdown': {
              fontSize: 14,
            },
          }}
        >
          <MDEditor height={520} value={form.content} onChange={(value) => onChange('content', value || '')} preview="live" />
        </Box>
      </Box>
    </Box>
  );
}
