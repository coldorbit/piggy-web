import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { lazy, Suspense, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';

const FaqMarkdownPreview = lazy(() => import('./FaqMarkdownPreview.jsx'));

export default function FaqAccordionListItem({ canManageFaqs, faq, onEdit }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Accordion
      disableGutters
      expanded={isExpanded}
      onChange={(_event, nextExpanded) => setIsExpanded(nextExpanded)}
      sx={{ border: 1, borderColor: '#E2E8F0', borderRadius: 1, '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ gap: 1, minHeight: 62 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, width: '100%', pr: 1 }}>
          <Typography fontWeight={900} sx={{ flex: 1, minWidth: 0 }} noWrap>
            {faq.title}
          </Typography>
          {canManageFaqs ? <Chip label={faq.status} size="small" color={faq.status === 'published' ? 'success' : 'default'} /> : null}
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ display: 'grid', gap: 1.5, pt: 0 }}>
        {isExpanded ? (
          <Box data-color-mode="light" sx={{ '& .wmde-markdown': { bgcolor: 'transparent', color: 'text.primary' } }}>
            <Suspense fallback={<LinearProgress />}>
              <FaqMarkdownPreview source={faq.content} />
            </Suspense>
          </Box>
        ) : null}
        {canManageFaqs ? (
          <Box>
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => onEdit(faq.id)}>
              Edit
            </Button>
          </Box>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}
