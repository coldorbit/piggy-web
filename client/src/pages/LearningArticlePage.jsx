import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import DiagramErrorBoundary from '../components/learning/DiagramErrorBoundary.jsx';
import { useLearningArticle } from '../lib/api.js';
import { isAdminRole } from '../lib/roles.js';

const FaqMarkdownPreview = lazy(() => import('../components/faqs/FaqMarkdownPreview.jsx'));
const ReadOnlyExcalidraw = lazy(() => import('../components/learning/ReadOnlyExcalidraw.jsx'));
const MermaidDiagram = lazy(() => import('../components/learning/MermaidDiagram.jsx'));

export default function LearningArticlePage({ currentUser }) {
  const { articleId } = useParams();
  const { data: article, isLoading, error } = useLearningArticle(articleId);
  const [activeTab, setActiveTab] = useState('article');
  const hasExcalidraw = Boolean(article?.excalidrawData?.elements?.length);
  const hasMermaid = Boolean(article?.mermaidScript?.trim());
  const hasDiagram = hasExcalidraw || hasMermaid;

  useEffect(() => {
    if (!hasDiagram) setActiveTab('article');
  }, [hasDiagram]);

  if (isLoading) return <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error || !article) return <Alert severity="error">{error?.message || 'Learning article not found.'}</Alert>;
  const context = article.category === 'companies' ? article.companyName : article.category === 'geography' ? [article.city, article.region, article.countryCode].filter(Boolean).join(', ') : humanize(article.difficulty);
  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25, boxShadow: 1 }}>
        <Button component={RouterLink} to="/learning" startIcon={<ArrowBackIcon />}>Learning Hub</Button>
        <Box sx={{ flex: 1, minWidth: 240 }}><Typography variant="h6" fontWeight={600}>{article.title}</Typography><Typography variant="body2" color="text.secondary">{humanize(article.category)}{context ? ` · ${context}` : ''}</Typography></Box>
        {article.featured ? <Chip label="Featured" color="warning" variant="outlined" /> : null}
        {isAdminRole(currentUser) ? <Button component={RouterLink} to={`/learning/${article.id}/edit`} startIcon={<EditIcon />} variant="outlined">Edit</Button> : null}
      </Paper>
      {hasDiagram ? (
        <Paper variant="outlined" sx={{ px: 1, boxShadow: 1 }}>
          <Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)} aria-label="Learning article views">
            <Tab value="article" label="Article" id="learning-tab-article" aria-controls="learning-panel-article" />
            <Tab value="diagram" label="Diagram" id="learning-tab-diagram" aria-controls="learning-panel-diagram" />
          </Tabs>
        </Paper>
      ) : null}
      <Box
        id="learning-panel-article"
        role={hasDiagram ? 'tabpanel' : undefined}
        aria-labelledby={hasDiagram ? 'learning-tab-article' : undefined}
        hidden={activeTab !== 'article'}
        sx={{ gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, gap: 1.5, alignItems: 'start', display: activeTab === 'article' ? 'grid' : 'none' }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 }, boxShadow: 1 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{article.summary}</Typography>
          <Box data-color-mode="light" sx={{ '& .wmde-markdown': { bgcolor: 'transparent', color: 'text.primary', fontSize: 14 } }}>
            <Suspense fallback={<CircularProgress size={24} />}><FaqMarkdownPreview source={article.content} /></Suspense>
          </Box>
        </Paper>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Paper variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 1, boxShadow: 1 }}>
            <Typography fontWeight={600}>Article details</Typography>
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{(article.tags || []).map((tag) => <Chip key={tag} label={tag} variant="outlined" />)}</Stack>
            <Typography variant="caption" color="text.secondary">Updated {new Date(article.updatedAt).toLocaleString()}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 0.75, boxShadow: 1 }}>
            <Typography fontWeight={600}>Sources</Typography>
            {(article.sourceLinks || []).length ? article.sourceLinks.map((source, index) => <Button key={`${source.url}-${index}`} component="a" href={source.url} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon />} sx={{ justifyContent: 'space-between', textAlign: 'left' }}>{source.label || source.url}</Button>) : <Typography variant="body2" color="text.secondary">No sources recorded.</Typography>}
          </Paper>
        </Box>
      </Box>
      {hasDiagram ? (
        <Paper
          id="learning-panel-diagram"
          role="tabpanel"
          aria-labelledby="learning-tab-diagram"
          hidden={activeTab !== 'diagram'}
          variant="outlined"
          sx={{ p: { xs: 1.5, md: 2.5 }, display: activeTab === 'diagram' ? 'grid' : 'none', gap: 2, boxShadow: 1, minWidth: 0 }}
        >
          <Box><Typography variant="h6" fontWeight={600}>Article diagrams</Typography><Typography variant="body2" color="text.secondary">Read-only visual references for {article.title}.</Typography></Box>
          {hasExcalidraw ? <DiagramSection title="Excalidraw diagram"><DiagramErrorBoundary resetKey={article.updatedAt}><Suspense fallback={<DiagramLoading />}><ReadOnlyExcalidraw scene={article.excalidrawData} title={`${article.title} Excalidraw diagram`} /></Suspense></DiagramErrorBoundary></DiagramSection> : null}
          {hasMermaid ? <DiagramSection title="Mermaid diagram"><DiagramErrorBoundary resetKey={`${article.updatedAt}-mermaid`}><Suspense fallback={<DiagramLoading />}><MermaidDiagram source={article.mermaidScript} title={`${article.title} Mermaid diagram`} /></Suspense></DiagramErrorBoundary></DiagramSection> : null}
        </Paper>
      ) : null}
    </Box>
  );
}

function DiagramSection({ title, children }) {
  return <Box component="section" sx={{ display: 'grid', gap: 1, minWidth: 0 }}><Typography variant="subtitle1" fontWeight={600}>{title}</Typography>{children}</Box>;
}

function DiagramLoading() {
  return <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>;
}

function humanize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
