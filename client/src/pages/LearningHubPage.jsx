import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import EditIcon from '@mui/icons-material/Edit';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PublicIcon from '@mui/icons-material/Public';
import StarIcon from '@mui/icons-material/Star';
import {
  Alert,
  Avatar,
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
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState.jsx';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import LearningCompanyDialog from '../components/learning/LearningCompanyDialog.jsx';
import { useLearningArticles, useLearningCompanies } from '../lib/api.js';
import { isAdminRole, isSuperadmin } from '../lib/roles.js';
import { articleMatchesSearch, buildCompanyDirectories, directoryMatchesSearch, normalizeCompanyName } from './learningHub/learningHubUtils.js';

const CATEGORIES = [
  { id: 'all', label: 'All learning', detail: 'Everything available to the internal team', icon: MenuBookIcon, color: '#0067C0', soft: 'rgba(0, 103, 192, 0.10)' },
  { id: 'companies', label: 'Companies', detail: 'Company directories with related articles and interview context', icon: BusinessIcon, color: '#7C3AED', soft: '#F5F3FF' },
  { id: 'geography', label: 'Geography', detail: 'Cities, states, regions, local context, and logistics', icon: PublicIcon, color: '#0E7A3E', soft: '#ECFDF5' },
  { id: 'machine_learning', label: 'Machine Learning', detail: 'ML foundations, systems, leadership, and Staff+ interviews', icon: PsychologyIcon, color: '#C77700', soft: '#FFFBEB' },
];

export default function LearningHubPage({ currentUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get('category') || 'all';
  const activeCategory = CATEGORIES.some((category) => category.id === requestedCategory) ? requestedCategory : 'all';
  const requestedCompany = searchParams.get('company') || '';
  const [search, setSearch] = useState('');
  const [companyEditor, setCompanyEditor] = useState({ open: false, company: null });
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const { data: articles = [], isLoading: articlesLoading, error: articlesError, refetch: refetchArticles } = useLearningArticles();
  const { data: companies = [], isLoading: companiesLoading, error: companiesError, refetch: refetchCompanies } = useLearningCompanies();
  const canManage = isAdminRole(currentUser);
  const canManageCompanies = isSuperadmin(currentUser);
  const isLoading = articlesLoading || companiesLoading;
  const error = articlesError || companiesError;
  const companyDirectories = useMemo(() => buildCompanyDirectories(companies, articles), [articles, companies]);
  const activeDirectory = useMemo(() => companyDirectories.find((directory) => directory.slug === requestedCompany || normalizeCompanyName(directory.name) === normalizeCompanyName(requestedCompany)), [companyDirectories, requestedCompany]);

  useEffect(() => {
    setHeaderSearch({ isVisible: true, placeholder: activeDirectory ? `Search ${activeDirectory.name} articles` : 'Search the Learning Hub', value: search, onChange: setSearch });
  }, [activeDirectory, search, setHeaderSearch]);

  useEffect(() => () => setHeaderSearch(EMPTY_HEADER_SEARCH), [setHeaderSearch]);

  const categoryCounts = useMemo(() => {
    const counts = { all: articles.length, companies: companyDirectories.length };
    for (const article of articles) {
      if (article.category !== 'companies') counts[article.category] = (counts[article.category] || 0) + 1;
    }
    return counts;
  }, [articles, companyDirectories.length]);

  const visibleDirectories = useMemo(() => {
    if (activeDirectory || !['all', 'companies'].includes(activeCategory)) return [];
    return companyDirectories.filter((directory) => directoryMatchesSearch(directory, search));
  }, [activeCategory, activeDirectory, companyDirectories, search]);

  const visibleArticles = useMemo(() => {
    const candidates = activeDirectory?.articles || articles.filter((article) => article.category !== 'companies'
      && (activeCategory === 'all' || article.category === activeCategory));
    return candidates.filter((article) => articleMatchesSearch(article, search));
  }, [activeCategory, activeDirectory, articles, search]);

  const returnTo = `${location.pathname}${location.search}`;

  function selectCategory(category) {
    const next = new URLSearchParams(searchParams);
    next.delete('company');
    if (category === 'all') next.delete('category');
    else next.set('category', category);
    setSearch('');
    setSearchParams(next, { replace: true });
  }

  function openDirectory(directory) {
    const next = new URLSearchParams(searchParams);
    next.set('category', 'companies');
    next.set('company', directory.slug);
    setSearch('');
    setSearchParams(next);
  }

  function closeDirectory() {
    const next = new URLSearchParams(searchParams);
    next.set('category', 'companies');
    next.delete('company');
    setSearch('');
    setSearchParams(next);
  }

  function openArticle(article) {
    navigate(`/learning/${article.id}`, { state: { learningReturnTo: returnTo } });
  }

  function refreshLearningHub() {
    refetchArticles();
    refetchCompanies();
  }

  function companySaved(company) {
    setCompanyEditor({ open: false, company: null });
    openDirectory(company);
  }

  const createPath = activeDirectory ? `/learning/create?company=${encodeURIComponent(activeDirectory.slug)}` : '/learning/create';
  const totalResults = visibleDirectories.length + visibleArticles.length;
  const resultDetail = activeDirectory
    ? `${visibleArticles.length.toLocaleString()} articles in this company directory`
    : activeCategory === 'companies'
      ? `${visibleDirectories.length.toLocaleString()} company directories · ${visibleDirectories.reduce((total, directory) => total + directory.articles.length, 0).toLocaleString()} articles`
      : activeCategory === 'all'
        ? `${visibleDirectories.length.toLocaleString()} company directories · ${visibleArticles.length.toLocaleString()} standalone articles`
        : `${visibleArticles.length.toLocaleString()} articles`;

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, boxShadow: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
          {activeDirectory ? <IconButton onClick={closeDirectory} aria-label="Back to company directories"><ArrowBackIcon /></IconButton> : null}
          {activeDirectory ? <CompanyLogo directory={activeDirectory} size={48} /> : null}
          <Box minWidth={0}>
            <Typography variant="h6" fontWeight={600}>{activeDirectory?.name || 'Internal knowledge library'}</Typography>
            <Typography variant="body2" color="text.secondary">{activeDirectory?.description || 'Learn the companies, places, and ML concepts needed for stronger interview preparation.'}</Typography>
            {activeDirectory ? <Typography variant="caption" color="text.secondary">{[activeDirectory.industry, activeDirectory.headquarters].filter(Boolean).join(' · ')}</Typography> : null}
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.75}>
          {activeDirectory?.companyWebsite ? <WebsiteButton url={activeDirectory.companyWebsite} /> : null}
          <Button onClick={refreshLearningHub} variant="outlined">Refresh</Button>
          {canManageCompanies ? <Button onClick={() => setCompanyEditor({ open: true, company: activeDirectory })} startIcon={activeDirectory ? <EditIcon /> : <AddIcon />} variant="outlined">{activeDirectory ? 'Edit company' : 'Add company'}</Button> : null}
          {canManage ? <Button component={RouterLink} to={createPath} state={{ learningReturnTo: returnTo, companyDirectory: activeDirectory }} startIcon={<AddIcon />} variant="contained">{activeDirectory ? 'New company article' : 'New article'}</Button> : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error.message}</Alert> : null}

      {!activeDirectory ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
          {CATEGORIES.filter((category) => category.id !== 'all').map((category) => {
            const Icon = category.icon;
            const selected = activeCategory === category.id;
            const countLabel = category.id === 'companies' ? `${categoryCounts.companies || 0} folders` : categoryCounts[category.id] || 0;
            return (
              <Card key={category.id} variant="outlined" sx={{ borderColor: selected ? category.color : 'divider', boxShadow: selected ? `0 0 0 2px ${category.soft}` : 1 }}>
                <CardActionArea onClick={() => selectCategory(selected ? 'all' : category.id)} sx={{ height: '100%', p: 0.25 }}>
                  <CardContent sx={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) max-content', gap: 1.25, alignItems: 'center' }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: category.soft, color: category.color }}><Icon /></Box>
                    <Box minWidth={0}><Typography fontWeight={600}>{category.label}</Typography><Typography variant="caption" color="text.secondary">{category.detail}</Typography></Box>
                    <Chip label={countLabel} sx={{ bgcolor: category.soft, color: category.color }} />
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      ) : null}

      <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, boxShadow: 1 }}>
        <Box><Typography fontWeight={600}>{activeDirectory ? 'Articles' : CATEGORIES.find((category) => category.id === activeCategory)?.label}</Typography><Typography variant="body2" color="text.secondary">{resultDetail}</Typography></Box>
        {activeDirectory ? <Button onClick={closeDirectory}>All company directories</Button> : activeCategory !== 'all' ? <Button onClick={() => selectCategory('all')}>Show all learning</Button> : null}
      </Paper>

      {isLoading ? <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : null}
      {!isLoading && !totalResults ? <EmptyState title={search ? 'No learning content found' : activeDirectory ? 'This company directory is empty' : 'No content in this library'} detail={search ? 'Try another search term or category.' : canManage ? 'Publish the first article for this collection.' : 'Published learning content will appear here.'} /> : null}
      {!isLoading && visibleDirectories.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
          {visibleDirectories.map((directory) => <CompanyDirectoryCard key={directory.key} directory={directory} canManage={canManage} canManageCompany={canManageCompanies} onEdit={() => setCompanyEditor({ open: true, company: directory })} onOpen={() => openDirectory(directory)} />)}
        </Box>
      ) : null}
      {!isLoading && visibleArticles.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
          {visibleArticles.map((article) => <LearningArticleCard key={article.id} article={article} canManage={canManage} returnTo={returnTo} onOpen={() => openArticle(article)} />)}
        </Box>
      ) : null}
      <LearningCompanyDialog company={companyEditor.company} open={companyEditor.open} onClose={() => setCompanyEditor({ open: false, company: null })} onSaved={companySaved} />
    </Box>
  );
}

