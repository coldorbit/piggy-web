import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import PublishIcon from '@mui/icons-material/Publish';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import MDEditor from '@uiw/react-md-editor/nohighlight';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateLearningArticle, useDeleteLearningArticle, useLearningArticle, useUpdateLearningArticle } from '../lib/api.js';

const EMPTY_ARTICLE = {
  category: 'companies', title: '', summary: '', content: '## Overview\n\nWrite the internal learning guide here.\n\n## Interview relevance\n\nExplain how the team should use this information.',
  tags: [], companyName: '', city: '', region: '', countryCode: '', difficulty: '', sourceLinks: [], featured: false, status: 'draft',
};

export default function LearningEditorPage() {
  const navigate = useNavigate();
  const { articleId } = useParams();
  const isEditing = Boolean(articleId);
  const [form, setForm] = useState(EMPTY_ARTICLE);
  const [message, setMessage] = useState('');
  const { data: article, isLoading, error: loadError } = useLearningArticle(articleId);
  const createArticle = useCreateLearningArticle();
  const updateArticle = useUpdateLearningArticle();
  const deleteArticle = useDeleteLearningArticle();
  const isSaving = createArticle.isPending || updateArticle.isPending || deleteArticle.isPending;

  useEffect(() => { if (article) setForm({ ...EMPTY_ARTICLE, ...article }); }, [article]);

  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  function save(status) {
    setMessage('');
    const payload = { ...form, status };
    const callbacks = {
      onSuccess: (saved) => status === 'published' ? navigate(`/learning/${saved.id}`) : (setMessage('Draft saved.'), !isEditing && navigate(`/learning/${saved.id}/edit`, { replace: true })),
      onError: (error) => setMessage(error.message),
    };
    if (isEditing) updateArticle.mutate({ articleId, articleData: payload }, callbacks);
    else createArticle.mutate(payload, callbacks);
  }

  function remove() {
    if (!articleId || !window.confirm('Delete this learning article?')) return;
    deleteArticle.mutate(articleId, { onSuccess: () => navigate('/learning'), onError: (error) => setMessage(error.message) });
  }

  if (isLoading) return <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, boxShadow: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(isEditing ? `/learning/${articleId}` : '/learning')}>Back</Button>
        <Box sx={{ flex: 1, minWidth: 220 }}><Typography variant="h6" fontWeight={600}>{isEditing ? 'Edit learning article' : 'Create learning article'}</Typography><Typography variant="body2" color="text.secondary">Draft in Markdown, attach sources, then publish for internal users.</Typography></Box>
        {isEditing ? <Button color="error" startIcon={<DeleteIcon />} disabled={isSaving} onClick={remove}>Delete</Button> : null}
        <Button variant="outlined" startIcon={<SaveIcon />} disabled={isSaving} onClick={() => save('draft')}>Save draft</Button>
        <Button variant="contained" startIcon={<PublishIcon />} disabled={isSaving} onClick={() => save('published')}>Publish</Button>
      </Paper>
      {loadError ? <Alert severity="error">{loadError.message}</Alert> : null}
      {message ? <Alert severity={message === 'Draft saved.' ? 'success' : 'error'}>{message}</Alert> : null}
      <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 2 }, display: 'grid', gap: 1.5, boxShadow: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' }, gap: 1.5 }}>
          <FormControl><InputLabel>Library</InputLabel><Select label="Library" value={form.category} onChange={(event) => change('category', event.target.value)}><MenuItem value="companies">Companies</MenuItem><MenuItem value="geography">Geography</MenuItem><MenuItem value="machine_learning">Machine Learning</MenuItem></Select></FormControl>
          <TextField label="Article title" required value={form.title} onChange={(event) => change('title', event.target.value)} />
        </Box>
        <TextField label="Summary" required multiline minRows={2} value={form.summary} onChange={(event) => change('summary', event.target.value)} helperText="A concise explanation of what internal users will learn." />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
          {form.category === 'companies' ? <TextField label="Company name" value={form.companyName} onChange={(event) => change('companyName', event.target.value)} /> : null}
          {form.category === 'geography' ? <><TextField label="City" value={form.city} onChange={(event) => change('city', event.target.value)} /><TextField label="State or region" value={form.region} onChange={(event) => change('region', event.target.value)} /><TextField label="Country code" inputProps={{ maxLength: 2 }} value={form.countryCode} onChange={(event) => change('countryCode', event.target.value.toUpperCase())} /></> : null}
          {form.category === 'machine_learning' ? <FormControl><InputLabel>Difficulty</InputLabel><Select label="Difficulty" value={form.difficulty || ''} onChange={(event) => change('difficulty', event.target.value)}><MenuItem value="">Not set</MenuItem><MenuItem value="foundation">Foundation</MenuItem><MenuItem value="intermediate">Intermediate</MenuItem><MenuItem value="advanced">Advanced</MenuItem><MenuItem value="staff_plus">Staff+</MenuItem></Select></FormControl> : null}
          <TextField label="Tags" value={(form.tags || []).join(', ')} onChange={(event) => change('tags', splitList(event.target.value))} helperText="Comma-separated" />
          <FormControlLabel control={<Switch checked={Boolean(form.featured)} onChange={(event) => change('featured', event.target.checked)} />} label="Feature this article" />
        </Box>
        <TextField label="Source URLs" multiline minRows={3} value={(form.sourceLinks || []).map((source) => source.url || source).join('\n')} onChange={(event) => change('sourceLinks', event.target.value.split(/\r?\n/).filter(Boolean).map((url) => ({ label: url, url })))} helperText="One public HTTP or HTTPS source per line." />
        <Box sx={{ display: 'grid', gap: 0.75 }}><Typography variant="subtitle2" color="text.secondary">Article content</Typography><Box data-color-mode="light" sx={{ overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 1, '& .w-md-editor': { boxShadow: 'none' } }}><MDEditor height={560} value={form.content} onChange={(value) => change('content', value || '')} preview="live" /></Box></Box>
      </Paper>
    </Box>
  );
}

function splitList(value) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
