import { useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { useNavigate } from 'react-router-dom';
import { EMPTY_HEADER_SEARCH, useHeaderSearch } from '../components/HeaderSearchContext.jsx';
import { useFaqs } from '../lib/api.js';
import { isAdminRole } from '../lib/roles.js';

export default function FaqsPage({ currentUser }) {
  const navigate = useNavigate();
  const { setSearch: setHeaderSearch } = useHeaderSearch();
  const [search, setSearch] = useState('');
  const { data: faqs = [], isLoading, error, refetch } = useFaqs();
  const canManageFaqs = isAdminRole(currentUser);

  useEffect(() => {
    setHeaderSearch({
      isVisible: true,
      placeholder: 'Search FAQs',
      value: search,
      onChange: setSearch,
    });
  }, [search, setHeaderSearch]);

  useEffect(() => {
    return () => setHeaderSearch(EMPTY_HEADER_SEARCH);
  }, [setHeaderSearch]);

  const visibleFaqs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return faqs;
    return faqs.filter((faq) => `${faq.title} ${faq.content}`.toLowerCase().includes(needle));
  }, [faqs, search]);

  return (
    <Box sx={{ minHeight: 0, display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
        <Box>
          <Typography color="text.secondary">
            {visibleFaqs.length.toLocaleString()} {visibleFaqs.length === 1 ? 'answer' : 'answers'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
          <IconButton type="button" onClick={() => refetch()} title="Refresh FAQs">
            <RefreshIcon />
          </IconButton>
          {canManageFaqs ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/faqs/create')}>
              New FAQ
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error.message}</Alert> : null}

      {isLoading ? (
        <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : visibleFaqs.length ? (
        <Box component="section" sx={{ display: 'grid', gap: 1 }}>
          {visibleFaqs.map((faq) => (
            <Accordion key={faq.id} disableGutters sx={{ border: 1, borderColor: '#E2E8F0', borderRadius: 1, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ gap: 1, minHeight: 62 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, width: '100%', pr: 1 }}>
                  <Typography fontWeight={900} sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {faq.title}
                  </Typography>
                  {canManageFaqs ? <Chip label={faq.status} size="small" color={faq.status === 'published' ? 'success' : 'default'} /> : null}
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ display: 'grid', gap: 1.5, pt: 0 }}>
                <Box data-color-mode="light" sx={{ '& .wmde-markdown': { bgcolor: 'transparent', color: 'text.primary' } }}>
                  <MDEditor.Markdown source={faq.content} />
                </Box>
                {canManageFaqs ? (
                  <Box>
                    <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => navigate(`/faqs/${faq.id}/edit`)}>
                      Edit
                    </Button>
                  </Box>
                ) : null}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ) : (
        <Alert severity="info">{search ? 'No FAQs match your search.' : 'No FAQs have been published yet.'}</Alert>
      )}
    </Box>
  );
}
