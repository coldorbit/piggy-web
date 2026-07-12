import CreditCardIcon from '@mui/icons-material/CreditCard';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { formatAmount } from '../consumption/consumptionFormatters.js';

export default function DashboardConsumptionPanel({ consumption = {} }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, boxShadow: 1 }}>
      <Box sx={{ mb: 1.25 }}>
        <Typography fontWeight={600}>Consumption by payment method</Typography>
        <Typography variant="body2" color="text.secondary">
          Actual card payments and crypto spending recorded during the selected period.
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.25 }}>
        <ConsumptionChannel
          color="#0067C0"
          emptyLabel="No card spending in this period"
          icon={<CreditCardIcon />}
          label="Card"
          rows={consumption.card || []}
        />
        <ConsumptionChannel
          color="#7C3AED"
          emptyLabel="No crypto spending in this period"
          icon={<CurrencyBitcoinIcon />}
          label="Crypto"
          rows={consumption.crypto || []}
        />
      </Box>
    </Paper>
  );
}

function ConsumptionChannel({ color, emptyLabel, icon, label, rows }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderLeft: `4px solid ${color}`, bgcolor: 'rgba(248, 250, 252, 0.7)' }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color, mb: 1 }}>
        {icon}
        <Typography fontWeight={600}>{label}</Typography>
      </Stack>
      {rows.length ? rows.map((row) => (
        <Box
          key={`${label}-${row.currency}`}
          sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, py: 0.35 }}
        >
          <Typography fontWeight={600}>{formatAmount(row.amount, row.currency)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {row.transactionCount.toLocaleString()} transaction{row.transactionCount === 1 ? '' : 's'}
          </Typography>
        </Box>
      )) : (
        <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>
      )}
    </Paper>
  );
}
