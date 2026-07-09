import DeleteIcon from '@mui/icons-material/Delete';
import { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import EmptyState from '../common/EmptyState.jsx';
import { formatAmount, formatDate, shortHash, typeLabel } from './consumptionFormatters.js';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_ROWS_PER_PAGE = 25;

export default function TransactionLedger({
  emptyDetail = 'Add a consumption record to start tracking balances and spend.',
  emptyTitle = 'No transactions yet',
  isLoading,
  isSaving,
  onDelete,
  subtitle,
  title = 'Transaction ledger',
  transactions,
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const transactionIds = useMemo(() => transactions.map((transaction) => transaction.id).join('|'), [transactions]);
  const visibleTransactions = useMemo(
    () => transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [page, rowsPerPage, transactions],
  );

  useEffect(() => {
    setPage(0);
  }, [transactionIds]);

  useEffect(() => {
    const lastPage = Math.max(Math.ceil(transactions.length / rowsPerPage) - 1, 0);
    setPage((current) => Math.min(current, lastPage));
  }, [rowsPerPage, transactions.length]);

  function handleRowsPerPageChange(event) {
    setRowsPerPage(Number(event.target.value));
    setPage(0);
  }

  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={600}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle || `${transactions.length.toLocaleString()} transactions, newest first.`}</Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 560 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Spent by</TableCell>
              <TableCell>Entries</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Tx</TableCell>
              <TableCell>Created by</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && !transactions.length ? <LedgerSkeletonRows /> : null}
            {visibleTransactions.map((transaction) => (
              <TableRow key={transaction.id} hover>
                <TableCell>{formatDate(transaction.occurredAt)}</TableCell>
                <TableCell>{typeLabel(transaction.type)}</TableCell>
                <TableCell>{transaction.spentBy?.label || 'Team'}</TableCell>
                <TableCell>
                  {(transaction.entries || []).map((entry) => (
                    <Typography key={entry.id} variant="caption" sx={{ display: 'block' }}>
                      {entry.accountName}: {entry.direction === 'inflow' ? '+' : '-'}{formatAmount(entry.amount, entry.currency)} · {entry.entryKind.replace(/_/g, ' ')}
                    </Typography>
                  ))}
                </TableCell>
                <TableCell sx={{ maxWidth: 320 }}>
                  <Typography variant="body2" noWrap title={transaction.notes}>{transaction.notes || '-'}</Typography>
                </TableCell>
                <TableCell>{transaction.txHash ? <Typography variant="caption">{shortHash(transaction.txHash)}</Typography> : '-'}</TableCell>
                <TableCell>{transaction.createdBy?.username || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton disabled={isSaving} onClick={() => onDelete(transaction.id)} title="Delete"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && !transactions.length ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    title={emptyTitle}
                    detail={emptyDetail}
                    variant="plain"
                    sx={{ py: 4 }}
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
      {transactions.length ? (
        <TablePagination
          component="div"
          count={transactions.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={handleRowsPerPageChange}
          sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        />
      ) : null}
    </Paper>
  );
}

function LedgerSkeletonRows() {
  return Array.from({ length: 5 }).map((_, index) => (
    <TableRow key={`ledger-loading-${index}`}>
      <TableCell><Skeleton width={92} /></TableCell>
      <TableCell><Skeleton width={130} /></TableCell>
      <TableCell><Skeleton width={100} /></TableCell>
      <TableCell>
        <Stack spacing={0.5}>
          <Skeleton width="80%" />
          <Skeleton width="60%" />
        </Stack>
      </TableCell>
      <TableCell><Skeleton width={220} /></TableCell>
      <TableCell><Skeleton width={86} /></TableCell>
      <TableCell><Skeleton width={92} /></TableCell>
      <TableCell align="right"><Skeleton width={34} sx={{ ml: 'auto' }} /></TableCell>
    </TableRow>
  ));
}
