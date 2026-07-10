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
import { useParams } from 'react-router-dom';
import DiagramErrorBoundary from '../components/learning/DiagramErrorBoundary.jsx';
import { EMPTY_PAGE_HEADER, usePageHeader } from '../components/PageHeaderContext.jsx';
import { useLearningArticle } from '../lib/api.js';

const FaqMarkdownPreview = lazy(() => import('../components/faqs/FaqMarkdownPreview.jsx'));
const ReadOnlyExcalidraw = lazy(() => import('../components/learning/ReadOnlyExcalidraw.jsx'));
const MermaidDiagram = lazy(() => import('../components/learning/MermaidDiagram.jsx'));

export default function LearningArticlePage() {
  const { articleId } = useParams();
  const { data: article, isLoading, error } = useLearningArticle(articleId);
  const { setPageHeader } = usePageHeader();
  const [activeTab, setActiveTab] = useState('article');
  const [activeDiagram, setActiveDiagram] = useState('excalidraw');
  const hasExcalidraw = Boolean(article?.excalidrawData?.elements?.length);
  const hasMermaid = Boolean(article?.mermaidScript?.trim());
  const hasDiagram = hasExcalidraw || hasMermaid;

  useEffect(() => {
    if (!hasDiagram) setActiveTab('article');
  }, [hasDiagram]);

  useEffect(() => {
    if (hasExcalidraw && !hasMermaid) setActiveDiagram('excalidraw');
    if (!hasExcalidraw && hasMermaid) setActiveDiagram('mermaid');
  }, [hasExcalidraw, hasMermaid]);

  const context = article?.category === 'companies' ? article.companyName : article?.category === 'geography' ? [article.city, article.region, article.countryCode].filter(Boolean).join(', ') : humanize(article?.difficulty);
  const headerSubtitle = article ? `${humanize(article.category)}${context ? ` · ${context}` : ''}` : '';

  useEffect(() => {
    if (!article?.title) return undefined;
    setPageHeader({ title: article.title, subtitle: headerSubtitle });
    return () => setPageHeader(EMPTY_PAGE_HEADER);
  }, [article?.title, headerSubtitle, setPageHeader]);

  if (isLoading) return <Box sx={{ height: '100%', minHeight: 0, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error || !article) return <Alert severity="error">{error?.message || 'Learning article not found.'}</Alert>;
  return (
    <Box sx={{ height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
      {hasDiagram ? (
        <Paper variant="outlined" sx={{ px: 1, boxShadow: 1, flexShrink: 0 }}>
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
        sx={{ flex: 1, minHeight: 0, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' }, gap: 1.5, alignItems: 'start', alignContent: 'start', overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', display: activeTab === 'article' ? 'grid' : 'none', pr: 0.5 }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 }, boxShadow: 1 }}>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
            {article.featured ? <Chip label="Featured" color="warning" variant="outlined" /> : null}
            <Chip label={humanize(article.category)} variant="outlined" />
            {context ? <Chip label={context} variant="outlined" /> : null}
          </Stack>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{article.summary}</Typography>
          <Box data-color-mode="light" sx={{ '& .wmde-markdown': { bgcolor: 'transparent', color: 'text.primary', fontSize: 14 } }}>
            <Suspense fallback={<CircularProgress size={24} />}><FaqMarkdownPreview source={article.content} /></Suspense>
          </Box>
        </Paper>
        <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
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
          sx={{ p: { xs: 0.75, md: 1 }, flex: 1, minHeight: 0, overflow: 'hidden', display: activeTab === 'diagram' ? 'flex' : 'none', flexDirection: 'column', gap: 0.75, boxShadow: 1, minWidth: 0 }}
        >
          {hasExcalidraw && hasMermaid ? (
            <Tabs value={activeDiagram} onChange={(_event, value) => setActiveDiagram(value)} aria-label="Diagram formats" sx={{ minHeight: 36, flexShrink: 0, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}>
              <Tab value="excalidraw" label="Excalidraw" />
              <Tab value="mermaid" label="Mermaid" />
            </Tabs>
          ) : null}
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            {activeDiagram === 'excalidraw' && hasExcalidraw ? <DiagramErrorBoundary resetKey={article.updatedAt}><Suspense fallback={<DiagramLoading />}><ReadOnlyExcalidraw scene={article.excalidrawData} title={`${article.title} Excalidraw diagram`} /></Suspense></DiagramErrorBoundary> : null}
            {activeDiagram === 'mermaid' && hasMermaid ? <DiagramErrorBoundary resetKey={`${article.updatedAt}-mermaid`}><Suspense fallback={<DiagramLoading />}><MermaidDiagram source={article.mermaidScript} title={`${article.title} Mermaid diagram`} /></Suspense></DiagramErrorBoundary> : null}
          </Box>
        </Paper>
      ) : null}
    </Box>
  );
}

function DiagramLoading() {
  return <Box sx={{ height: '100%', minHeight: 0, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>;
}

function humanize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
