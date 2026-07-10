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
  Typography,
} from '@mui/material';
import { lazy, Suspense } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useLearningArticle } from '../lib/api.js';
import { isAdminRole } from '../lib/roles.js';

const FaqMarkdownPreview = lazy(() => import('../components/faqs/FaqMarkdownPreview.jsx'));

export default function LearningArticlePage({ currentUser }) {
  const { articleId } = useParams();
  const { data: article, isLoading, error } = useLearningArticle(articleId);
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, gap: 1.5, alignItems: 'start' }}>
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
    </Box>
  );
}

function humanize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
