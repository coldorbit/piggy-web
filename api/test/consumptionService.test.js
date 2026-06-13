import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildConsumptionLedgerEntries } from '../server/modules/admin/application/consumptionService.js';

const accounts = [
  { id: 1, name: 'Main Account USD', currency: 'USD', type: 'card_main' },
  { id: 2, name: 'Card USD', currency: 'USD', type: 'card' },
  { id: 3, name: 'Backup Card USD', currency: 'USD', type: 'card' },
  { id: 4, name: 'USDC Wallet', currency: 'USDC', type: 'crypto_wallet' },
];

describe('consumption card transfers', () => {
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
      /Card transfer accounts must both be card accounts/,
    );
  });
});
