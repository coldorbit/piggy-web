import AddIcon from '@mui/icons-material/Add';
import { Button, FormControl, Grid, InputLabel, MenuItem, Paper, Select, TextField } from '@mui/material';
import { CRYPTO_CURRENCIES, TYPE_OPTIONS } from './consumptionConstants.js';

export default function ConsumptionForm({ accountOptions, form, isSaving, onChange, onSubmit }) {
  return (
    <Paper component="form" variant="outlined" onSubmit={onSubmit} sx={{ p: 1.5, boxShadow: 1 }}>
      <Grid container spacing={1.25} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 2 }}>
          <SelectField label="Type" value={form.type} options={TYPE_OPTIONS} onChange={(type) => onChange({ type })} />
        </Grid>
        <TransactionFields accountOptions={accountOptions} form={form} onChange={onChange} />
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField fullWidth size="small" label="Date" type="date" value={form.occurredAt} onChange={(event) => onChange({ occurredAt: event.target.value })} InputLabelProps={{ shrink: true }} />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Grid container spacing={1.25} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 4 }}>
          <TextField fullWidth size="small" label="ETH tx link / hash" value={form.etherscanUrl} onChange={(event) => onChange({ etherscanUrl: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField fullWidth size="small" label="Notes" value={form.notes} onChange={(event) => onChange({ notes: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
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
        </Grid>
      </Grid>
    </Paper>
  );
}

function TransactionFields({ accountOptions, form, onChange }) {
  if (form.type === 'card_pay') return <AmountField label="USD amount" value={form.amount} onChange={(amount) => onChange({ amount })} />;
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
  if (form.type === 'eth_fee') return <AmountField label="ETH fee" value={form.ethFee} onChange={(ethFee) => onChange({ ethFee })} />;
  if (form.type === 'adjustment') {
    return (
      <>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <SelectField label="Account" value={form.accountName} options={accountOptions.map((name) => ({ value: name, label: name }))} onChange={(accountName) => onChange({ accountName })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <SelectField label="Direction" value={form.direction} options={[{ value: 'inflow', label: 'Increase' }, { value: 'outflow', label: 'Decrease' }]} onChange={(direction) => onChange({ direction })} />
        </Grid>
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
        {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
      </Select>
    </FormControl>
  );
}
