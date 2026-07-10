import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Paper, Skeleton, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import FaqAccordionList from '../components/faqs/FaqAccordionList.jsx';
import FaqPageToolbar from '../components/faqs/FaqPageToolbar.jsx';
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
      <FaqPageToolbar
        answerCount={visibleFaqs.length}
        canManageFaqs={canManageFaqs}
        onCreate={() => navigate('/faqs/create')}
        onRefresh={() => refetch()}
      />

      {error ? <Alert severity="error">{error.message}</Alert> : null}

      {isLoading ? (
        <FaqSkeletonList />
      ) : (
        <FaqAccordionList
          canManageFaqs={canManageFaqs}
          faqs={visibleFaqs}
          isSearching={Boolean(search)}
          onEdit={(faqId) => navigate(`/faqs/${faqId}/edit`)}
        />
      )}
    </Box>
  );
}

function FaqSkeletonList() {
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Paper key={`faq-loading-${index}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Skeleton width="42%" />
              <Skeleton variant="circular" width={24} height={24} />
            </Stack>
            <Skeleton width="76%" />
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
