import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  GlobalStyles,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import FaqMarkdownPreview from '../components/faqs/FaqMarkdownPreview.jsx';
import DiagramErrorBoundary from '../components/learning/DiagramErrorBoundary.jsx';
import { DIAGRAM_FONT_FACE, DIAGRAM_FONT_FAMILY } from '../components/learning/diagramFont.js';
import { EMPTY_PAGE_HEADER, usePageHeader } from '../components/PageHeaderContext.jsx';
import { useLearningArticle } from '../lib/api.js';

const ReadOnlyExcalidraw = lazy(() => import('../components/learning/ReadOnlyExcalidraw.jsx'));
const MermaidDiagram = lazy(() => import('../components/learning/MermaidDiagram.jsx'));

export default function LearningArticlePage() {
  const { articleId } = useParams();
  const { data: article, isLoading, error } = useLearningArticle(articleId);
  const { setPageHeader } = usePageHeader();
  const [activeTab, setActiveTab] = useState('article');
  const [activeDiagram, setActiveDiagram] = useState('excalidraw');
  const [activeSectionId, setActiveSectionId] = useState('');
  const articleScrollRef = useRef(null);
  const markdownContentRef = useRef(null);
  const headingIndexRef = useRef([]);
  const mobileNavigatorRef = useRef(null);
  const initialHashArticleRef = useRef('');
  const hasExcalidraw = Boolean(article?.excalidrawData?.elements?.length);
  const hasMermaid = Boolean(article?.mermaidScript?.trim());
  const hasDiagram = hasExcalidraw || hasMermaid;
  const sections = useMemo(() => markdownSections(article?.content || ''), [article?.content]);

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

  useEffect(() => {
    if (!sections.length) {
      setActiveSectionId('');
      return undefined;
    }
    setActiveSectionId((current) => sections.some((section) => section.id === current) ? current : sections[0].id);
    if (activeTab !== 'article') return undefined;

    const scrollPane = articleScrollRef.current;
    const markdownRoot = markdownContentRef.current;
    if (!scrollPane || !markdownRoot) return undefined;
    let updateFrame = 0;
    let indexFrame = 0;

    function stickyOffset() {
      return (mobileNavigatorRef.current?.offsetHeight || 0) + 16;
    }

    function updateActiveSection() {
      updateFrame = 0;
      const headings = headingIndexRef.current;
      if (!headings.length) return;
      let currentIndex = 0;
      let low = 0;
      let high = headings.length - 1;
      const position = scrollPane.scrollTop + stickyOffset() + 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (headings[middle].top <= position) {
          currentIndex = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      if (scrollPane.scrollHeight - scrollPane.scrollTop - scrollPane.clientHeight < 4) currentIndex = headings.length - 1;
      const nextId = headings[currentIndex].id;
      setActiveSectionId((current) => current === nextId ? current : nextId);
    }

    function scheduleActiveSectionUpdate() {
      if (!updateFrame) updateFrame = window.requestAnimationFrame(updateActiveSection);
    }

    function rebuildHeadingIndex() {
      indexFrame = 0;
      const headingElements = [...markdownRoot.querySelectorAll('h1, h2, h3, h4, h5, h6')];
      const paneTop = scrollPane.getBoundingClientRect().top;
      const scrollTop = scrollPane.scrollTop;
      sections.forEach((section, index) => {
        const element = headingElements[index];
        if (!element) return;
        element.id = section.id;
        element.dataset.articleSection = section.id;
        element.style.scrollMarginTop = `${stickyOffset()}px`;
      });
      headingIndexRef.current = sections.flatMap((section, index) => {
        const element = headingElements[index];
        if (!element) return [];
        return [{ id: section.id, element, top: element.getBoundingClientRect().top - paneTop + scrollTop }];
      });

      if (String(article?.id) !== initialHashArticleRef.current && headingElements.length) {
        initialHashArticleRef.current = String(article?.id);
        const hashId = decodeURIComponent(window.location.hash.slice(1));
        const target = headingIndexRef.current.find((heading) => heading.id === hashId);
        if (target) {
          const top = target.element.getBoundingClientRect().top - scrollPane.getBoundingClientRect().top + scrollPane.scrollTop - stickyOffset();
          scrollPane.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        }
      }
      scheduleActiveSectionUpdate();
    }

    function scheduleHeadingIndexRebuild() {
      if (!indexFrame) indexFrame = window.requestAnimationFrame(rebuildHeadingIndex);
    }

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleHeadingIndexRebuild);
    resizeObserver?.observe(markdownRoot);
    markdownRoot.addEventListener('load', scheduleHeadingIndexRebuild, true);
    window.addEventListener('resize', scheduleHeadingIndexRebuild, { passive: true });
    scrollPane.addEventListener('scroll', scheduleActiveSectionUpdate, { passive: true });
    scheduleHeadingIndexRebuild();

    return () => {
      resizeObserver?.disconnect();
      markdownRoot.removeEventListener('load', scheduleHeadingIndexRebuild, true);
      window.removeEventListener('resize', scheduleHeadingIndexRebuild);
      scrollPane.removeEventListener('scroll', scheduleActiveSectionUpdate);
      if (updateFrame) window.cancelAnimationFrame(updateFrame);
      if (indexFrame) window.cancelAnimationFrame(indexFrame);
      headingIndexRef.current = [];
    };
  }, [activeTab, article?.id, sections]);

  const navigateToSection = useCallback((sectionId, event) => {
    event.preventDefault();
    const scrollPane = articleScrollRef.current;
    const target = headingIndexRef.current.find((heading) => heading.id === sectionId);
    if (!scrollPane || !target) return;
    const offset = (mobileNavigatorRef.current?.offsetHeight || 0) + 16;
    const top = target.element.getBoundingClientRect().top - scrollPane.getBoundingClientRect().top + scrollPane.scrollTop - offset;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollPane.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    setActiveSectionId(sectionId);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${sectionId}`);
  }, []);

  if (isLoading) return <Box sx={{ height: '100%', minHeight: 0, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error || !article) return <Alert severity="error">{error?.message || 'Learning article not found.'}</Alert>;
  return (
    <Box sx={{ height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
      {hasDiagram ? <GlobalStyles styles={{ '@font-face': DIAGRAM_FONT_FACE }} /> : null}
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
        sx={{ flex: 1, minHeight: 0, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' }, gap: 1.5, alignItems: 'stretch', overflow: 'hidden', display: activeTab === 'article' ? 'grid' : 'none' }}
      >
        <Box
          ref={articleScrollRef}
          sx={{ height: '100%', minHeight: 0, minWidth: 0, display: 'grid', gap: 1.5, alignContent: 'start', overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable' }}
        >
          {sections.length > 1 ? (
            <Paper ref={mobileNavigatorRef} component="nav" aria-label="Article sections" variant="outlined" sx={{ display: { xs: 'flex', lg: 'none' }, position: 'sticky', top: 0, zIndex: 3, alignItems: 'center', gap: 0.5, p: 0.75, overflowX: 'auto', boxShadow: 1, bgcolor: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(10px)' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 0.5, flexShrink: 0 }}>Sections</Typography>
              {sections.map((section) => <SectionLink key={section.id} section={section} active={activeSectionId === section.id} compact onNavigate={navigateToSection} />)}
            </Paper>
          ) : null}
          <Paper variant="outlined" sx={{ minWidth: 0, p: { xs: 1.5, md: 2.5 }, boxShadow: 1 }}>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
              {article.featured ? <Chip label="Featured" color="warning" variant="outlined" /> : null}
              <Chip label={humanize(article.category)} variant="outlined" />
              {context ? <Chip label={context} variant="outlined" /> : null}
            </Stack>
            <Typography color="text.secondary" sx={{ mb: 2 }}>{article.summary}</Typography>
            <Box ref={markdownContentRef} data-color-mode="light" sx={markdownViewerSx}>
              <FaqMarkdownPreview source={article.content} />
            </Box>
          </Paper>
          <Box sx={{ display: { xs: 'grid', lg: 'none' }, gap: 1.5 }}>
            <ArticleDetails article={article} />
            <ArticleSources sources={article.sourceLinks} />
          </Box>
        </Box>
        <Box sx={{ display: { xs: 'none', lg: 'grid' }, height: '100%', minHeight: 0, gap: 1.5, alignContent: 'start', overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable' }}>
          {sections.length > 1 ? (
            <Paper component="nav" aria-label="Article sections" variant="outlined" sx={{ display: 'flex', flexDirection: 'column', p: 1.25, maxHeight: 'clamp(220px, 52vh, 560px)', minHeight: 0, overflow: 'hidden', boxShadow: 1 }}>
              <Typography fontWeight={600} sx={{ px: 0.75, pb: 1, flexShrink: 0 }}>On this page</Typography>
              <Box sx={{ minHeight: 0, display: 'grid', gap: 0.5, alignContent: 'start', overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable' }}>
                {sections.map((section) => <SectionLink key={section.id} section={section} active={activeSectionId === section.id} onNavigate={navigateToSection} />)}
              </Box>
            </Paper>
          ) : null}
          <ArticleDetails article={article} />
          <ArticleSources sources={article.sourceLinks} />
        </Box>
      </Box>
      {hasDiagram ? (
        <Paper
          id="learning-panel-diagram"
          role="tabpanel"
          aria-labelledby="learning-tab-diagram"
          hidden={activeTab !== 'diagram'}
          variant="outlined"
          sx={{ p: { xs: 0.75, md: 1 }, flex: 1, minHeight: 0, overflow: 'hidden', display: activeTab === 'diagram' ? 'flex' : 'none', flexDirection: 'column', gap: 0.75, boxShadow: 1, minWidth: 0, fontFamily: DIAGRAM_FONT_FAMILY }}
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

function ArticleDetails({ article }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 1, boxShadow: 1 }}>
      <Typography fontWeight={600}>Article details</Typography>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{(article.tags || []).map((tag) => <Chip key={tag} label={tag} variant="outlined" />)}</Stack>
      <Typography variant="caption" color="text.secondary">Updated {new Date(article.updatedAt).toLocaleString()}</Typography>
    </Paper>
  );
}

function ArticleSources({ sources = [] }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 0.75, boxShadow: 1 }}>
      <Typography fontWeight={600}>Sources</Typography>
      {sources.length ? sources.map((source, index) => <Button key={`${source.url}-${index}`} component="a" href={source.url} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon />} sx={{ justifyContent: 'space-between', textAlign: 'left' }}>{source.label || source.url}</Button>) : <Typography variant="body2" color="text.secondary">No sources recorded.</Typography>}
    </Paper>
  );
}

const SectionLink = memo(function SectionLink({ active, compact = false, onNavigate, section }) {
  return (
    <Button
      component="a"
      href={`#${section.id}`}
      title={section.label}
      aria-current={active ? 'location' : undefined}
      onClick={(event) => onNavigate(section.id, event)}
      size="small"
      variant={compact && active ? 'contained' : 'text'}
      sx={{
        width: compact ? 'auto' : '100%',
        minWidth: 0,
        maxWidth: compact ? 220 : '100%',
        justifyContent: 'flex-start',
        textAlign: 'left',
        textTransform: 'none',
        fontWeight: active ? 700 : 500,
        color: active ? (compact ? '#fff' : 'primary.main') : 'text.secondary',
        bgcolor: !compact && active ? 'rgba(0, 103, 192, 0.1)' : undefined,
        borderLeft: compact ? 0 : 3,
        borderColor: active ? 'primary.main' : 'transparent',
        borderRadius: 1,
        pl: compact ? 1 : 1 + section.depth * 1.5,
        pr: 1,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        lineHeight: 1.35,
        '&:hover': { bgcolor: compact ? undefined : 'rgba(0, 103, 192, 0.08)' },
      }}
    >
      {section.label}
    </Button>
  );
});

