import { Alert, Box, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import RefreshButton from '../components/common/RefreshButton.jsx';
import BalanceCards from '../components/consumption/BalanceCards.jsx';
import ConsumptionForm from '../components/consumption/ConsumptionForm.jsx';
import ConsumptionHelp from '../components/consumption/ConsumptionHelp.jsx';
import TransactionLedger from '../components/consumption/TransactionLedger.jsx';
import { EMPTY_CONSUMPTION_FORM } from '../components/consumption/consumptionConstants.js';
import { normalizeForm } from '../components/consumption/consumptionFormatters.js';
import { useAdminConsumption, useCreateConsumptionRecord, useDeleteConsumptionRecord } from '../lib/api.js';

export default function AdminConsumptionPage() {
  const [form, setForm] = useState(EMPTY_CONSUMPTION_FORM);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const { data, isFetching, isLoading, error: queryError, refetch } = useAdminConsumption();
  const { mutate: createRecord, isPending: isCreating } = useCreateConsumptionRecord();
  const { mutate: deleteRecord, isPending: isDeleting } = useDeleteConsumptionRecord();
  const accounts = data?.accounts || data?.balances || [];
  const transactions = data?.transactions || data?.records || [];
  const spenderOptions = data?.spenderOptions || [{ value: 'team', label: 'Team' }];
  const accountOptions = useMemo(() => accounts.map((account) => account.name), [accounts]);
  const isSaving = isCreating || isDeleting;

  useEffect(() => {
    if (data) setLastUpdatedAt(new Date());
  }, [data]);

  function submitRecord(event) {
    event.preventDefault();
    setError('');
    createRecord(form, {
      onSuccess: () => setForm(EMPTY_CONSUMPTION_FORM),
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
        <RefreshButton isRefreshing={isFetching} lastUpdatedAt={lastUpdatedAt} onRefresh={refetch} />
      </Stack>

      {error || queryError ? <Alert severity="error">{error || queryError?.message}</Alert> : null}

      <BalanceCards accounts={accounts} />
      <ConsumptionForm accountOptions={accountOptions} form={form} isSaving={isSaving} onChange={updateForm} onSubmit={submitRecord} spenderOptions={spenderOptions} />
      <ConsumptionHelp />
      <TransactionLedger isLoading={isLoading} isSaving={isSaving} transactions={transactions} onDelete={removeRecord} />
    </Box>
  );
}
