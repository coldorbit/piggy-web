import DeleteIcon from '@mui/icons-material/Delete';
import { Box, IconButton, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import EmptyState from '../common/EmptyState.jsx';
import { formatAmount, formatDate, shortHash, typeLabel } from './consumptionFormatters.js';

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
  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={900}>{title}</Typography>
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
            {transactions.map((transaction) => (
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
