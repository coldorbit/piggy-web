import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, Grid, IconButton, Paper, Typography } from '@mui/material';
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
              <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 1, alignItems: 'start' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: colors.fg, fontWeight: 900 }} noWrap>{account.name}</Typography>
                  <Typography variant="h5" fontWeight={900} sx={{ color: colors.fg }}>
                    {isRevealed ? formatAmount(account.balance, account.currency) : '••••••'}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setRevealedById((current) => ({ ...current, [key]: !isRevealed }))}
                  title={isRevealed ? 'Hide balance' : 'Reveal balance'}
                  sx={{ mt: -0.5, mr: -0.5, color: colors.fg, justifySelf: 'end' }}
                >
                  {isRevealed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </Box>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}
