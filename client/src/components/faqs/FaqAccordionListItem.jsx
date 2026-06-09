import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Stack, Typography } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

export default function FaqAccordionListItem({ canManageFaqs, faq, onEdit }) {
  return (
    <Accordion disableGutters sx={{ border: 1, borderColor: '#E2E8F0', borderRadius: 1, '&:before': { display: 'none' } }}>
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
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => onEdit(faq.id)}>
              Edit
            </Button>
          </Box>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}
