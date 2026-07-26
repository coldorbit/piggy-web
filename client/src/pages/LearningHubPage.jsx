import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditIcon from '@mui/icons-material/Edit';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PublicIcon from '@mui/icons-material/Public';
import RefreshIcon from '@mui/icons-material/Refresh';
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
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
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

const HUB_LINE = 'rgba(0, 0, 0, 0.08)';
const HUB_LINE_STRONG = 'rgba(0, 0, 0, 0.12)';
const HUB_LAYER = 'rgba(255, 255, 255, 0.82)';
const HUB_LAYER_SUBTLE = 'rgba(255, 255, 255, 0.56)';
const HUB_SHADOW = '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 14px rgba(0, 0, 0, 0.035)';

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
    <Box sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.5, sm: 1.75 },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: HUB_LAYER,
          borderColor: HUB_LINE,
          boxShadow: HUB_SHADOW,
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start', minWidth: 0, flex: '1 1 420px' }}>
          {activeDirectory ? (
            <Tooltip title="Back to company directories">
              <IconButton
                onClick={closeDirectory}
                aria-label="Back to company directories"
                sx={{ mt: 0.5, border: `1px solid ${HUB_LINE}`, bgcolor: HUB_LAYER_SUBTLE }}
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
          ) : null}
          {activeDirectory ? <CompanyLogo directory={activeDirectory} size={48} /> : null}
          <Box sx={{ minWidth: 0, pt: activeDirectory ? 0.25 : 0 }}>
            <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.3 }}>{activeDirectory?.name || 'Internal knowledge library'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, maxWidth: 820 }}>{activeDirectory?.description || 'Learn the companies, places, and ML concepts needed for stronger interview preparation.'}</Typography>
            {activeDirectory ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{[activeDirectory.industry, activeDirectory.headquarters].filter(Boolean).join(' · ')}</Typography> : null}
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{
            flex: { xs: '1 1 100%', md: '0 1 auto' },
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: { xs: 'flex-start', md: 'flex-end' },
            '& .MuiButton-root': { whiteSpace: 'nowrap' },
          }}
        >
          {activeDirectory?.companyWebsite ? <WebsiteButton url={activeDirectory.companyWebsite} label="Website" /> : null}
          <Tooltip title="Refresh learning content">
            <IconButton
              onClick={refreshLearningHub}
              aria-label="Refresh learning content"
              sx={{ border: `1px solid ${HUB_LINE_STRONG}`, bgcolor: HUB_LAYER_SUBTLE }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManageCompanies ? <Button onClick={() => setCompanyEditor({ open: true, company: activeDirectory })} startIcon={activeDirectory ? <EditIcon /> : <AddIcon />} variant="outlined">{activeDirectory ? 'Edit company' : 'Add company'}</Button> : null}
          {canManage ? <Button component={RouterLink} to={createPath} state={{ learningReturnTo: returnTo, companyDirectory: activeDirectory }} startIcon={<AddIcon />} variant="contained">New article</Button> : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error.message}</Alert> : null}

      {!activeDirectory ? (
        <Paper variant="outlined" sx={{ overflow: 'hidden', bgcolor: HUB_LAYER, borderColor: HUB_LINE, boxShadow: HUB_SHADOW }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            {CATEGORIES.filter((category) => category.id !== 'all').map((category, index) => {
              const Icon = category.icon;
              const selected = activeCategory === category.id;
              const countLabel = category.id === 'companies' ? `${categoryCounts.companies || 0} folders` : categoryCounts[category.id] || 0;
              return (
                <CardActionArea
                  key={category.id}
                  onClick={() => selectCategory(selected ? 'all' : category.id)}
                  aria-pressed={selected}
                  sx={{
                    minHeight: { xs: 76, sm: 82, lg: 92 },
                    p: 1.5,
                    borderTop: { xs: index ? `1px solid ${HUB_LINE}` : 0, sm: 0 },
                    borderLeft: { xs: 0, sm: index ? `1px solid ${HUB_LINE}` : 0 },
                    bgcolor: selected ? 'rgba(0, 103, 192, 0.075)' : 'transparent',
                    boxShadow: selected
                      ? { xs: 'inset 3px 0 0 #0067C0', sm: 'inset 0 -3px 0 #0067C0' }
                      : 'none',
                    '&:hover': { bgcolor: selected ? 'rgba(0, 103, 192, 0.10)' : 'rgba(0, 0, 0, 0.025)' },
                  }}
                >
                  <Box sx={{ display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr) max-content', gap: 1.1, alignItems: 'center' }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: category.soft, color: category.color }}><Icon fontSize="small" /></Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={600}>{category.label}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none', lg: 'block' }, lineHeight: 1.35 }}>{category.detail}</Typography>
                    </Box>
                    <Chip label={countLabel} sx={{ bgcolor: category.soft, color: category.color, maxWidth: 82 }} />
                  </Box>
                </CardActionArea>
              );
            })}
          </Box>
        </Paper>
      ) : null}

      <Paper variant="outlined" sx={{ px: 1.5, py: 1.1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, bgcolor: HUB_LAYER, borderColor: HUB_LINE, boxShadow: HUB_SHADOW }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0, 103, 192, 0.08)', color: 'primary.main' }}>
            <MenuBookIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box><Typography fontWeight={600}>{activeDirectory ? 'Articles' : CATEGORIES.find((category) => category.id === activeCategory)?.label}</Typography><Typography variant="body2" color="text.secondary">{resultDetail}</Typography></Box>
        </Stack>
        {activeDirectory ? <Button onClick={closeDirectory}>All company directories</Button> : activeCategory !== 'all' ? <Button onClick={() => selectCategory('all')}>Show all learning</Button> : null}
      </Paper>

      {isLoading ? <LearningContentSkeleton /> : null}
      {!isLoading && !totalResults ? <EmptyState title={search ? 'No learning content found' : activeDirectory ? 'This company directory is empty' : 'No content in this library'} detail={search ? 'Try another search term or category.' : canManage ? 'Publish the first article for this collection.' : 'Published learning content will appear here.'} /> : null}
      {!isLoading && visibleDirectories.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
          {visibleDirectories.map((directory) => <CompanyDirectoryCard key={directory.key} directory={directory} canManage={canManage} canManageCompany={canManageCompanies} onEdit={() => setCompanyEditor({ open: true, company: directory })} onOpen={() => openDirectory(directory)} />)}
        </Box>
      ) : null}
      {!isLoading && visibleArticles.length ? (
        <Paper variant="outlined" sx={{ p: 0.75, overflow: 'hidden', bgcolor: HUB_LAYER_SUBTLE, borderColor: HUB_LINE, boxShadow: HUB_SHADOW }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 0.75 }}>
            {visibleArticles.map((article) => (
              <LearningArticleListItem
                key={article.id}
                article={article}
                canManage={canManage}
                returnTo={returnTo}
                onOpen={() => openArticle(article)}
              />
            ))}
          </Box>
          <Box sx={{ px: 1.25, pt: 1, pb: 0.35 }}>
            <Typography variant="caption" color="text.secondary">
              Showing 1–{visibleArticles.length.toLocaleString()} of {visibleArticles.length.toLocaleString()} {visibleArticles.length === 1 ? 'article' : 'articles'}
            </Typography>
          </Box>
        </Paper>
      ) : null}
      <LearningCompanyDialog company={companyEditor.company} open={companyEditor.open} onClose={() => setCompanyEditor({ open: false, company: null })} onSaved={companySaved} />
    </Box>
  );
}

