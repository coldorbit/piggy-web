import { Box, TextField } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

export default function FaqMarkdownEditorForm({ form, onChange }) {
  return (
    <Box component="section" sx={{ display: 'grid', gap: 1.25 }}>
      <TextField
        label="Question"
        value={form.title}
        onChange={(event) => onChange('title', event.target.value)}
        fullWidth
        required
      />
      <Box data-color-mode="light" sx={{ '& .w-md-editor': { boxShadow: 'none', border: '1px solid #CBD5E1' } }}>
        <MDEditor height={520} value={form.content} onChange={(value) => onChange('content', value || '')} preview="live" />
      </Box>
    </Box>
  );
}
