export const CRYPTO_CURRENCIES = ['USDT', 'USDC', 'ETH', 'SOL', 'BTC', 'BNB', 'MATIC', 'AVAX', 'TRX', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK'];

export const TYPE_OPTIONS = [
  { value: 'crypto_spend', label: 'Crypto spend' },
  { value: 'card_pay', label: 'Card pay' },
  { value: 'card_deposit', label: 'Deposit to card' },
  { value: 'card_main_transfer', label: 'Main account to card' },
  { value: 'card_internal_transfer', label: 'Internal card transfer' },
  { value: 'swap', label: 'Swap to ETH' },
  { value: 'eth_fee', label: 'ETH fee only' },
  { value: 'adjustment', label: 'Balance adjustment' },
];

export const EMPTY_CONSUMPTION_FORM = {
  type: 'crypto_spend',
  amount: '',
  currency: 'USDC',
  fromCurrency: 'USDC',
  toEthAmount: '',
  ethFee: '',
  receivedUsd: '',
  cardFee: '',
  swapFee: '',
  accountName: 'USDC Wallet',
  fromAccountName: 'Main Account USD',
  toAccountName: 'Card USD',
  direction: 'inflow',
  spentBy: 'team',
  occurredAt: new Date().toISOString().slice(0, 10),
  etherscanUrl: '',
  notes: '',
};

export const CURRENCY_STYLES = {
  USDC: { bg: '#EFF6FF', border: '#60A5FA', fg: '#1D4ED8' },
  USDT: { bg: '#ECFDF5', border: '#34D399', fg: '#047857' },
  ETH: { bg: '#F5F3FF', border: '#A78BFA', fg: '#6D28D9' },
  USD: { bg: '#F8FAFC', border: '#94A3B8', fg: '#334155' },
  SOL: { bg: '#FDF4FF', border: '#E879F9', fg: '#A21CAF' },
  BTC: { bg: '#FFF7ED', border: '#FB923C', fg: '#C2410C' },
};