function CompanyDirectoryCard({ directory, canManage, canManageCompany, onEdit, onOpen }) {
  return (
    <Card
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: HUB_LAYER,
        borderColor: HUB_LINE,
        boxShadow: HUB_SHADOW,
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        '&:hover': { borderColor: 'rgba(0, 103, 192, 0.24)', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05), 0 8px 24px rgba(0, 0, 0, 0.055)' },
      }}
    >
      <CardActionArea onClick={onOpen} sx={{ flex: 1, alignItems: 'stretch' }}>
        <CardContent sx={{ p: 2, display: 'grid', gap: 1.1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Stack direction="row" spacing={1.1} sx={{ alignItems: 'center', minWidth: 0 }}>
              <CompanyLogo directory={directory} />
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <FolderOutlinedIcon sx={{ color: '#7C3AED', fontSize: 17 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Company directory</Typography>
                </Stack>
                <Typography fontWeight={600} noWrap>{directory.name}</Typography>
              </Box>
            </Stack>
            {directory.featured ? <StarIcon sx={{ color: '#C77700', fontSize: 19 }} /> : null}
          </Box>
          <Chip
            label={`${directory.articles.length.toLocaleString()} related ${directory.articles.length === 1 ? 'article' : 'articles'}${canManage && directory.draftCount ? ` · ${directory.draftCount} draft` : ''}`}
            sx={{ justifySelf: 'start', bgcolor: 'rgba(0, 103, 192, 0.075)', color: 'primary.dark' }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{directory.description}</Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', minWidth: 0 }}>
            {[directory.industry, directory.headquarters].filter(Boolean).map((value) => <SafeChip key={value} label={value} />)}
          </Stack>
          {directory.tags.length ? (
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', minWidth: 0 }}>
              {directory.tags.slice(0, 3).map((tag) => <SafeChip key={tag} label={tag} subtle />)}
            </Stack>
          ) : null}
        </CardContent>
      </CardActionArea>
      <Box sx={{ borderTop: `1px solid ${HUB_LINE}`, px: 1.25, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, bgcolor: 'rgba(0, 0, 0, 0.018)' }}>
        <Typography variant="caption" color="text.secondary">Updated {formatDate(directory.updatedAt)}</Typography>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {directory.companyWebsite ? <WebsiteButton url={directory.companyWebsite} compact /> : null}
          {canManageCompany ? (
            <Tooltip title={`Edit ${directory.name}`}>
              <IconButton onClick={onEdit} aria-label={`Edit ${directory.name} company directory`}><EditIcon /></IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Box>
    </Card>
  );
}

function CompanyLogo({ directory, size = 48 }) {
  return <Avatar alt={`${directory.name} logo`} src={directory.companyLogoUrl || undefined} variant="rounded" slotProps={{ img: { loading: 'lazy', referrerPolicy: 'no-referrer' } }} sx={{ width: size, height: size, flexShrink: 0, bgcolor: '#fff', color: '#7C3AED', border: `1px solid ${HUB_LINE_STRONG}`, borderRadius: 1.5, fontWeight: 600, '& img': { objectFit: 'contain', p: 0.5 } }}>{directory.name.trim().charAt(0).toUpperCase()}</Avatar>;
}

function WebsiteButton({ url, compact = false, label }) {
  return <Button component="a" href={url} target="_blank" rel="noopener noreferrer" size={compact ? 'small' : 'medium'} endIcon={<OpenInNewIcon fontSize="small" />} sx={{ whiteSpace: 'nowrap' }}>{label || websiteHost(url)}</Button>;
}

function websiteHost(value) {
  try { return new URL(value).hostname.replace(/^www\./i, ''); } catch { return 'Company website'; }
}

function LearningArticleListItem({ article, canManage, returnTo, onOpen }) {
  const category = CATEGORIES.find((item) => item.id === article.category) || CATEGORIES[0];
  const Icon = category.icon;
  const context = article.category === 'geography' ? [article.city, article.region, article.countryCode].filter(Boolean).join(', ') : humanize(article.difficulty);
  const sourceCount = (article.sourceLinks || []).length;
  const status = article.status || 'published';

  return (
    <Box
      component="article"
      sx={{
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 124px' },
        overflow: 'hidden',
        border: `1px solid ${HUB_LINE}`,
        borderRadius: 1.5,
        bgcolor: HUB_LAYER,
      }}
    >
      <CardActionArea
        onClick={onOpen}
        sx={{
          minWidth: 0,
          p: { xs: 1.5, md: 1.75 },
          display: 'grid',
          gridTemplateColumns: '44px minmax(0, 1fr)',
          gap: 1.25,
          alignItems: 'start',
          '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.018)' },
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: category.soft,
            color: category.color,
            border: `1px solid ${HUB_LINE}`,
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {article.category === 'companies' ? 'Company article' : category.label}
            </Typography>
            {article.featured ? <StarIcon sx={{ color: '#C77700', fontSize: 18 }} aria-label="Featured article" /> : null}
          </Stack>
          <Box>
            <Typography
              component="h3"
              sx={{
                m: 0,
                fontSize: { xs: 16, md: 17 },
                lineHeight: 1.28,
                fontWeight: 700,
                letterSpacing: 0,
              }}
            >
              {article.title}
            </Typography>
            {context ? <Typography variant="caption" color="text.secondary">{context}</Typography> : null}
          </Box>
          <Box sx={{ px: 1.15, py: 1, borderRadius: 1.25, border: `1px solid ${HUB_LINE}`, borderLeft: `3px solid ${category.color}`, bgcolor: category.soft }}>
            <Typography
              variant="body2"
              color="text.primary"
              sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}
            >
              {article.summary}
            </Typography>
          </Box>
          {(article.tags || []).length ? (
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', minWidth: 0 }}>
              {(article.tags || []).slice(0, 4).map((tag) => (
                <SafeChip key={tag} label={tag} color={category.color} background={category.soft} />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </CardActionArea>
      <Box
        sx={{
          px: 1.25,
          py: 1.25,
          borderTop: { xs: `1px solid ${HUB_LINE}`, sm: 0 },
          borderLeft: { xs: 0, sm: `1px solid ${HUB_LINE}` },
          bgcolor: 'rgba(0, 0, 0, 0.018)',
          display: 'flex',
          flexDirection: { xs: 'row', sm: 'column' },
          flexWrap: 'wrap',
          gap: { xs: 1.25, sm: 1 },
          alignItems: { xs: 'center', sm: 'stretch' },
        }}
      >
        <ArticleMeta icon={<CalendarTodayOutlinedIcon />} label="Updated" value={formatDate(article.updatedAt)} />
        <ArticleMeta icon={<DescriptionOutlinedIcon />} label="Sources" value={sourceCount.toLocaleString()} />
        <ArticleMeta icon={<CheckCircleOutlineIcon />} label="Status" value={humanize(status)} color={status === 'published' ? 'success.main' : 'text.secondary'} />
        {canManage ? (
          <Tooltip title={`Edit ${article.title}`}>
            <IconButton
              component={RouterLink}
              to={`/learning/${article.id}/edit`}
              state={{ learningReturnTo: returnTo }}
              aria-label={`Edit ${article.title}`}
              sx={{ mt: { xs: 0, sm: 'auto' }, alignSelf: { xs: 'center', sm: 'flex-start' }, color: 'primary.main' }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  );
}

function ArticleMeta({ color = 'text.secondary', icon, label, value }) {
  return (
    <Stack direction="row" spacing={0.65} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ color, display: 'grid', placeItems: 'center', mt: '2px', '& svg': { fontSize: 16 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
        <Typography variant="caption" color={color} fontWeight={600} sx={{ display: 'block', lineHeight: 1.35 }}>{value}</Typography>
      </Box>
    </Stack>
  );
}

function SafeChip({ background = HUB_LAYER_SUBTLE, color = 'text.secondary', label, subtle = false }) {
  return (
    <Chip
      label={label}
      variant={subtle ? 'filled' : 'outlined'}
      sx={{
        maxWidth: '100%',
        bgcolor: background,
        color,
        borderColor: subtle ? 'transparent' : HUB_LINE_STRONG,
        '& .MuiChip-label': { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
      }}
    />
  );
}

function LearningContentSkeleton() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Paper key={`learning-skeleton-${index}`} variant="outlined" sx={{ p: 1.75, bgcolor: HUB_LAYER_SUBTLE, borderColor: HUB_LINE }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
            <Skeleton variant="rounded" width={44} height={44} sx={{ flexShrink: 0 }} />
            <Stack spacing={0.8} sx={{ flex: 1 }}>
              <Skeleton width="30%" />
              <Skeleton width="66%" height={26} />
              <Skeleton variant="rounded" height={58} />
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

function humanize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString(); }
