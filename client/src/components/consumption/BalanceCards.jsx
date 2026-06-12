import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Grid, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { CURRENCY_STYLES } from './consumptionConstants.js';
import { formatAmount } from './consumptionFormatters.js';

export default function BalanceCards({ accounts }) {
  const [revealedById, setRevealedById] = useState({});

  return (
    <Grid container spacing={1.25}>
      {accounts.map((account) => {
        const key = String(account.id || account.name);
        const isRevealed = Boolean(revealedById[key]);
        const colors = CURRENCY_STYLES[account.currency] || CURRENCY_STYLES.USD;

        return (
          <Grid key={key} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                boxShadow: 1,
                bgcolor: colors.bg,
                borderColor: colors.border,
                borderLeft: `4px solid ${colors.border}`,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Typography variant="caption" sx={{ color: colors.fg, fontWeight: 900 }}>{account.name}</Typography>
                <IconButton
                  size="small"
                  onClick={() => setRevealedById((current) => ({ ...current, [key]: !isRevealed }))}
                  title={isRevealed ? 'Hide balance' : 'Reveal balance'}
                  sx={{ mt: -0.5, mr: -0.5, color: colors.fg }}
                >
                  {isRevealed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </Stack>
              <Typography variant="h5" fontWeight={900} sx={{ color: colors.fg }}>
                {isRevealed ? formatAmount(account.balance, account.currency) : '••••••'}
              </Typography>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}
