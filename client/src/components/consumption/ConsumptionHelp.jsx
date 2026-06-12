import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import { Accordion, AccordionDetails, AccordionSummary, Grid, Stack, Typography } from '@mui/material';

const HELP_ITEMS = [
  ['Crypto spend', 'Use this for USDC/USDT vendor payments. It subtracts the token amount and the ETH gas fee.'],
  ['Card pay', 'Use this for card purchases. It only subtracts Card USD and has no ETH fee.'],
  ['Deposit to card', 'Use this when funding card from USDC/USDT. It subtracts crypto, subtracts ETH gas, adds received USD, and can record card fees.'],
  ['Swap to ETH', 'Use this when swapping USDC/USDT into ETH for future gas. It subtracts the input token, adds ETH received, and subtracts ETH gas.'],
  ['ETH fee only', 'Use this for failed transactions or wallet actions where only gas was spent.'],
  ['Adjustment', 'Use this only when reconciling balances against the real wallet/card balance.'],
];

export default function ConsumptionHelp() {
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
          {HELP_ITEMS.map(([title, text]) => (
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
