import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import { Accordion, AccordionDetails, AccordionSummary, Grid, Stack, Typography } from '@mui/material';

const HELP_ITEMS = [
  ['Crypto spend', 'Use this for vendor payments. It subtracts the token amount and the ETH gas fee.'],
  ['Team wallet deposit', 'Use this when depositing USDC, USDT, ETH, SOL, or TRX to the team wallet. It adds the selected asset to its wallet balance.'],
  ['Card pay', 'Use this for purchases from an issued card. It subtracts the selected card balance and has no ETH fee.'],
  ['Top up main account', 'Use this when funding the card service main account from USDC/USDT. It subtracts crypto, subtracts ETH gas, adds received USD to Main Account USD, and can record top-up fees.'],
  ['Main account to card', 'Use this when moving USD from the card main account onto a card. It subtracts Main Account USD, adds the selected card balance, and can record transfer fees.'],
  ['Internal card transfer', 'Use this when moving USD between card accounts. It subtracts the source account, adds the destination account, and can record transfer fees.'],
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
