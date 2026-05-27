import { Paper } from '@mui/material';
import JobFiltersToolbar from '../jobs/JobFiltersToolbar.jsx';

export default function BidProfileSummary({ filters, meta, onFilterChange, onRefresh }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, boxShadow: 1 }}>
      <JobFiltersToolbar
        ariaLabel="Bid job filters"
        filters={filters}
        meta={meta}
        onFilterChange={onFilterChange}
        onRefresh={onRefresh}
        variant="inline"
      />
    </Paper>
  );
}
