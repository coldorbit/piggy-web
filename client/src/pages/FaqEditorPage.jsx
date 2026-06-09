import { useEffect, useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PublishIcon from '@mui/icons-material/Publish';
import SaveIcon from '@mui/icons-material/Save';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { useNavigate, useParams } from 'react-router-dom';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { useCreateFaq, useFaq, useUpdateFaq } from '../lib/api.js';

const EMPTY_FAQ = {
  title: '',
  content: '## Question\n\nWrite the answer here.',
};

export default function FaqEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const [form, setForm] = useState(EMPTY_FAQ);
  const [message, setMessage] = useState('');
  const { data: faq, isLoading, error: faqError } = useFaq(id);
  const { mutate: createFaq, isPending: isCreating } = useCreateFaq();
  const { mutate: updateFaq, isPending: isUpdating } = useUpdateFaq();
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    setHeaderSearch(EMPTY_HEADER_SEARCH);
  }, [setHeaderSearch]);

  useEffect(() => {
    if (!faq) return;
    setForm({ title: faq.title || '', content: faq.content || '' });
  }, [faq]);

  const title = useMemo(() => (isEditing ? 'Edit FAQ' : 'Create FAQ'), [isEditing]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveFaq(status) {
    setMessage('');
    const faqData = { ...form, status };
    const callbacks = {
      onSuccess: (savedFaq) => {
        if (status === 'published') {
          navigate('/faqs');
          return;
        }
        setMessage('Draft saved.');
        if (!isEditing) navigate(`/faqs/${savedFaq.id}/edit`, { replace: true });
      },
      onError: (err) => setMessage(err.message),
    };

    if (isEditing) {
      updateFaq({ faqId: id, faqData }, callbacks);
    } else {
      createFaq(faqData, callbacks);
    }
  }

  return (
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={900}>
            {title}
          </Typography>
          <Typography color="text.secondary">Draft in Markdown, then save or publish.</Typography>
        </Box>
        <Stack direction="row" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/faqs')}>
            Back
          </Button>
          <Button variant="outlined" startIcon={<SaveIcon />} disabled={isSaving} onClick={() => saveFaq('draft')}>
            Save Draft
          </Button>
          <Button variant="contained" startIcon={<PublishIcon />} disabled={isSaving} onClick={() => saveFaq('published')}>
            Publish
          </Button>
        </Stack>
      </Stack>

      {faqError ? <Alert severity="error">{faqError.message}</Alert> : null}
      {message ? <Alert severity={message === 'Draft saved.' ? 'success' : 'error'}>{message}</Alert> : null}

      {isLoading ? (
        <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box component="section" sx={{ display: 'grid', gap: 1.25 }}>
          <TextField
            label="Question"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            fullWidth
            required
          />
          <Box data-color-mode="light" sx={{ '& .w-md-editor': { boxShadow: 'none', border: '1px solid #CBD5E1' } }}>
            <MDEditor height={520} value={form.content} onChange={(value) => updateField('content', value || '')} preview="live" />
          </Box>
        </Box>
      )}
    </Box>
  );
}
