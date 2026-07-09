import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { lazy, Suspense, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useFaqs } from '../../lib/api.js';

const FaqMarkdownPreview = lazy(() => import('./FaqMarkdownPreview.jsx'));

export default function ContextualFaqPanel({ keywords = [], limit = 3, title = 'Related FAQs' }) {
  const { data: faqs = [], isLoading } = useFaqs();
  const matchedFaqs = useMemo(() => contextualFaqs(faqs, keywords).slice(0, limit), [faqs, keywords, limit]);

  if (isLoading || !matchedFaqs.length) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'rgba(246, 248, 251, 0.86)',
        borderColor: '#CBD5E1',
      }}
    >
      <Box
        sx={{
          px: 1.25,
          py: 0.9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          borderBottom: 1,
          borderColor: 'rgba(0, 0, 0, 0.09)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
          <HelpOutlinedIcon color="primary" fontSize="small" />
          <Typography fontWeight={900} variant="body2" noWrap>
            {title}
          </Typography>
        </Stack>
        <Button
          component={RouterLink}
          to="/faqs"
          size="small"
          endIcon={<OpenInNewIcon />}
          sx={{ minHeight: 30, whiteSpace: 'nowrap' }}
        >
          All FAQs
        </Button>
      </Box>
      <Box sx={{ display: 'grid' }}>
        {matchedFaqs.map((faq) => (
          <Accordion
            key={faq.id}
            disableGutters
            sx={{
              bgcolor: 'transparent',
              boxShadow: 'none',
              borderBottom: 1,
              borderColor: 'rgba(0, 0, 0, 0.09)',
              '&:before': { display: 'none' },
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, px: 1.25 }}>
              <Typography fontWeight={850} variant="body2" sx={{ minWidth: 0 }} noWrap>
                {faq.title}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, px: 1.25 }}>
              <Box data-color-mode="light" sx={{ '& .wmde-markdown': { bgcolor: 'transparent', color: 'text.primary', fontSize: 13 } }}>
                <Suspense fallback={<LinearProgress />}>
                  <FaqMarkdownPreview source={faq.content} />
                </Suspense>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Paper>
  );
}

function contextualFaqs(faqs, keywords) {
  const normalizedKeywords = keywords.map((keyword) => String(keyword || '').trim().toLowerCase()).filter(Boolean);
  if (!normalizedKeywords.length) return [];

  return faqs
    .map((faq) => {
      const content = `${faq.title || ''} ${faq.content || ''}`.toLowerCase();
      const score = normalizedKeywords.reduce((sum, keyword) => sum + (content.includes(keyword) ? 1 : 0), 0);
      return { faq, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || String(left.faq.title || '').localeCompare(String(right.faq.title || '')))
    .map((entry) => entry.faq);
}
