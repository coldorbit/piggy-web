import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import { Box, Button, Drawer, IconButton, Stack, Typography } from '@mui/material';
import JobFiltersToolbar from './JobFiltersToolbar.jsx';

export default function JobFiltersDrawer({ ariaLabel = 'Job filters', filters, isOpen, meta, onClose, onFilterChange, onOpen, onRefresh }) {
  return (
    <>
      <Button
        aria-label="Open filters"
        onClick={onOpen}
        size="small"
        variant="contained"
        sx={{
          position: 'fixed',
          right: 0,
          top: { xs: 112, sm: 136 },
          zIndex: (theme) => theme.zIndex.drawer - 1,
          minWidth: 42,
          width: 42,
          height: 42,
          p: 0,
          borderRadius: '8px 0 0 8px',
          bgcolor: 'primary.main',
          boxShadow: 3,
          '&:hover': {
            bgcolor: 'primary.dark',
            boxShadow: 4,
          },
        }}
      >
        <FilterListIcon />
      </Button>
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 640, md: 760, lg: 860 },
            maxWidth: '100vw',
            bgcolor: '#f7f9fb',
            borderLeft: 1,
            borderColor: 'divider',
          },
        }}
      >
        <Stack spacing={2} sx={{ height: '100%', position: 'relative' }}>
          <IconButton
            onClick={onClose}
            aria-label="Close filters"
            sx={{
              position: 'absolute',
              top: { xs: 14, sm: 18 },
              right: { xs: 14, sm: 18 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              '&:hover': { bgcolor: '#eef3f7' },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{
              p: { xs: 2, sm: 2.5 },
              pr: { xs: 7, sm: 7.5 },
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
            }}
          >
            <Typography variant="h6" fontWeight={900}>
              Filters
            </Typography>
          </Stack>
          <Box sx={{ px: { xs: 2, sm: 2.5 } }}>
            <JobFiltersToolbar
              ariaLabel={ariaLabel}
              filters={filters}
              meta={meta}
              onFilterChange={onFilterChange}
              onRefresh={onRefresh}
              variant="panel"
            />
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}
