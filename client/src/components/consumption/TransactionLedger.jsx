import DeleteIcon from '@mui/icons-material/Delete';
import { Box, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { formatAmount, formatDate, shortHash, typeLabel } from './consumptionFormatters.js';

export default function TransactionLedger({ isLoading, isSaving, onDelete, transactions }) {
  return (
    <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={900}>Transaction ledger</Typography>
        <Typography variant="caption" color="text.secondary">{transactions.length.toLocaleString()} transactions, newest first.</Typography>
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
            {!transactions.length ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>{isLoading ? 'Loading transactions...' : 'No transactions yet.'}</Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
