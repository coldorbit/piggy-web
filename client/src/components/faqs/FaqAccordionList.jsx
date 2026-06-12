import { Box } from '@mui/material';
import EmptyState from '../common/EmptyState.jsx';
import FaqAccordionListItem from './FaqAccordionListItem.jsx';

export default function FaqAccordionList({ canManageFaqs, faqs, isSearching, onEdit }) {
  if (!faqs.length) {
    return (
      <EmptyState
        title={isSearching ? 'No FAQs found' : 'No FAQs published yet'}
        detail={isSearching ? 'Try a different search term.' : 'Published FAQs will appear here for the team.'}
      />
    );
  }

  return (
    <Box component="section" sx={{ display: 'grid', gap: 1 }}>
      {faqs.map((faq) => (
        <FaqAccordionListItem key={faq.id} canManageFaqs={canManageFaqs} faq={faq} onEdit={onEdit} />
      ))}
    </Box>
  );
}
