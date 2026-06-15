import {
  getConsumptionAccountModel,
  getConsumptionLedgerEntryModel,
  getConsumptionTransactionModel,
  getSequelize,
  getWebUserModel,
} from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';
import { BIDDER_ROLES, ROLES } from '../../../utils/roles.js';

const FIAT_CURRENCY = 'USD';
const CRYPTO_CURRENCIES = ['USDT', 'USDC', 'ETH', 'SOL', 'BTC', 'BNB', 'MATIC', 'AVAX', 'TRX', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK'];
const TEAM_WALLET_DEPOSIT_CURRENCIES = ['USDC', 'USDT', 'ETH', 'SOL', 'TRX'];
const TRANSACTION_TYPES = [
  'crypto_spend',
  'wallet_deposit',
  'card_pay',
  'card_deposit',
  'card_main_transfer',
  'card_internal_transfer',
  'swap',
  'eth_fee',
  'adjustment',
];
const CARD_MAIN_ACCOUNT_NAME = 'Main Account USD';
const CARD_ACCOUNT_NAME = 'Card USD';
const SPENDER_TEAM = 'team';
const SPENDER_USER = 'user';
const EXCLUDED_SPENDER_ROLES = new Set([ROLES.caller, ...BIDDER_ROLES]);
const DEFAULT_ACCOUNTS = [
  { name: 'USDC Wallet', currency: 'USDC', type: 'crypto_wallet', sortOrder: 10 },
  { name: 'USDT Wallet', currency: 'USDT', type: 'crypto_wallet', sortOrder: 20 },
  { name: 'ETH Wallet', currency: 'ETH', type: 'crypto_wallet', sortOrder: 30 },
  { name: 'SOL Wallet', currency: 'SOL', type: 'crypto_wallet', sortOrder: 32 },
  { name: 'TRX Wallet', currency: 'TRX', type: 'crypto_wallet', sortOrder: 34 },
  { name: CARD_MAIN_ACCOUNT_NAME, currency: FIAT_CURRENCY, type: 'card_main', sortOrder: 35 },
  { name: CARD_ACCOUNT_NAME, currency: FIAT_CURRENCY, type: 'card', sortOrder: 40 },
];

export async function listConsumptionRecords() {
  await ensureDefaultConsumptionAccounts();
  const Account = getConsumptionAccountModel();
  const Transaction = getConsumptionTransactionModel();
  const LedgerEntry = getConsumptionLedgerEntryModel();
  const WebUser = getWebUserModel();

  const [accounts, transactions] = await Promise.all([
    Account.findAll({ where: { isActive: true }, order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    Transaction.findAll({
      include: [
        { model: WebUser, as: 'createdBy', attributes: ['id', 'username'] },
        { model: WebUser, as: 'spentByUser', attributes: ['id', 'username', 'role'] },
        { model: LedgerEntry, as: 'entries', include: [{ model: Account, as: 'account' }] },
      ],
      order: [['occurredAt', 'DESC'], ['id', 'DESC']],
      limit: 500,
    }),
  ]);
  const balances = balancesForAccounts(accounts, transactions.flatMap((transaction) => transaction.entries || []));
  const spenderOptions = await consumptionSpenderOptions();

  return {
    accounts: accounts.map((account) => formatAccount(account, balances.get(String(account.id)) || 0)),
    balances: accounts.map((account) => formatAccount(account, balances.get(String(account.id)) || 0)),
    records: transactions.map(formatTransaction),
    transactions: transactions.map(formatTransaction),
    totals: accounts.map((account) => ({ currency: account.currency, amount: balances.get(String(account.id)) || 0, accountName: account.name })),
    transactionTypes: TRANSACTION_TYPES,
    cryptoCurrencies: CRYPTO_CURRENCIES,
    teamWalletDepositCurrencies: TEAM_WALLET_DEPOSIT_CURRENCIES,
    spenderOptions,
  };
}

export async function createConsumptionRecord(body, user) {
  await ensureDefaultConsumptionAccounts();
  const attrs = await transactionAttrsFromBody(body);
  const entries = await ledgerEntriesFromBody(attrs, body);
  const sequelize = getSequelize();
  const Transaction = getConsumptionTransactionModel();
  const LedgerEntry = getConsumptionLedgerEntryModel();

  const transaction = await sequelize.transaction(async (dbTransaction) => {
    const created = await Transaction.create(
      {
        type: attrs.type,
        occurredAt: attrs.occurredAt,
        notes: attrs.notes,
        etherscanUrl: attrs.etherscanUrl,
        txHash: attrs.txHash,
        spentByType: attrs.spentByType,
        spentByUserId: attrs.spentByUserId,
        createdByUserId: user?.id || null,
      },
      { transaction: dbTransaction },
    );
    await LedgerEntry.bulkCreate(
      entries.map((entry) => ({ ...entry, transactionId: created.id })),
      { transaction: dbTransaction },
    );
    return created;
  });

  return transactionWithEntries(transaction.id);
}

export async function updateConsumptionRecord() {
  throw new InputError('Consumption ledger transactions cannot be edited. Delete and re-enter the transaction.');
}

export async function deleteConsumptionRecord(id) {
  const Transaction = getConsumptionTransactionModel();
  const LedgerEntry = getConsumptionLedgerEntryModel();
  const transaction = await Transaction.findByPk(id);
  if (!transaction) throw new NotFoundError('Consumption transaction not found');

  await getSequelize().transaction(async (dbTransaction) => {
    await LedgerEntry.destroy({ where: { transactionId: transaction.id }, transaction: dbTransaction });
    await transaction.destroy({ transaction: dbTransaction });
  });
}

async function ensureDefaultConsumptionAccounts() {
  const Account = getConsumptionAccountModel();
  for (const account of DEFAULT_ACCOUNTS) {
    await Account.findOrCreate({
      where: { name: account.name },
      defaults: account,
    });
  }
}

async function transactionAttrsFromBody(body = {}) {
  const type = clean(body.type || 'crypto_spend');
  const occurredAt = body.occurredAt || body.spentAt ? new Date(body.occurredAt || body.spentAt) : new Date();
  const notes = clean(body.notes);
  const etherscanUrl = clean(body.etherscanUrl);
  const txHash = txHashFromValue(body.txHash || etherscanUrl);
  let { spentByType, spentByUserId } = await spenderAttrsFromBody(body);

  if (!TRANSACTION_TYPES.includes(type)) throw new InputError('Transaction type is invalid');
  if (Number.isNaN(occurredAt.getTime())) throw new InputError('Transaction date is invalid');
  if (type === 'wallet_deposit') {
    spentByType = SPENDER_TEAM;
    spentByUserId = null;
  }

  return { type, occurredAt, notes, etherscanUrl: etherscanUrl || null, txHash: txHash || null, spentByType, spentByUserId };
}

async function spenderAttrsFromBody(body = {}) {
  const rawValue = clean(body.spentBy || body.spentByUserId || SPENDER_TEAM);
  if (!rawValue || rawValue === SPENDER_TEAM) return { spentByType: SPENDER_TEAM, spentByUserId: null };

  const userId = Number(rawValue);
  if (!Number.isInteger(userId) || userId <= 0) throw new InputError('Spender is invalid');

  const user = await getWebUserModel().findByPk(userId, { attributes: ['id', 'role'] });
  if (!user || EXCLUDED_SPENDER_ROLES.has(user.role)) throw new InputError('Selected spender is not eligible');

  return { spentByType: SPENDER_USER, spentByUserId: user.id };
}

async function ledgerEntriesFromBody(attrs, body = {}) {
  const accounts = await accountsByName();
  return buildConsumptionLedgerEntries(attrs, body, accounts);
}

export function buildConsumptionLedgerEntries(attrs, body = {}, accountRows = []) {
  const accounts = accountRows instanceof Map ? accountRows : new Map(accountRows.map((account) => [account.name, account]));
  const entries = [];
  const add = (accountName, direction, amount, currency, entryKind) => {
    const account = accounts.get(accountName);
    const numericAmount = Number(amount || 0);
    if (!account) throw new InputError(`${accountName} account is not configured`);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    entries.push({ accountId: account.id, direction, amount: numericAmount, currency, entryKind });
  };
  const addAccountEntry = (account, direction, amount, entryKind) => {
    const numericAmount = Number(amount || 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    entries.push({ accountId: account.id, direction, amount: numericAmount, currency: account.currency, entryKind });
  };
  const transfer = ({ fromAccountName, toAccountName, amount, fee, entryKind, validateAccounts = validateCardTransferAccounts }) => {
    const fromAccount = accountForTransfer(accounts, fromAccountName, 'From account');
    const toAccount = accountForTransfer(accounts, toAccountName, 'To account');
    const numericAmount = transferAmount(amount);

    if (String(fromAccount.id) === String(toAccount.id) || fromAccount.name === toAccount.name) {
      throw new InputError('Transfer accounts must be different');
    }
    validateAccounts(fromAccount, toAccount);
    if (fromAccount.currency !== toAccount.currency) {
      throw new InputError('Transfer accounts must use the same currency');
    }

    addAccountEntry(fromAccount, 'outflow', numericAmount, entryKind);
    addAccountEntry(toAccount, 'inflow', numericAmount, entryKind);
    addAccountEntry(fromAccount, 'outflow', fee, 'card_fee');
  };

  if (attrs.type === 'crypto_spend') {
    const currency = cryptoCurrency(body.currency || body.fromCurrency);
    add(`${currency} Wallet`, 'outflow', body.amount, currency, 'principal');
    add('ETH Wallet', 'outflow', body.ethFee, 'ETH', 'eth_network_fee');
  } else if (attrs.type === 'wallet_deposit') {
    const currency = teamWalletDepositCurrency(body.currency || body.toCurrency);
    add(`${currency} Wallet`, 'inflow', body.amount, currency, 'principal');
  } else if (attrs.type === 'card_pay') {
    const accountName = clean(body.cardAccountName || body.accountName) || CARD_ACCOUNT_NAME;
    const account = accounts.get(accountName);
    if (!account || !isIssuedCardAccount(account)) throw new InputError('Card pay account must be an issued card account');
    add(account.name, 'outflow', body.amount, FIAT_CURRENCY, 'principal');
  } else if (attrs.type === 'card_deposit') {
    const currency = cryptoCurrency(body.currency || body.fromCurrency);
    add(`${currency} Wallet`, 'outflow', body.amount, currency, 'principal');
    add('ETH Wallet', 'outflow', body.ethFee, 'ETH', 'eth_network_fee');
    add(CARD_MAIN_ACCOUNT_NAME, 'inflow', body.receivedUsd, FIAT_CURRENCY, 'principal');
    add(CARD_MAIN_ACCOUNT_NAME, 'outflow', body.cardFee, FIAT_CURRENCY, 'card_fee');
  } else if (attrs.type === 'card_main_transfer') {
    transfer({
      fromAccountName: CARD_MAIN_ACCOUNT_NAME,
      toAccountName: clean(body.toAccountName) || CARD_ACCOUNT_NAME,
      amount: body.amount,
      fee: body.cardFee,
      entryKind: 'card_transfer',
      validateAccounts: validateMainToIssuedCardTransferAccounts,
    });
  } else if (attrs.type === 'card_internal_transfer') {
    transfer({
      fromAccountName: clean(body.fromAccountName),
      toAccountName: clean(body.toAccountName),
      amount: body.amount,
      fee: body.cardFee,
      entryKind: 'internal_card_transfer',
      validateAccounts: validateIssuedCardTransferAccounts,
    });
  } else if (attrs.type === 'swap') {
    const fromCurrency = cryptoCurrency(body.fromCurrency || body.currency);
    add(`${fromCurrency} Wallet`, 'outflow', body.fromAmount || body.amount, fromCurrency, 'principal');
    add('ETH Wallet', 'inflow', body.toEthAmount, 'ETH', 'principal');
    add('ETH Wallet', 'outflow', body.ethFee, 'ETH', 'eth_network_fee');
    add(`${fromCurrency} Wallet`, 'outflow', body.swapFee, fromCurrency, 'swap_fee');
  } else if (attrs.type === 'eth_fee') {
    add('ETH Wallet', 'outflow', body.ethFee || body.amount, 'ETH', 'eth_network_fee');
  } else if (attrs.type === 'adjustment') {
    const accountName = clean(body.accountName);
    const account = accounts.get(accountName);
    if (!account) throw new InputError('Adjustment account is required');
    const direction = clean(body.direction || 'inflow');
    if (!['inflow', 'outflow'].includes(direction)) throw new InputError('Adjustment direction is invalid');
    add(account.name, direction, body.amount, account.currency, 'adjustment');
  }

  if (!entries.length) throw new InputError('Transaction must include at least one ledger entry');
  return entries;
}

function accountForTransfer(accounts, accountName, label) {
  const name = clean(accountName);
  const account = accounts.get(name);
  if (!account) throw new InputError(`${label} is required`);
  return account;
}

function transferAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new InputError('Transfer amount must be greater than zero');
  return amount;
}

function validateCardTransferAccounts(fromAccount, toAccount) {
  if (!String(fromAccount?.type || '').startsWith('card') || !String(toAccount?.type || '').startsWith('card')) {
    throw new InputError('Card transfer accounts must both be card accounts');
  }
}

function validateMainToIssuedCardTransferAccounts(fromAccount, toAccount) {
  if (!isMainCardAccount(fromAccount) || !isIssuedCardAccount(toAccount)) {
    throw new InputError('Main account transfers must move from the main account to an issued card account');
  }
}

function validateIssuedCardTransferAccounts(fromAccount, toAccount) {
  if (!isIssuedCardAccount(fromAccount) || !isIssuedCardAccount(toAccount)) {
    throw new InputError('Internal card transfers must use issued card accounts');
  }
}

function isMainCardAccount(account) {
  return account?.type === 'card_main';
}

function isIssuedCardAccount(account) {
  return account?.type === 'card';
}

async function accountsByName() {
  const accounts = await getConsumptionAccountModel().findAll({ where: { isActive: true } });
  return new Map(accounts.map((account) => [account.name, account]));
}

async function transactionWithEntries(id) {
  const transaction = await getConsumptionTransactionModel().findByPk(id, {
    include: [
      { model: getWebUserModel(), as: 'createdBy', attributes: ['id', 'username'] },
      { model: getWebUserModel(), as: 'spentByUser', attributes: ['id', 'username', 'role'] },
      { model: getConsumptionLedgerEntryModel(), as: 'entries', include: [{ model: getConsumptionAccountModel(), as: 'account' }] },
    ],
  });
  return formatTransaction(transaction);
}

async function consumptionSpenderOptions() {
  const users = await getWebUserModel().findAll({
    attributes: ['id', 'username', 'role'],
    order: [['username', 'ASC']],
  });

  return [
    { value: SPENDER_TEAM, label: 'Team', type: SPENDER_TEAM },
    ...users
      .filter((user) => !EXCLUDED_SPENDER_ROLES.has(user.role))
      .map((user) => ({
        value: String(user.id),
        label: user.username,
        type: SPENDER_USER,
        role: user.role,
      })),
  ];
}

function balancesForAccounts(accounts, entries) {
  const balances = new Map(accounts.map((account) => [String(account.id), 0]));
  for (const entry of entries) {
    const key = String(entry.accountId);
    const signedAmount = entry.direction === 'inflow' ? Number(entry.amount || 0) : -Number(entry.amount || 0);
    balances.set(key, Number(balances.get(key) || 0) + signedAmount);
  }
  return balances;
}

function formatAccount(account, balance = 0) {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    type: account.type,
    balance,
  };
}

function formatTransaction(transaction) {
  const plain = typeof transaction.get === 'function' ? transaction.get({ plain: true }) : transaction;
  return {
    id: plain.id,
    type: plain.type,
    occurredAt: plain.occurredAt,
    notes: plain.notes || '',
    etherscanUrl: plain.etherscanUrl || '',
    txHash: plain.txHash || '',
    spentBy: formatSpender(plain),
    createdBy: plain.createdBy ? { id: plain.createdBy.id, username: plain.createdBy.username } : null,
    entries: (plain.entries || []).map((entry) => ({
      id: entry.id,
      accountId: entry.accountId,
      accountName: entry.account?.name || '',
      direction: entry.direction,
      amount: Number(entry.amount || 0),
      currency: entry.currency,
      entryKind: entry.entryKind,
    })),
  };
}

function formatSpender(transaction) {
  if (transaction.spentByType !== SPENDER_USER || !transaction.spentByUser) {
    return { type: SPENDER_TEAM, label: 'Team', user: null };
  }
  return {
    type: SPENDER_USER,
    label: transaction.spentByUser.username,
    user: {
      id: transaction.spentByUser.id,
      username: transaction.spentByUser.username,
      role: transaction.spentByUser.role,
    },
  };
}

function cryptoCurrency(value) {
  const currency = clean(value).toUpperCase();
  if (!CRYPTO_CURRENCIES.includes(currency)) throw new InputError('Crypto currency is not supported');
  return currency;
}

function teamWalletDepositCurrency(value) {
  const currency = cryptoCurrency(value);
  if (!TEAM_WALLET_DEPOSIT_CURRENCIES.includes(currency)) throw new InputError('Team wallet deposit currency is not supported');
  return currency;
}

function txHashFromValue(value) {
  const text = clean(value);
  const match = text.match(/0x[a-fA-F0-9]{64}/);
  if (match) return match[0].toLowerCase();

  const segments = text
    .split(/[/?#=&\s]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const hashLikeSegment = segments.reverse().find((segment) => /^[A-Za-z0-9]{20,128}$/.test(segment));
  return hashLikeSegment || '';
}
