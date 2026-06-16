import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import { Accordion, AccordionDetails, AccordionSummary, Box, Drawer, IconButton, Stack, Typography } from '@mui/material';

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
          bgcolor: '#F8FAFC',
        },
      }}
    >
      <Box sx={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            flex: '0 0 auto',
            minHeight: 56,
            px: 1.5,
            py: 1,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              bgcolor: '#EFF6FF',
              color: 'primary.main',
              flexShrink: 0,
            }}
          >
            <HelpOutlinedIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={900} lineHeight={1.2}>Help & FAQ</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              Transaction type guide
            </Typography>
          </Box>
          <IconButton aria-label="Close help" onClick={onClose} sx={closeButtonSx}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', px: 1.25, py: 1.25 }}>
          {HELP_ITEMS.map(([title, text], index) => (
            <Accordion key={title} defaultExpanded={index === 0} disableGutters variant="outlined" sx={accordionSx}>
              <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={accordionSummarySx}>
                <Typography fontWeight={900} variant="body2">{title}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 1.25, pt: 0, pb: 1.25 }}>
                <Typography color="text.secondary" variant="body2">{text}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Box>
    </Drawer>
  );
}

const closeButtonSx = {
  width: 34,
  height: 34,
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  bgcolor: 'background.paper',
  '&:hover': {
    bgcolor: '#F8FAFC',
  },
};

const accordionSx = {
  mb: 0.75,
  overflow: 'hidden',
  borderColor: 'divider',
  boxShadow: 0,
  bgcolor: 'background.paper',
  borderRadius: '6px !important',
  '&:before': { display: 'none' },
};

const accordionSummarySx = {
  minHeight: 42,
  px: 1.25,
  '&.Mui-expanded': {
    minHeight: 42,
  },
  '& .MuiAccordionSummary-content': {
    my: 0.75,
  },
  '& .MuiAccordionSummary-content.Mui-expanded': {
    my: 0.75,
  },
};
