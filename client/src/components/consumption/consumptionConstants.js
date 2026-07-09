export const CRYPTO_CURRENCIES = ['USDT', 'USDC', 'ETH', 'SOL', 'BTC', 'BNB', 'MATIC', 'AVAX', 'TRX', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK'];
export const TEAM_WALLET_DEPOSIT_CURRENCIES = ['USDC', 'USDT', 'ETH', 'SOL', 'TRX'];

export const TYPE_OPTIONS = [
  { value: 'crypto_spend', label: 'Crypto spend' },
  { value: 'wallet_deposit', label: 'Team wallet deposit' },
  { value: 'card_pay', label: 'Card pay' },
  { value: 'card_deposit', label: 'Top up main account' },
  { value: 'card_main_transfer', label: 'Main account to card' },
  { value: 'card_internal_transfer', label: 'Internal card transfer' },
  { value: 'bank_transaction_fee', label: 'Bank transaction fee' },
  { value: 'swap', label: 'Swap to ETH' },
  { value: 'eth_fee', label: 'ETH fee only' },
  { value: 'adjustment', label: 'Balance adjustment' },
];

function dateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const EMPTY_CONSUMPTION_FORM = {
  type: 'crypto_spend',
  amount: '',
  currency: 'USDC',
  toCurrency: 'USDC',
  fromCurrency: 'USDC',
  toEthAmount: '',
  ethFee: '',
  receivedUsd: '',
  cardFee: '',
  cardAccountName: 'Card USD',
  swapFee: '',
  accountName: 'USDC Wallet',
  fromAccountName: 'Main Account USD',
  toAccountName: 'Card USD',
  direction: 'inflow',
  spentBy: 'team',
  occurredAt: dateInputValue(),
  etherscanUrl: '',
  notes: '',
};

export const CURRENCY_STYLES = {
  USDC: { bg: 'rgba(0, 103, 192, 0.10)', border: '#60A5FA', fg: '#005A9E' },
  USDT: { bg: '#ECFDF5', border: '#34D399', fg: '#047857' },
  ETH: { bg: '#F5F3FF', border: '#A78BFA', fg: '#6D28D9' },
  USD: { bg: 'rgba(246, 248, 251, 0.86)', border: '#94A3B8', fg: '#334155' },
  SOL: { bg: '#FDF4FF', border: '#E879F9', fg: '#A21CAF' },
  TRX: { bg: '#FEF2F2', border: '#F87171', fg: '#B91C1C' },
  BTC: { bg: '#FFF7ED', border: '#FB923C', fg: '#C2410C' },
};
