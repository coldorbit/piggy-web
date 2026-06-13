import { TYPE_OPTIONS } from './consumptionConstants.js';

export function formatAmount(amount, currency) {
  const maximumFractionDigits = ['ETH', 'BTC', 'SOL'].includes(currency) ? 8 : 2;
  return `${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits })} ${currency}`;
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

export function typeLabel(value) {
  return TYPE_OPTIONS.find((option) => option.value === value)?.label || value;
}

export function shortHash(value) {
  return `${String(value).slice(0, 8)}...${String(value).slice(-6)}`;
}

export function normalizeForm(form) {
  if (form.type === 'card_pay') return { ...form, currency: 'USD' };
  if (form.type === 'card_main_transfer') return { ...form, currency: 'USD', fromAccountName: 'Main Account USD' };
  if (form.type === 'card_internal_transfer') return { ...form, currency: 'USD' };
  if (form.type === 'swap' && form.fromCurrency === 'ETH') return { ...form, fromCurrency: 'USDC' };
  return form;
}
