import { Box, FormControl, MenuItem, Pagination as MuiPagination, Select, Stack, Typography } from '@mui/material';
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../lib/constants.js';

export default function Pagination({ filters, total, onPage, onPageSize }) {
  const pageSize = Number(filters.limit || PAGE_SIZE);
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  return (
    <Box
      sx={{
        p: 1,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1,
        textAlign: 'center',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent={{ xs: 'center', md: 'flex-start' }}
        alignItems="center"
        spacing={1}
        sx={{ width: { xs: '100%', md: 'auto' } }}
      >
        <FormControl size="small" sx={{ minWidth: 76 }}>
          <Select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            displayEmpty
            sx={{ height: 32 }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <MuiPagination
          count={pages}
          page={filters.page}
          onChange={(_event, page) => onPage(page)}
          shape="rounded"
          color="primary"
        />
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: '32px' }}>
          Page {filters.page} of {pages}
        </Typography>
      </Stack>
    </Box>
  );
}
