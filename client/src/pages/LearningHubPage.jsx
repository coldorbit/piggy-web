import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import EditIcon from '@mui/icons-material/Edit';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PublicIcon from '@mui/icons-material/Public';
import StarIcon from '@mui/icons-material/Star';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { useLearningArticles } from '../lib/api.js';
import { isAdminRole } from '../lib/roles.js';

const CATEGORIES = [
  { id: 'all', label: 'All learning', detail: 'Everything available to the internal team', icon: MenuBookIcon, color: '#0067C0', soft: 'rgba(0, 103, 192, 0.10)' },
  { id: 'companies', label: 'Companies', detail: 'Products, business models, teams, and interview context', icon: BusinessIcon, color: '#7C3AED', soft: '#F5F3FF' },
  { id: 'geography', label: 'Geography', detail: 'Cities, states, regions, local context, and logistics', icon: PublicIcon, color: '#0E7A3E', soft: '#ECFDF5' },
  { id: 'machine_learning', label: 'Machine Learning', detail: 'ML foundations, systems, leadership, and Staff+ interviews', icon: PsychologyIcon, color: '#C77700', soft: '#FFFBEB' },
];

export default function LearningHubPage({ currentUser }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get('category') || 'all';
  const activeCategory = CATEGORIES.some((category) => category.id === requestedCategory) ? requestedCategory : 'all';
  const [search, setSearch] = useState('');
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { data: articles = [], isLoading, error, refetch } = useLearningArticles();
  const canManage = isAdminRole(currentUser);

  useEffect(() => {
    setHeaderSearch({ isVisible: true, placeholder: 'Search the Learning Hub', value: search, onChange: setSearch });
  }, [search, setHeaderSearch]);

  useEffect(() => () => setHeaderSearch(EMPTY_HEADER_SEARCH), [setHeaderSearch]);

  const categoryCounts = useMemo(() => {
    const counts = { all: articles.length };
    for (const article of articles) counts[article.category] = (counts[article.category] || 0) + 1;
    return counts;
  }, [articles]);
  const visibleArticles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return articles.filter((article) => {
      if (activeCategory !== 'all' && article.category !== activeCategory) return false;
      if (!needle) return true;
      return [article.title, article.summary, article.content, article.companyName, article.city, article.region, ...(article.tags || [])]
        .filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [activeCategory, articles, search]);

  function selectCategory(category) {
    const next = new URLSearchParams(searchParams);
    if (category === 'all') next.delete('category');
    else next.set('category', category);
    setSearchParams(next, { replace: true });
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, boxShadow: 1 }}>
        <Box minWidth={0}>
          <Typography variant="h6" fontWeight={600}>Internal knowledge library</Typography>
          <Typography variant="body2" color="text.secondary">Learn the companies, places, and ML concepts needed for stronger interview preparation.</Typography>
        </Box>
        <Stack direction="row" spacing={0.75}>
          <Button onClick={() => refetch()} variant="outlined">Refresh</Button>
          {canManage ? <Button component={RouterLink} to="/learning/create" startIcon={<AddIcon />} variant="contained">New article</Button> : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error.message}</Alert> : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
        {CATEGORIES.filter((category) => category.id !== 'all').map((category) => {
          const Icon = category.icon;
          const selected = activeCategory === category.id;
          return (
            <Card key={category.id} variant="outlined" sx={{ borderColor: selected ? category.color : 'divider', boxShadow: selected ? `0 0 0 2px ${category.soft}` : 1 }}>
              <CardActionArea onClick={() => selectCategory(selected ? 'all' : category.id)} sx={{ height: '100%', p: 0.25 }}>
                <CardContent sx={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) max-content', gap: 1.25, alignItems: 'center' }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: category.soft, color: category.color }}><Icon /></Box>
                  <Box minWidth={0}><Typography fontWeight={600}>{category.label}</Typography><Typography variant="caption" color="text.secondary">{category.detail}</Typography></Box>
                  <Chip label={categoryCounts[category.id] || 0} sx={{ bgcolor: category.soft, color: category.color }} />
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, boxShadow: 1 }}>
        <Box><Typography fontWeight={600}>{CATEGORIES.find((category) => category.id === activeCategory)?.label}</Typography><Typography variant="body2" color="text.secondary">{visibleArticles.length.toLocaleString()} articles</Typography></Box>
        {activeCategory !== 'all' ? <Button onClick={() => selectCategory('all')}>Show all learning</Button> : null}
      </Paper>

      {isLoading ? <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : null}
      {!isLoading && !visibleArticles.length ? <EmptyState title={search ? 'No learning articles found' : 'No articles in this library'} detail={search ? 'Try another search term or category.' : canManage ? 'Publish the first internal learning article.' : 'Published learning content will appear here.'} /> : null}
      {!isLoading && visibleArticles.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
          {visibleArticles.map((article) => <LearningArticleCard key={article.id} article={article} canManage={canManage} onOpen={() => navigate(`/learning/${article.id}`)} />)}
        </Box>
      ) : null}
    </Box>
  );
}

function LearningArticleCard({ article, canManage, onOpen }) {
  const category = CATEGORIES.find((item) => item.id === article.category) || CATEGORIES[0];
  const Icon = category.icon;
  const context = article.category === 'companies' ? article.companyName : article.category === 'geography' ? [article.city, article.region, article.countryCode].filter(Boolean).join(', ') : humanize(article.difficulty);
  return (
    <Card variant="outlined" sx={{ borderTop: `3px solid ${category.color}`, boxShadow: 1, display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onOpen} sx={{ flex: 1, alignItems: 'stretch' }}>
        <CardContent sx={{ display: 'grid', gap: 1.1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}><Icon sx={{ color: category.color }} fontSize="small" /><Typography variant="caption" color="text.secondary" fontWeight={600}>{category.label}</Typography></Stack>
            <Stack direction="row" spacing={0.5}>{article.featured ? <StarIcon sx={{ color: '#C77700', fontSize: 19 }} /> : null}{canManage ? <Chip label={article.status} color={article.status === 'published' ? 'success' : 'default'} /> : null}</Stack>
          </Box>
          <Box><Typography fontWeight={600}>{article.title}</Typography>{context ? <Typography variant="caption" color="text.secondary">{context}</Typography> : null}</Box>
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.summary}</Typography>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{(article.tags || []).slice(0, 5).map((tag) => <Chip key={tag} label={tag} variant="outlined" />)}</Stack>
          <Typography variant="caption" color="text.secondary">Updated {formatDate(article.updatedAt)} · {(article.sourceLinks || []).length} sources</Typography>
        </CardContent>
      </CardActionArea>
      {canManage ? <Box sx={{ borderTop: 1, borderColor: 'divider', px: 1, py: 0.5 }}><IconButton component={RouterLink} to={`/learning/${article.id}/edit`} aria-label={`Edit ${article.title}`}><EditIcon /></IconButton></Box> : null}
    </Card>
  );
}

function humanize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString(); }
