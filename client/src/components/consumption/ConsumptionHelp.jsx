import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import { Accordion, AccordionDetails, AccordionSummary, Box, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';

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

export default function ConsumptionHelp({ isOpen, onClose }) {
  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          maxWidth: '100vw',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.25 }}>
          <HelpOutlinedIcon fontSize="small" />
          <Typography fontWeight={900} sx={{ flex: 1 }}>Help & FAQ</Typography>
          <IconButton aria-label="Close help" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />
        <Box sx={{ overflow: 'auto', p: 1.25 }}>
          {HELP_ITEMS.map(([title, text], index) => (
            <Accordion key={title} defaultExpanded={index === 0} disableGutters variant="outlined" sx={{ mb: 1, boxShadow: 0 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={900}>{title}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography color="text.secondary" variant="body2">{text}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Box>
    </Drawer>
  );
}
