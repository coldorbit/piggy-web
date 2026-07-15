import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
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
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import MDEditor from '@uiw/react-md-editor/nohighlight';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import LearningImageDialog from '../components/learning/LearningImageDialog.jsx';
import { useCreateLearningArticle, useDeleteLearningArticle, useLearningArticle, useLearningCompanies, useUpdateLearningArticle } from '../lib/api.js';
import { insertLearningImage, normalizeLearningImageUrl } from './learningHub/learningArticleImages.js';

const EMPTY_ARTICLE = {
  category: 'companies', title: '', summary: '', content: '## Overview\n\nWrite the internal learning guide here.\n\n## Interview relevance\n\nExplain how the team should use this information.',
  tags: [], companyId: '', companyName: '', city: '', region: '', countryCode: '', difficulty: '', sourceLinks: [], featured: false, status: 'draft', mermaidScript: '',
};

export default function LearningEditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { articleId } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(articleId);
  const [form, setForm] = useState(() => ({
    ...EMPTY_ARTICLE,
    companyId: location.state?.companyDirectory?.id || '',
  }));
  const [excalidrawJson, setExcalidrawJson] = useState('');
  const [imageDialog, setImageDialog] = useState({ open: false, initialAlt: '', initialUrl: '' });
  const [message, setMessage] = useState('');
  const editorRef = useRef(null);
  const editorSelectionRef = useRef({ start: 0, end: 0 });
  const { data: article, isLoading, error: loadError } = useLearningArticle(articleId);
  const { data: companies = [], isLoading: companiesLoading, error: companiesError } = useLearningCompanies();
  const createArticle = useCreateLearningArticle();
  const updateArticle = useUpdateLearningArticle();
  const deleteArticle = useDeleteLearningArticle();
  const isSaving = createArticle.isPending || updateArticle.isPending || deleteArticle.isPending;
  const learningReturnTo = location.state?.learningReturnTo || '/learning';

  useEffect(() => {
    if (!article) return;
    setForm({ ...EMPTY_ARTICLE, ...article });
    setExcalidrawJson(article.excalidrawData ? JSON.stringify(article.excalidrawData, null, 2) : '');
  }, [article]);

  useEffect(() => {
    if (isEditing || form.companyId || !companies.length) return;
    const requestedCompany = searchParams.get('company');
    const company = companies.find((item) => item.slug === requestedCompany);
    if (company) setForm((current) => ({ ...current, companyId: company.id }));
  }, [companies, form.companyId, isEditing, searchParams]);

  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  function rememberEditorSelection(event) {
    editorSelectionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
  }

  function openImageDialog() {
    const textarea = editorRef.current?.querySelector('textarea');
    if (textarea) editorSelectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
    const { start, end } = editorSelectionRef.current;
    const selectedText = form.content.slice(start, end).trim();
    let initialUrl = '';
    try { initialUrl = normalizeLearningImageUrl(selectedText); } catch { /* Selected prose becomes the suggested alt text. */ }
    setImageDialog({ open: true, initialAlt: initialUrl ? '' : selectedText, initialUrl });
  }

  function insertImage(image) {
    try {
      const result = insertLearningImage(form.content, image, editorSelectionRef.current);
      change('content', result.content);
      setImageDialog((current) => ({ ...current, open: false }));
      window.requestAnimationFrame(() => {
        const textarea = editorRef.current?.querySelector('textarea');
        textarea?.focus();
        textarea?.setSelectionRange(result.cursor, result.cursor);
        editorSelectionRef.current = { start: result.cursor, end: result.cursor };
      });
    } catch (imageError) {
      setMessage(imageError.message);
    }
  }

  function save(status) {
    setMessage('');
    const payload = { ...form, excalidrawData: excalidrawJson.trim() || null, status };
    const callbacks = {
      onSuccess: (saved) => status === 'published' ? navigate(`/learning/${saved.id}`, { state: { learningReturnTo } }) : (setMessage('Draft saved.'), !isEditing && navigate(`/learning/${saved.id}/edit`, { replace: true, state: { learningReturnTo } })),
      onError: (error) => setMessage(error.message),
    };
    if (isEditing) updateArticle.mutate({ articleId, articleData: payload }, callbacks);
    else createArticle.mutate(payload, callbacks);
  }

  function remove() {
    if (!articleId || !window.confirm('Delete this learning article?')) return;
    deleteArticle.mutate(articleId, { onSuccess: () => navigate(learningReturnTo), onError: (error) => setMessage(error.message) });
  }

  if (isLoading || companiesLoading) return <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, boxShadow: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(isEditing ? `/learning/${articleId}` : learningReturnTo, { state: { learningReturnTo } })}>Back</Button>
        <Box sx={{ flex: 1, minWidth: 220 }}><Typography variant="h6" fontWeight={600}>{isEditing ? 'Edit learning article' : 'Create learning article'}</Typography><Typography variant="body2" color="text.secondary">Draft in Markdown, attach sources, then publish for internal users.</Typography></Box>
        {isEditing ? <Button color="error" startIcon={<DeleteIcon />} disabled={isSaving} onClick={remove}>Delete</Button> : null}
        <Button variant="outlined" startIcon={<SaveIcon />} disabled={isSaving} onClick={() => save('draft')}>Save draft</Button>
        <Button variant="contained" startIcon={<PublishIcon />} disabled={isSaving} onClick={() => save('published')}>Publish</Button>
      </Paper>
      {loadError ? <Alert severity="error">{loadError.message}</Alert> : null}
      {companiesError ? <Alert severity="error">{companiesError.message}</Alert> : null}
      {message ? <Alert severity={message === 'Draft saved.' ? 'success' : 'error'}>{message}</Alert> : null}
      <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 2 }, display: 'grid', gap: 1.5, boxShadow: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' }, gap: 1.5 }}>
          <FormControl><InputLabel>Library</InputLabel><Select label="Library" value={form.category} onChange={(event) => change('category', event.target.value)}><MenuItem value="companies">Companies</MenuItem><MenuItem value="geography">Geography</MenuItem><MenuItem value="machine_learning">Machine Learning</MenuItem></Select></FormControl>
          <TextField label="Article title" required value={form.title} onChange={(event) => change('title', event.target.value)} />
        </Box>
        <TextField label="Summary" required multiline minRows={2} value={form.summary} onChange={(event) => change('summary', event.target.value)} helperText="A concise explanation of what internal users will learn." />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
          {form.category === 'companies' ? <FormControl required><InputLabel>Company directory</InputLabel><Select label="Company directory" value={form.companyId || ''} onChange={(event) => change('companyId', event.target.value)}><MenuItem value="" disabled>Choose a company</MenuItem>{companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</Select></FormControl> : null}
          {form.category === 'geography' ? <><TextField label="City" value={form.city} onChange={(event) => change('city', event.target.value)} /><TextField label="State or region" value={form.region} onChange={(event) => change('region', event.target.value)} /><TextField label="Country code" inputProps={{ maxLength: 2 }} value={form.countryCode} onChange={(event) => change('countryCode', event.target.value.toUpperCase())} /></> : null}
          {form.category === 'machine_learning' ? <FormControl><InputLabel>Difficulty</InputLabel><Select label="Difficulty" value={form.difficulty || ''} onChange={(event) => change('difficulty', event.target.value)}><MenuItem value="">Not set</MenuItem><MenuItem value="foundation">Foundation</MenuItem><MenuItem value="intermediate">Intermediate</MenuItem><MenuItem value="advanced">Advanced</MenuItem><MenuItem value="staff_plus">Staff+</MenuItem></Select></FormControl> : null}
          <TextField label="Tags" value={(form.tags || []).join(', ')} onChange={(event) => change('tags', splitList(event.target.value))} helperText="Comma-separated" />
          <FormControlLabel control={<Switch checked={Boolean(form.featured)} onChange={(event) => change('featured', event.target.checked)} />} label="Feature this article" />
        </Box>
        <TextField label="Source URLs" multiline minRows={3} value={(form.sourceLinks || []).map((source) => source.url || source).join('\n')} onChange={(event) => change('sourceLinks', event.target.value.split(/\r?\n/).filter(Boolean).map((url) => ({ label: url, url })))} helperText="One public HTTP or HTTPS source per line." />
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Article content</Typography>
              <Typography variant="caption" color="text.secondary">Place the cursor where the image should appear, then insert it from a hosted URL.</Typography>
            </Box>
            <Button variant="outlined" size="small" startIcon={<ImageOutlinedIcon />} onClick={openImageDialog}>Insert image</Button>
          </Box>
          <Box ref={editorRef} data-color-mode="light" sx={{ overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 1, '& .w-md-editor': { boxShadow: 'none' } }}>
            <MDEditor
              height={560}
              value={form.content}
              onChange={(value) => change('content', value || '')}
              preview="live"
              textareaProps={{
                'aria-label': 'Article Markdown content',
                onSelect: rememberEditorSelection,
                onClick: rememberEditorSelection,
                onKeyUp: rememberEditorSelection,
              }}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5, pt: 0.5 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Optional diagrams</Typography>
            <Typography variant="body2" color="text.secondary">Paste diagram source below. Published articles render it read-only; this form does not provide a visual editor.</Typography>
          </Box>
          <TextField
            label="Excalidraw scene JSON"
            multiline
            minRows={8}
            value={excalidrawJson}
            onChange={(event) => setExcalidrawJson(event.target.value)}
            helperText="Paste the contents of an exported .excalidraw file. Leave empty to remove the diagram."
            inputProps={{ spellCheck: false }}
            sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 13 } }}
          />
          <TextField
            label="Mermaid script"
            multiline
            minRows={8}
            value={form.mermaidScript || ''}
            onChange={(event) => change('mermaidScript', event.target.value)}
            helperText="For example: flowchart LR followed by A --> B. Leave empty to remove the diagram."
            inputProps={{ spellCheck: false }}
            sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 13 } }}
          />
        </Box>
      </Paper>
      <LearningImageDialog
        open={imageDialog.open}
        initialAlt={imageDialog.initialAlt}
        initialUrl={imageDialog.initialUrl}
        onClose={() => setImageDialog((current) => ({ ...current, open: false }))}
        onInsert={insertImage}
      />
    </Box>
  );
}

function splitList(value) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
