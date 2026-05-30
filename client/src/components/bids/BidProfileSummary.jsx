import JobFiltersDrawer from '../jobs/JobFiltersDrawer.jsx';

export default function BidProfileSummary({ filters, isOpen, meta, onClose, onFilterChange, onOpen, onRefresh }) {
  return (
    <JobFiltersDrawer
      ariaLabel="Bid job filters"
      filters={filters}
      isOpen={isOpen}
      meta={meta}
      onClose={onClose}
      onFilterChange={onFilterChange}
      onOpen={onOpen}
      onRefresh={onRefresh}
    />
  );
}
