import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import {
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
import { useState } from 'react';
import {
  useAdminConsumption,
  useCreateConsumptionRecord,
  useDeleteConsumptionRecord,
  useUpdateConsumptionRecord,
} from '../lib/api.js';

const CHANNELS = [
  { value: 'card', label: 'Card' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];
const CURRENCIES = ['USD', 'USDT', 'ETH', 'BTC'];
const EMPTY_FORM = {
  amount: '',
  currency: 'USD',
  channel: 'card',
  spentAt: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function AdminConsumptionPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const { data, isLoading, error: queryError, refetch } = useAdminConsumption();
  const { mutate: createRecord, isPending: isCreating } = useCreateConsumptionRecord();
  const { mutate: updateRecord, isPending: isUpdating } = useUpdateConsumptionRecord();
  const { mutate: deleteRecord, isPending: isDeleting } = useDeleteConsumptionRecord();
  const records = data?.records || [];
  const totals = data?.totals || [];
  const isSaving = isCreating || isUpdating || isDeleting;

  function submitRecord(event) {
    event.preventDefault();
    setError('');
    createRecord(form, {
      onSuccess: () => setForm(EMPTY_FORM),
      onError: (recordError) => setError(recordError.message),
    });
  }

  function startEditing(record) {
    setEditingId(record.id);
    setEditing({
      amount: String(record.amount || ''),
      currency: record.currency || 'USD',
      channel: record.channel || 'other',
      spentAt: dateInputValue(record.spentAt),
      notes: record.notes || '',
    });
  }

  function saveRecord(recordId) {
    setError('');
    updateRecord(
      { recordId, recordData: editing },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditing(EMPTY_FORM);
        },
        onError: (recordError) => setError(recordError.message),
      },
    );
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
          Track team spend across card, crypto, bank, cash, and other consumption.
        </Typography>
        <IconButton type="button" onClick={() => refetch()} title="Refresh consumption">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {error || queryError ? <Alert severity="error">{error || queryError?.message}</Alert> : null}

      <Grid container spacing={1.25}>
        {totals.map((total) => (
          <Grid key={total.currency} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper variant="outlined" sx={{ p: 1.5, boxShadow: 1 }}>
              <Typography variant="caption" color="text.secondary">{total.currency}</Typography>
              <Typography variant="h5" fontWeight={900}>{formatAmount(total.amount, total.currency)}</Typography>
            </Paper>
          </Grid>
        ))}
        {!totals.length ? (
          <Grid size={{ xs: 12 }}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography color="text.secondary">No consumption has been recorded yet.</Typography>
            </Paper>
          </Grid>
        ) : null}
      </Grid>

      <ConsumptionForm
        form={form}
        isSaving={isSaving}
        submitLabel="Add consumption"
        submitIcon={<AddIcon />}
        onChange={setForm}
        onSubmit={submitRecord}
      />

      <Paper variant="outlined" sx={{ boxShadow: 1, overflow: 'hidden' }}>
        <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
          <Typography fontWeight={900}>Consumption records</Typography>
          <Typography variant="caption" color="text.secondary">
            {records.length.toLocaleString()} records, newest first.
          </Typography>
        </Box>
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Created by</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record) => (
                <ConsumptionRow
                  key={record.id}
                  editing={editing}
                  isEditing={editingId === record.id}
                  isSaving={isSaving}
                  record={record}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => removeRecord(record.id)}
                  onEdit={() => startEditing(record)}
                  onEditingChange={setEditing}
                  onSave={() => saveRecord(record.id)}
                />
              ))}
              {!records.length ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      {isLoading ? 'Loading consumption records...' : 'No consumption records yet.'}
                    </Typography>
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

function ConsumptionForm({ form, isSaving, onChange, onSubmit, submitIcon, submitLabel }) {
  return (
    <Paper component="form" variant="outlined" onSubmit={onSubmit} sx={{ p: 1.5, boxShadow: 1 }}>
      <Grid container spacing={1.25} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField required fullWidth size="small" label="Amount" type="number" inputProps={{ min: 0, step: 'any' }} value={form.amount} onChange={(event) => onChange({ ...form, amount: event.target.value })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <CurrencyField value={form.currency} onChange={(currency) => onChange({ ...form, currency })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <ChannelField value={form.channel} onChange={(channel) => onChange({ ...form, channel })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <TextField required fullWidth size="small" label="Date" type="date" value={form.spentAt} onChange={(event) => onChange({ ...form, spentAt: event.target.value })} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField fullWidth size="small" label="Notes" value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <Button fullWidth type="submit" variant="contained" disabled={isSaving} startIcon={submitIcon} sx={{ minHeight: 40 }}>
            {submitLabel}
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}

function ConsumptionRow({ editing, isEditing, isSaving, onCancel, onDelete, onEdit, onEditingChange, onSave, record }) {
  if (isEditing) {
    return (
      <TableRow hover>
        <TableCell><TextField size="small" type="date" value={editing.spentAt} onChange={(event) => onEditingChange({ ...editing, spentAt: event.target.value })} /></TableCell>
        <TableCell align="right"><TextField size="small" type="number" inputProps={{ min: 0, step: 'any' }} value={editing.amount} onChange={(event) => onEditingChange({ ...editing, amount: event.target.value })} /></TableCell>
        <TableCell><CurrencyField value={editing.currency} onChange={(currency) => onEditingChange({ ...editing, currency })} /></TableCell>
        <TableCell><ChannelField value={editing.channel} onChange={(channel) => onEditingChange({ ...editing, channel })} /></TableCell>
        <TableCell><TextField fullWidth size="small" value={editing.notes} onChange={(event) => onEditingChange({ ...editing, notes: event.target.value })} /></TableCell>
        <TableCell>{record.createdBy?.username || '-'}</TableCell>
        <TableCell align="right">
          <IconButton disabled={isSaving} onClick={onSave} title="Save"><SaveIcon /></IconButton>
          <Button disabled={isSaving} onClick={onCancel}>Cancel</Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow hover>
      <TableCell>{formatDate(record.spentAt)}</TableCell>
      <TableCell align="right">{formatAmount(record.amount, record.currency)}</TableCell>
      <TableCell>{record.currency}</TableCell>
      <TableCell>{channelLabel(record.channel)}</TableCell>
      <TableCell sx={{ maxWidth: 420 }}>
        <Typography variant="body2" noWrap title={record.notes}>{record.notes || '-'}</Typography>
      </TableCell>
      <TableCell>{record.createdBy?.username || '-'}</TableCell>
      <TableCell align="right">
        <IconButton disabled={isSaving} onClick={onEdit} title="Edit"><EditIcon /></IconButton>
        <IconButton disabled={isSaving} onClick={onDelete} title="Delete"><DeleteIcon /></IconButton>
      </TableCell>
    </TableRow>
  );
}

function CurrencyField({ value, onChange }) {
  return (
    <TextField
      required
      fullWidth
      size="small"
      label="Currency"
      value={value}
      onChange={(event) => onChange(event.target.value.toUpperCase())}
      helperText={CURRENCIES.includes(value) ? ' ' : 'Custom currency'}
    />
  );
}

function ChannelField({ value, onChange }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>Channel</InputLabel>
      <Select label="Channel" value={value} onChange={(event) => onChange(event.target.value)}>
        {CHANNELS.map((channel) => (
          <MenuItem key={channel.value} value={channel.value}>{channel.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function formatAmount(amount, currency) {
  const maximumFractionDigits = ['ETH', 'BTC'].includes(currency) ? 8 : 2;
  return `${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits })} ${currency}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function dateInputValue(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : EMPTY_FORM.spentAt;
}

function channelLabel(value) {
  return CHANNELS.find((channel) => channel.value === value)?.label || 'Other';
}
