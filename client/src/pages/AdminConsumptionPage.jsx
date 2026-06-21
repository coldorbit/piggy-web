import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import TodayIcon from '@mui/icons-material/Today';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import RefreshButton from '../components/common/RefreshButton.jsx';
import BalanceCards from '../components/consumption/BalanceCards.jsx';
import ConsumptionForm from '../components/consumption/ConsumptionForm.jsx';
import ConsumptionHelp from '../components/consumption/ConsumptionHelp.jsx';
import TransactionLedger from '../components/consumption/TransactionLedger.jsx';
import { CURRENCY_STYLES, EMPTY_CONSUMPTION_FORM } from '../components/consumption/consumptionConstants.js';
import { dateFromCalendarValue, formatAmount, normalizeForm } from '../components/consumption/consumptionFormatters.js';
import { useAdminConsumption, useCreateConsumptionRecord, useDeleteConsumptionRecord } from '../lib/api.js';

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'annual', label: 'Year' },
];

export default function AdminConsumptionPage() {
  const [form, setForm] = useState(EMPTY_CONSUMPTION_FORM);
  const [error, setError] = useState('');
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [period, setPeriod] = useState('daily');
  const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
  const { data, isFetching, isLoading, error: queryError, refetch } = useAdminConsumption();
  const { mutate: createRecord, isPending: isCreating } = useCreateConsumptionRecord();
  const { mutate: deleteRecord, isPending: isDeleting } = useDeleteConsumptionRecord();
  const accounts = data?.accounts || data?.balances || [];
  const transactions = data?.transactions || data?.records || [];
  const spenderOptions = data?.spenderOptions || [{ value: 'team', label: 'Team' }];
  const accountOptions = useMemo(() => accounts.map((account) => ({ name: account.name, type: account.type })), [accounts]);
  const periodRange = useMemo(() => rangeForPeriod(period, periodAnchor), [period, periodAnchor]);
  const periodTransactions = useMemo(
    () => transactions.filter((transaction) => transactionInRange(transaction, periodRange)),
    [periodRange, transactions],
  );
  const periodSummary = useMemo(() => summarizeTransactions(periodTransactions), [periodTransactions]);
  const isSaving = isCreating || isDeleting;

  function submitRecord(event) {
    event.preventDefault();
    setError('');
    createRecord(form, {
      onSuccess: () => {
        setForm(EMPTY_CONSUMPTION_FORM);
        setIsTransactionDialogOpen(false);
      },
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

  function changePeriod(nextPeriod) {
    if (!nextPeriod) return;
    setPeriod(nextPeriod);
  }

  function movePeriod(direction) {
    setPeriodAnchor((current) => addPeriod(current, period, direction));
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      {error || queryError ? <Alert severity="error">{error || queryError?.message}</Alert> : null}

      <BalanceCards accounts={accounts} />
      <ConsumptionPeriodToolbar
        isRefreshing={isFetching}
        period={period}
        periodLabel={periodRange.label}
        onMove={movePeriod}
        onOpenHelp={() => setIsHelpDrawerOpen(true)}
        onAddTransaction={() => setIsTransactionDialogOpen(true)}
        onPeriodChange={changePeriod}
        onRefresh={refetch}
        onToday={() => setPeriodAnchor(new Date())}
      />
      <ConsumptionPeriodSummary summary={periodSummary} />
      <Dialog open={isTransactionDialogOpen} onClose={() => setIsTransactionDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Add transaction</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <ConsumptionForm
            accountOptions={accountOptions}
            form={form}
            isSaving={isSaving}
            onChange={updateForm}
            onSubmit={submitRecord}
            spenderOptions={spenderOptions}
            surface="plain"
          />
        </DialogContent>
      </Dialog>
      <ConsumptionHelp isOpen={isHelpDrawerOpen} onClose={() => setIsHelpDrawerOpen(false)} />
      <TransactionLedger
        emptyDetail={`No consumption activity was recorded for ${periodRange.label}.`}
        emptyTitle="No transactions in this period"
        isLoading={isLoading}
        isSaving={isSaving}
        subtitle={`${periodTransactions.length.toLocaleString()} transactions in ${periodRange.label}, newest first.`}
        transactions={periodTransactions}
        onDelete={removeRecord}
      />
    </Box>
  );
}

function ConsumptionPeriodToolbar({ isRefreshing, onAddTransaction, onMove, onOpenHelp, onPeriodChange, onRefresh, onToday, period, periodLabel }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.25,
        py: 1,
        boxShadow: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      <Box minWidth={0}>
        <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ textTransform: 'uppercase' }}>
          Consumption view
        </Typography>
        <Typography fontWeight={900}>{periodLabel}</Typography>
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={period}
          onChange={(_event, value) => onPeriodChange(value)}
          sx={{
            '& .MuiToggleButton-root': {
              px: 1.25,
              fontWeight: 900,
              textTransform: 'none',
            },
          }}
        >
          {PERIOD_OPTIONS.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Tooltip title="Previous period">
          <IconButton aria-label="Previous period" onClick={() => onMove(-1)} sx={periodIconButtonSx}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Next period">
          <IconButton aria-label="Next period" onClick={() => onMove(1)} sx={periodIconButtonSx}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button onClick={onToday} startIcon={<TodayIcon fontSize="small" />} size="small" variant="outlined" sx={toolbarButtonSx}>
          Today
        </Button>
        <Button onClick={onAddTransaction} startIcon={<AddIcon fontSize="small" />} size="small" variant="contained" sx={primaryToolbarButtonSx}>
          Add transaction
        </Button>
        <RefreshButton
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          sx={{
            flex: '0 0 auto',
            '& .MuiButton-root': toolbarButtonSx,
          }}
        />
        <Button onClick={onOpenHelp} startIcon={<HelpOutlinedIcon fontSize="small" />} size="small" variant="outlined" sx={toolbarButtonSx}>
          Help & FAQ
        </Button>
      </Stack>
    </Paper>
  );
}

function ConsumptionPeriodSummary({ summary }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        gap: 1.25,
      }}
    >
      <PeriodMetricCard label="Transactions" value={summary.transactionCount.toLocaleString()} detail={`${summary.spenderCount.toLocaleString()} spender${summary.spenderCount === 1 ? '' : 's'}`} />
      <PeriodMetricCard label="Outflow" values={summary.outflows} emptyValue="0" />
      <PeriodMetricCard label="Inflow" values={summary.inflows} emptyValue="0" />
      <PeriodMetricCard label="Net flow" values={summary.netFlows} emptyValue="0" />
    </Box>
  );
}

