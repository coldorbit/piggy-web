import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useMemo, useState } from 'react';
import { useAdminConsumption, useCreateConsumptionRecord, useDeleteConsumptionRecord } from '../lib/api.js';

const CRYPTO_CURRENCIES = ['USDT', 'USDC', 'ETH', 'SOL', 'BTC', 'BNB', 'MATIC', 'AVAX', 'TRX', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK'];
const TYPE_OPTIONS = [
  { value: 'crypto_spend', label: 'Crypto spend' },
  { value: 'card_pay', label: 'Card pay' },
  { value: 'card_deposit', label: 'Deposit to card' },
  { value: 'swap', label: 'Swap to ETH' },
  { value: 'eth_fee', label: 'ETH fee only' },
  { value: 'adjustment', label: 'Balance adjustment' },
];
const EMPTY_FORM = {
  type: 'crypto_spend',
  amount: '',
  currency: 'USDC',
  fromCurrency: 'USDC',
  toEthAmount: '',
  ethFee: '',
  receivedUsd: '',
  cardFee: '',
  accountName: 'USDC Wallet',
  direction: 'inflow',
  occurredAt: new Date().toISOString().slice(0, 10),
  etherscanUrl: '',
  notes: '',
};

export default function AdminConsumptionPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const { data, isLoading, error: queryError, refetch } = useAdminConsumption();
  const { mutate: createRecord, isPending: isCreating } = useCreateConsumptionRecord();
  const { mutate: deleteRecord, isPending: isDeleting } = useDeleteConsumptionRecord();
  const accounts = data?.accounts || data?.balances || [];
  const transactions = data?.transactions || data?.records || [];
  const accountOptions = useMemo(() => accounts.map((account) => account.name), [accounts]);
  const isSaving = isCreating || isDeleting;

  function submitRecord(event) {
    event.preventDefault();
    setError('');
    createRecord(form, {
      onSuccess: () => setForm(EMPTY_FORM),
      onError: (recordError) => setError(recordError.message),
    });
  }

  function updateForm(updates) {
    setForm((current) => normalizeForm({ ...current, ...updates }));
  }

  function removeRecord(recordId) {
    setError('');
    deleteRecord(recordId, {
      onError: (recordError) => setError(recordError.message),
    });
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Typography color="text.secondary">
          Track wallet balances, card balance, crypto spend, card funding, swaps, gas fees, and reconciliation adjustments.
        </Typography>
        <IconButton type="button" onClick={() => refetch()} title="Refresh consumption">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {error || queryError ? <Alert severity="error">{error || queryError?.message}</Alert> : null}

      <Grid container spacing={1.25}>
        {accounts.map((account) => (
          <Grid key={account.id || account.name} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper variant="outlined" sx={{ p: 1.5, boxShadow: 1 }}>
              <Typography variant="caption" color="text.secondary">{account.name}</Typography>
              <Typography variant="h5" fontWeight={900}>{formatAmount(account.balance, account.currency)}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper component="form" variant="outlined" onSubmit={submitRecord} sx={{ p: 1.5, boxShadow: 1 }}>
        <Grid container spacing={1.25} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 2 }}>
            <SelectField label="Type" value={form.type} options={TYPE_OPTIONS} onChange={(type) => updateForm({ type })} />
          </Grid>
          <TransactionFields accountOptions={accountOptions} form={form} onChange={updateForm} />
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth size="small" label="Date" type="date" value={form.occurredAt} onChange={(event) => updateForm({ occurredAt: event.target.value })} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth size="small" label="Etherscan link / tx hash" value={form.etherscanUrl} onChange={(event) => updateForm({ etherscanUrl: event.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Notes" value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              fullWidth
              type="submit"
              size="small"
              variant="contained"
              disabled={isSaving}
              startIcon={<AddIcon fontSize="small" />}
              sx={{ minHeight: 40, whiteSpace: 'nowrap', '& .MuiButton-startIcon .MuiSvgIcon-root': { fontSize: 18 } }}
            >
              Add transaction
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <ConsumptionHelp />

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
                  <TableCell>
                    {(transaction.entries || []).map((entry) => (
                      <Typography key={entry.id} variant="caption" sx={{ display: 'block' }}>
                        {entry.accountName}: {entry.direction === 'inflow' ? '+' : '-'}{formatAmount(entry.amount, entry.currency)} · {entry.entryKind.replace(/_/g, ' ')}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}><Typography variant="body2" noWrap title={transaction.notes}>{transaction.notes || '-'}</Typography></TableCell>
                  <TableCell>{transaction.txHash ? <Typography variant="caption">{shortHash(transaction.txHash)}</Typography> : '-'}</TableCell>
                  <TableCell>{transaction.createdBy?.username || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton disabled={isSaving} onClick={() => removeRecord(transaction.id)} title="Delete"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!transactions.length ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>{isLoading ? 'Loading transactions...' : 'No transactions yet.'}</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

function TransactionFields({ accountOptions, form, onChange }) {
  if (form.type === 'card_pay') {
    return <AmountField label="USD amount" value={form.amount} onChange={(amount) => onChange({ amount })} />;
  }
  if (form.type === 'card_deposit') {
    return (
      <>
        <CryptoSelect label="From" value={form.currency} onChange={(currency) => onChange({ currency })} />
        <AmountField label="Crypto amount" value={form.amount} onChange={(amount) => onChange({ amount })} />
        <AmountField label="ETH fee" value={form.ethFee} onChange={(ethFee) => onChange({ ethFee })} />
        <AmountField label="Received USD" value={form.receivedUsd} onChange={(receivedUsd) => onChange({ receivedUsd })} />
        <AmountField label="Card fee" value={form.cardFee} onChange={(cardFee) => onChange({ cardFee })} />
      </>
    );
  }
  if (form.type === 'swap') {
    return (
      <>
        <CryptoSelect label="From" value={form.fromCurrency} onChange={(fromCurrency) => onChange({ fromCurrency })} exclude={['ETH']} />
        <AmountField label="From amount" value={form.amount} onChange={(amount) => onChange({ amount })} />
        <AmountField label="ETH received" value={form.toEthAmount} onChange={(toEthAmount) => onChange({ toEthAmount })} />
        <AmountField label="ETH fee" value={form.ethFee} onChange={(ethFee) => onChange({ ethFee })} />
        <AmountField label="Swap fee" value={form.swapFee} onChange={(swapFee) => onChange({ swapFee })} />
      </>
    );
  }
  if (form.type === 'eth_fee') {
    return <AmountField label="ETH fee" value={form.ethFee} onChange={(ethFee) => onChange({ ethFee })} />;
  }
  if (form.type === 'adjustment') {
    return (
      <>
        <SelectField label="Account" value={form.accountName} options={accountOptions.map((name) => ({ value: name, label: name }))} onChange={(accountName) => onChange({ accountName })} />
        <SelectField label="Direction" value={form.direction} options={[{ value: 'inflow', label: 'Increase' }, { value: 'outflow', label: 'Decrease' }]} onChange={(direction) => onChange({ direction })} />
        <AmountField label="Amount" value={form.amount} onChange={(amount) => onChange({ amount })} />
      </>
    );
  }
  return (
    <>
      <CryptoSelect label="Currency" value={form.currency} onChange={(currency) => onChange({ currency })} />
      <AmountField label="Amount" value={form.amount} onChange={(amount) => onChange({ amount })} />
      <AmountField label="ETH fee" value={form.ethFee} onChange={(ethFee) => onChange({ ethFee })} />
    </>
  );
}

function ConsumptionHelp() {
  return (
    <Accordion variant="outlined" sx={{ boxShadow: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HelpOutlinedIcon fontSize="small" />
          <Typography fontWeight={900}>Help and FAQ</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={1.25}>
          {[
            ['Crypto spend', 'Use this for USDC/USDT vendor payments. It subtracts the token amount and the ETH gas fee.'],
            ['Card pay', 'Use this for card purchases. It only subtracts Card USD and has no ETH fee.'],
            ['Deposit to card', 'Use this when funding card from USDC/USDT. It subtracts crypto, subtracts ETH gas, adds received USD, and can record card fees.'],
            ['Swap to ETH', 'Use this when swapping USDC/USDT into ETH for future gas. It subtracts the input token, adds ETH received, and subtracts ETH gas.'],
            ['ETH fee only', 'Use this for failed transactions or wallet actions where only gas was spent.'],
            ['Adjustment', 'Use this only when reconciling balances against the real wallet/card balance.'],
          ].map(([title, text]) => (
            <Grid key={title} size={{ xs: 12, md: 6 }}>
              <Typography fontWeight={900}>{title}</Typography>
              <Typography color="text.secondary" variant="body2">{text}</Typography>
            </Grid>
          ))}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
}

function AmountField({ label, value, onChange }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
      <TextField fullWidth size="small" label={label} type="number" inputProps={{ min: 0, step: 'any' }} value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </Grid>
  );
}

function CryptoSelect({ exclude = [], label, value, onChange }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
      <SelectField
        label={label}
        value={value}
        options={CRYPTO_CURRENCIES.filter((currency) => !exclude.includes(currency)).map((currency) => ({ value: currency, label: currency }))}
        onChange={onChange}
      />
    </Grid>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value || ''} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function normalizeForm(form) {
  if (form.type === 'card_pay') return { ...form, currency: 'USD' };
  if (form.type === 'swap' && form.fromCurrency === 'ETH') return { ...form, fromCurrency: 'USDC' };
  return form;
}

function formatAmount(amount, currency) {
  const maximumFractionDigits = ['ETH', 'BTC', 'SOL'].includes(currency) ? 8 : 2;
  return `${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits })} ${currency}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function typeLabel(value) {
  return TYPE_OPTIONS.find((option) => option.value === value)?.label || value;
}

function shortHash(value) {
  return `${String(value).slice(0, 8)}...${String(value).slice(-6)}`;
}