function CompanyDirectoryCard({ directory, canManage, canManageCompany, onEdit, onOpen }) {
  return (
    <Card variant="outlined" sx={{ borderTop: '3px solid #7C3AED', boxShadow: 1, display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onOpen} sx={{ flex: 1, alignItems: 'stretch' }}>
        <CardContent sx={{ display: 'grid', gap: 1.1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center"><CompanyLogo directory={directory} /><Box><Stack direction="row" spacing={0.5} alignItems="center"><FolderOutlinedIcon sx={{ color: '#7C3AED', fontSize: 18 }} /><Typography variant="caption" color="text.secondary" fontWeight={600}>Company directory</Typography></Stack><Typography fontWeight={600}>{directory.name}</Typography></Box></Stack>
            {directory.featured ? <StarIcon sx={{ color: '#C77700', fontSize: 19 }} /> : null}
          </Box>
          <Typography variant="body2" color="text.secondary">{directory.articles.length.toLocaleString()} related {directory.articles.length === 1 ? 'article' : 'articles'}{canManage && directory.draftCount ? ` · ${directory.draftCount} draft` : ''}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{directory.description}</Typography>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{[directory.industry, directory.headquarters].filter(Boolean).map((value) => <Chip key={value} label={value} variant="outlined" />)}</Stack>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{directory.tags.slice(0, 5).map((tag) => <Chip key={tag} label={tag} variant="outlined" />)}</Stack>
          <Typography variant="caption" color="text.secondary">Updated {formatDate(directory.updatedAt)}</Typography>
        </CardContent>
      </CardActionArea>
      {directory.companyWebsite || canManageCompany ? <Box sx={{ borderTop: 1, borderColor: 'divider', px: 1, py: 0.5, display: 'flex', justifyContent: 'space-between' }}>{directory.companyWebsite ? <WebsiteButton url={directory.companyWebsite} compact /> : <span />}{canManageCompany ? <IconButton onClick={onEdit} aria-label={`Edit ${directory.name} company directory`}><EditIcon /></IconButton> : null}</Box> : null}
    </Card>
  );
}

function CompanyLogo({ directory, size = 48 }) {
  return <Avatar alt={`${directory.name} logo`} src={directory.companyLogoUrl || undefined} variant="rounded" imgProps={{ loading: 'lazy', referrerPolicy: 'no-referrer' }} sx={{ width: size, height: size, flexShrink: 0, bgcolor: '#fff', color: '#7C3AED', border: 1, borderColor: 'divider', fontWeight: 600, '& img': { objectFit: 'contain', p: 0.5 } }}>{directory.name.trim().charAt(0).toUpperCase()}</Avatar>;
}

function WebsiteButton({ url, compact = false }) {
  return <Button component="a" href={url} target="_blank" rel="noopener noreferrer" size={compact ? 'small' : 'medium'} endIcon={<OpenInNewIcon fontSize="small" />}>{websiteHost(url)}</Button>;
}

function websiteHost(value) {
  try { return new URL(value).hostname.replace(/^www\./i, ''); } catch { return 'Company website'; }
}

function LearningArticleCard({ article, canManage, returnTo, onOpen }) {
  const category = CATEGORIES.find((item) => item.id === article.category) || CATEGORIES[0];
  const Icon = category.icon;
  const context = article.category === 'geography' ? [article.city, article.region, article.countryCode].filter(Boolean).join(', ') : humanize(article.difficulty);
  return (
    <Card variant="outlined" sx={{ borderTop: `3px solid ${category.color}`, boxShadow: 1, display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onOpen} sx={{ flex: 1, alignItems: 'stretch' }}>
        <CardContent sx={{ display: 'grid', gap: 1.1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}><Icon sx={{ color: category.color }} fontSize="small" /><Typography variant="caption" color="text.secondary" fontWeight={600}>{article.category === 'companies' ? 'Company article' : category.label}</Typography></Stack>
            <Stack direction="row" spacing={0.5}>{article.featured ? <StarIcon sx={{ color: '#C77700', fontSize: 19 }} /> : null}{canManage ? <Chip label={article.status} color={article.status === 'published' ? 'success' : 'default'} /> : null}</Stack>
          </Box>
          <Box><Typography fontWeight={600}>{article.title}</Typography>{context ? <Typography variant="caption" color="text.secondary">{context}</Typography> : null}</Box>
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.summary}</Typography>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">{(article.tags || []).slice(0, 5).map((tag) => <Chip key={tag} label={tag} variant="outlined" />)}</Stack>
          <Typography variant="caption" color="text.secondary">Updated {formatDate(article.updatedAt)} · {(article.sourceLinks || []).length} sources</Typography>
        </CardContent>
      </CardActionArea>
      {canManage ? <Box sx={{ borderTop: 1, borderColor: 'divider', px: 1, py: 0.5 }}><IconButton component={RouterLink} to={`/learning/${article.id}/edit`} state={{ learningReturnTo: returnTo }} aria-label={`Edit ${article.title}`}><EditIcon /></IconButton></Box> : null}
    </Card>
  );
}

function humanize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString(); }