function PeriodMetricCard({ detail, emptyValue, label, value, values }) {
  const primaryCurrency = values?.[0]?.currency;
  const colors = CURRENCY_STYLES[primaryCurrency] || CURRENCY_STYLES.USD;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        boxShadow: 1,
        bgcolor: primaryCurrency ? colors.bg : 'background.paper',
        borderColor: primaryCurrency ? colors.border : 'divider',
        borderLeft: `4px solid ${primaryCurrency ? colors.border : '#CBD5E1'}`,
        minHeight: 96,
        display: 'grid',
        alignContent: 'center',
        gap: 0.35,
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ textTransform: 'uppercase' }}>
        {label}
      </Typography>
      {values ? (
        values.length ? (
          values.slice(0, 3).map((item) => (
            <Typography key={`${label}-${item.currency}`} fontWeight={900} sx={{ color: item.amount < 0 ? '#b91c1c' : colors.fg }}>
              {formatAmount(item.amount, item.currency)}
            </Typography>
          ))
        ) : (
          <Typography fontWeight={900}>{emptyValue}</Typography>
        )
      ) : (
        <Typography fontWeight={900}>{value}</Typography>
      )}
      {detail ? (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      ) : null}
    </Paper>
  );
}

function transactionInRange(transaction, range) {
  const occurredAt = dateFromCalendarValue(transaction.occurredAt);
  return occurredAt && occurredAt >= range.from && occurredAt < range.to;
}

function summarizeTransactions(transactions) {
  const byCurrency = new Map();
  const spenders = new Set();

  for (const transaction of transactions) {
    spenders.add(transaction.spentBy?.type === 'user' ? `user:${transaction.spentBy?.user?.id || transaction.spentBy?.label}` : 'team');
    for (const entry of transaction.entries || []) {
      const current = byCurrency.get(entry.currency) || { currency: entry.currency, inflow: 0, outflow: 0 };
      const amount = Number(entry.amount || 0);
      if (entry.direction === 'inflow') {
        current.inflow += amount;
      } else {
        current.outflow += amount;
      }
      byCurrency.set(entry.currency, current);
    }
  }

  const rows = [...byCurrency.values()];
  return {
    transactionCount: transactions.length,
    spenderCount: spenders.size,
    inflows: amountRows(rows, 'inflow'),
    outflows: amountRows(rows, 'outflow'),
    netFlows: rows
      .map((row) => ({ currency: row.currency, amount: row.inflow - row.outflow }))
      .filter((row) => row.amount !== 0)
      .sort(compareAmountRows),
  };
}

function amountRows(rows, key) {
  return rows
    .map((row) => ({ currency: row.currency, amount: row[key] }))
    .filter((row) => row.amount > 0)
    .sort(compareAmountRows);
}

function compareAmountRows(left, right) {
  const rightAbs = Math.abs(right.amount);
  const leftAbs = Math.abs(left.amount);
  if (rightAbs !== leftAbs) return rightAbs - leftAbs;
  return String(left.currency).localeCompare(String(right.currency));
}

function rangeForPeriod(period, anchor) {
  const start = startForPeriod(period, anchor);
  const end = addPeriod(start, period, 1);
  return {
    from: start,
    to: end,
    label: labelForPeriod(period, start, end),
  };
}

function startForPeriod(period, anchor) {
  const date = startOfDay(anchor);
  if (period === 'weekly') {
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return addDays(date, mondayOffset);
  }
  if (period === 'monthly') return new Date(date.getFullYear(), date.getMonth(), 1);
  if (period === 'annual') return new Date(date.getFullYear(), 0, 1);
  return date;
}

function addPeriod(value, period, amount) {
  const date = new Date(value);
  if (period === 'weekly') return addDays(date, amount * 7);
  if (period === 'monthly') return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  if (period === 'annual') return new Date(date.getFullYear() + amount, 0, 1);
  return addDays(date, amount);
}

function labelForPeriod(period, start, end) {
  if (period === 'annual') return String(start.getFullYear());
  if (period === 'monthly') return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (period === 'weekly') return `${shortDate(start)} - ${shortDate(addDays(end, -1))}`;
  return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function shortDate(value) {
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return startOfDay(date);
}

const periodIconButtonSx = {
  width: 34,
  height: 34,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  borderRadius: 1,
  '&:hover': {
    bgcolor: '#F8FAFC',
    borderColor: 'primary.main',
  },
};

const toolbarButtonSx = {
  minHeight: 34,
  borderRadius: 1,
  fontWeight: 900,
  textTransform: 'none',
  boxShadow: 0,
};

const primaryToolbarButtonSx = {
  ...toolbarButtonSx,
  '&:hover': {
    boxShadow: 1,
  },
};
