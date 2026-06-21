import { TEAM_WALLET_DEPOSIT_CURRENCIES, TYPE_OPTIONS } from './consumptionConstants.js';

export function formatAmount(amount, currency) {
  const maximumFractionDigits = ['ETH', 'BTC', 'SOL'].includes(currency) ? 8 : 2;
  return `${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits })} ${currency}`;
}

export function formatDate(value) {
  const date = dateFromCalendarValue(value);
  return date ? date.toLocaleDateString() : '-';
}

export function dateFromCalendarValue(value) {
  if (!value) return null;

  const dateText = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0];
  if (dateText) {
    const [year, month, day] = dateText.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return date;
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function typeLabel(value) {
  return TYPE_OPTIONS.find((option) => option.value === value)?.label || value;
}

export function shortHash(value) {
  return `${String(value).slice(0, 8)}...${String(value).slice(-6)}`;
}

export function normalizeForm(form) {
  if (form.type === 'wallet_deposit' && !TEAM_WALLET_DEPOSIT_CURRENCIES.includes(form.currency)) {
    return { ...form, currency: 'USDC', toCurrency: 'USDC', spentBy: 'team' };
  }
  if (form.type === 'wallet_deposit') return { ...form, toCurrency: form.currency, spentBy: 'team' };
  if (form.type === 'card_pay') return { ...form, currency: 'USD', cardAccountName: form.cardAccountName || 'Card USD' };
  if (form.type === 'card_main_transfer') return { ...form, currency: 'USD', fromAccountName: 'Main Account USD' };
  if (form.type === 'bank_transaction_fee') return { ...form, currency: 'USD', fromAccountName: 'Main Account USD' };
  if (form.type === 'card_internal_transfer') {
    return {
      ...form,
      currency: 'USD',
      fromAccountName: form.fromAccountName === 'Main Account USD' ? 'Card USD' : form.fromAccountName,
    };
  }
  if (form.type === 'swap' && form.fromCurrency === 'ETH') return { ...form, fromCurrency: 'USDC' };
  return form;
}
