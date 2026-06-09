import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import FaqEditorToolbar from '../components/faqs/FaqEditorToolbar.jsx';
import FaqMarkdownEditorForm from '../components/faqs/FaqMarkdownEditorForm.jsx';
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
      <FaqEditorToolbar
        isSaving={isSaving}
        status={faq?.status || 'draft'}
        title={title}
        onBack={() => navigate('/faqs')}
        onPublish={() => saveFaq('published')}
        onSaveDraft={() => saveFaq('draft')}
      />

      {faqError ? <Alert severity="error">{faqError.message}</Alert> : null}
      {message ? <Alert severity={message === 'Draft saved.' ? 'success' : 'error'}>{message}</Alert> : null}

      {isLoading ? (
        <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <FaqMarkdownEditorForm form={form} onChange={updateField} />
      )}
    </Box>
  );
}
