import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildConsumptionLedgerEntries, transactionDateFromValue } from '../server/modules/admin/application/consumptionService.js';

const accounts = [
  { id: 1, name: 'Main Account USD', currency: 'USD', type: 'card_main' },
  { id: 2, name: 'Card USD', currency: 'USD', type: 'card' },
  { id: 3, name: 'Backup Card USD', currency: 'USD', type: 'card' },
  { id: 4, name: 'USDC Wallet', currency: 'USDC', type: 'crypto_wallet' },
  { id: 5, name: 'ETH Wallet', currency: 'ETH', type: 'crypto_wallet' },
  { id: 6, name: 'USDT Wallet', currency: 'USDT', type: 'crypto_wallet' },
  { id: 7, name: 'SOL Wallet', currency: 'SOL', type: 'crypto_wallet' },
  { id: 8, name: 'TRX Wallet', currency: 'TRX', type: 'crypto_wallet' },
];

describe('consumption card transfers', () => {
  it('parses date-only transaction dates without shifting to the previous local day', () => {
    const date = transactionDateFromValue('2026-06-21');

    assert.equal(date.toISOString(), '2026-06-21T12:00:00.000Z');
  });

  it('rejects impossible date-only transaction dates', () => {
    const date = transactionDateFromValue('2026-02-31');

    assert.equal(Number.isNaN(date.getTime()), true);
  });

  it('deposits supported assets to the team wallet', () => {
    const cases = [
      ['USDC', 4],
      ['USDT', 6],
      ['ETH', 5],
      ['SOL', 7],
      ['TRX', 8],
    ];

    for (const [currency, accountId] of cases) {
      const entries = buildConsumptionLedgerEntries(
        { type: 'wallet_deposit' },
        { currency, amount: '42.5' },
        accounts,
      );

      assert.deepEqual(entries, [
        { accountId, direction: 'inflow', amount: 42.5, currency, entryKind: 'principal' },
      ]);
    }
  });

  it('rejects unsupported team wallet deposit assets', () => {
    assert.throws(
      () =>
        buildConsumptionLedgerEntries(
          { type: 'wallet_deposit' },
          { currency: 'BTC', amount: 40 },
          accounts,
        ),
      /Team wallet deposit currency is not supported/,
    );
  });

  it('tops up the card service main account from crypto', () => {
    const entries = buildConsumptionLedgerEntries(
      { type: 'card_deposit' },
      { currency: 'USDC', amount: 100, ethFee: 0.002, receivedUsd: 98.5, cardFee: 1.5 },
      accounts,
    );

    assert.deepEqual(entries, [
      { accountId: 4, direction: 'outflow', amount: 100, currency: 'USDC', entryKind: 'principal' },
      { accountId: 5, direction: 'outflow', amount: 0.002, currency: 'ETH', entryKind: 'eth_network_fee' },
      { accountId: 1, direction: 'inflow', amount: 98.5, currency: 'USD', entryKind: 'principal' },
    ]);
  });

  it('pays from a selected issued card account', () => {
    const entries = buildConsumptionLedgerEntries(
      { type: 'card_pay' },
      { cardAccountName: 'Backup Card USD', amount: 25 },
      accounts,
    );

    assert.deepEqual(entries, [
      { accountId: 3, direction: 'outflow', amount: 25, currency: 'USD', entryKind: 'principal' },
    ]);
  });

  it('moves USD from the main account to a card account', () => {
    const entries = buildConsumptionLedgerEntries(
      { type: 'card_main_transfer' },
      { toAccountName: 'Card USD', amount: '125.50' },
      accounts,
    );

    assert.deepEqual(entries, [
      { accountId: 1, direction: 'outflow', amount: 125.5, currency: 'USD', entryKind: 'card_transfer' },
      { accountId: 2, direction: 'inflow', amount: 125.5, currency: 'USD', entryKind: 'card_transfer' },
    ]);
  });

  it('records main account transfer fees against the main account', () => {
    const entries = buildConsumptionLedgerEntries(
      { type: 'card_main_transfer' },
      { toAccountName: 'Card USD', amount: '125.50', cardFee: '2.25' },
      accounts,
    );

    assert.deepEqual(entries, [
      { accountId: 1, direction: 'outflow', amount: 125.5, currency: 'USD', entryKind: 'card_transfer' },
      { accountId: 2, direction: 'inflow', amount: 125.5, currency: 'USD', entryKind: 'card_transfer' },
      { accountId: 1, direction: 'outflow', amount: 2.25, currency: 'USD', entryKind: 'card_fee' },
    ]);
  });

  it('moves USD between card accounts for internal card transfers', () => {
    const entries = buildConsumptionLedgerEntries(
      { type: 'card_internal_transfer' },
      { fromAccountName: 'Card USD', toAccountName: 'Backup Card USD', amount: 40 },
      accounts,
    );

    assert.deepEqual(entries, [
      { accountId: 2, direction: 'outflow', amount: 40, currency: 'USD', entryKind: 'internal_card_transfer' },
      { accountId: 3, direction: 'inflow', amount: 40, currency: 'USD', entryKind: 'internal_card_transfer' },
    ]);
  });

  it('records internal card transfer fees against the source card account', () => {
    const entries = buildConsumptionLedgerEntries(
      { type: 'card_internal_transfer' },
      { fromAccountName: 'Card USD', toAccountName: 'Backup Card USD', amount: 40, cardFee: 1.5 },
      accounts,
    );

    assert.deepEqual(entries, [
      { accountId: 2, direction: 'outflow', amount: 40, currency: 'USD', entryKind: 'internal_card_transfer' },
      { accountId: 3, direction: 'inflow', amount: 40, currency: 'USD', entryKind: 'internal_card_transfer' },
      { accountId: 2, direction: 'outflow', amount: 1.5, currency: 'USD', entryKind: 'card_fee' },
    ]);
  });

  it('rejects card transfers to the same account', () => {
    assert.throws(
      () =>
        buildConsumptionLedgerEntries(
          { type: 'card_internal_transfer' },
          { fromAccountName: 'Card USD', toAccountName: 'Card USD', amount: 40 },
          accounts,
        ),
      /Transfer accounts must be different/,
    );
  });

  it('rejects non-card accounts for card transfers', () => {
    assert.throws(
      () =>
        buildConsumptionLedgerEntries(
          { type: 'card_internal_transfer' },
          { fromAccountName: 'USDC Wallet', toAccountName: 'Card USD', amount: 40 },
          accounts,
        ),
      /Internal card transfers must use issued card accounts/,
    );
  });

  it('rejects the main account for internal card transfers', () => {
    assert.throws(
      () =>
        buildConsumptionLedgerEntries(
          { type: 'card_internal_transfer' },
          { fromAccountName: 'Main Account USD', toAccountName: 'Card USD', amount: 40 },
          accounts,
        ),
      /Internal card transfers must use issued card accounts/,
    );
  });

  it('rejects main account transfers to another main account', () => {
    assert.throws(
      () =>
        buildConsumptionLedgerEntries(
          { type: 'card_main_transfer' },
          { toAccountName: 'Main Account USD', amount: 40 },
          accounts,
        ),
      /Transfer accounts must be different/,
    );
  });
});