function markdownSections(source) {
  const sections = [];
  const slugCounts = new Map();
  let fence = '';

  String(source || '').split(/\r?\n/).forEach((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      fence = fence === marker ? '' : fence || marker;
      return;
    }
    if (fence) return;
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!heading) return;
    const label = plainHeadingText(heading[2]);
    if (!label) return;
    const base = slugifyHeading(label) || 'section';
    const count = slugCounts.get(base) || 0;
    slugCounts.set(base, count + 1);
    sections.push({ id: count ? `${base}-${count + 1}` : base, label, level: heading[1].length });
  });

  const baseLevel = sections.length ? Math.min(...sections.map((section) => section.level)) : 1;
  return sections.map((section) => ({ ...section, depth: Math.max(0, section.level - baseLevel) }));
}

function plainHeadingText(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function slugifyHeading(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function humanize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

const markdownViewerSx = {
  minWidth: 0,
  maxWidth: '100%',
  '& .wmde-markdown': {
    minWidth: 0,
    maxWidth: '100%',
    bgcolor: 'transparent',
    color: 'text.primary',
    fontSize: 14,
    overflowWrap: 'anywhere',
  },
  '& .wmde-markdown pre': {
    display: 'block',
    maxWidth: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    overscrollBehaviorInline: 'contain',
    scrollbarGutter: 'stable',
    whiteSpace: 'pre',
  },
  '& .wmde-markdown table': {
    display: 'block',
    width: 'max-content',
    maxWidth: '100%',
    overflowX: 'auto',
    overscrollBehaviorInline: 'contain',
    scrollbarGutter: 'stable',
  },
  '& .wmde-markdown img, & .wmde-markdown video, & .wmde-markdown svg': {
    maxWidth: '100%',
    height: 'auto',
  },
  '& .wmde-markdown a': {
    overflowWrap: 'anywhere',
  },
};
