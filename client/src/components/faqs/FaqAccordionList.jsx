import { Alert, Box } from '@mui/material';
import FaqAccordionListItem from './FaqAccordionListItem.jsx';

export default function FaqAccordionList({ canManageFaqs, faqs, isSearching, onEdit }) {
  if (!faqs.length) {
    return <Alert severity="info">{isSearching ? 'No FAQs match your search.' : 'No FAQs have been published yet.'}</Alert>;
  }

  return (
    <Box component="section" sx={{ display: 'grid', gap: 1 }}>
      {faqs.map((faq) => (
        <FaqAccordionListItem key={faq.id} canManageFaqs={canManageFaqs} faq={faq} onEdit={onEdit} />
      ))}
    </Box>
  );
}
