import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import {
  buildConsumptionWorkbook,
  consumptionExportRequest,
} from '../server/modules/admin/application/consumptionExportService.js';

describe('consumption Excel exports', () => {
  it('accepts weekly and monthly calendar ranges and builds descriptive filenames', () => {
    const weekly = consumptionExportRequest({ period: 'weekly', from: '2026-08-30', to: '2026-09-06' });
    const monthly = consumptionExportRequest({ period: 'monthly', from: '2026-09-01', to: '2026-10-01' });

    assert.equal(weekly.filename, 'consumption-weekly-2026-08-30-to-2026-09-05.xlsx');
    assert.equal(monthly.filename, 'consumption-monthly-2026-09.xlsx');
    assert.equal(weekly.from.toISOString(), '2026-08-30T00:00:00.000Z');
    assert.equal(monthly.to.toISOString(), '2026-10-01T00:00:00.000Z');
  });

  it('rejects unsupported or malformed export ranges', () => {
    assert.throws(
      () => consumptionExportRequest({ period: 'daily', from: '2026-09-01', to: '2026-09-02' }),
      /must be weekly or monthly/,
    );
    assert.throws(
      () => consumptionExportRequest({ period: 'weekly', from: '2026-09-01', to: '2026-09-05' }),
      /exactly seven days/,
    );
    assert.throws(
      () => consumptionExportRequest({ period: 'monthly', from: '2026-09-02', to: '2026-10-01' }),
      /one calendar month/,
    );
  });

  it('creates a summary and a flattened ledger-entry worksheet', async () => {
    const buffer = await buildConsumptionWorkbook({
      period: 'weekly',
      fromDate: '2026-08-30',
      toDate: '2026-09-06',
      transactions: [
        {
          id: 41,
          occurredAt: '2026-09-02T12:00:00.000Z',
          type: 'card_main_transfer',
          spentBy: { label: 'Team' },
          notes: 'Fund project card',
          txHash: '',
          etherscanUrl: '',
          createdBy: { username: 'admin' },
          entries: [
            { accountName: 'Main Account USD', direction: 'outflow', amount: 100, currency: 'USD', entryKind: 'card_transfer' },
            { accountName: 'Card USD', direction: 'inflow', amount: 100, currency: 'USD', entryKind: 'card_transfer' },
          ],
        },
        {
          id: 42,
          occurredAt: '2026-09-01T12:00:00.000Z',
          type: 'eth_fee',
          spentBy: { label: 'Alex' },
          notes: '',
          txHash: '0xabc',
          etherscanUrl: 'https://etherscan.io/tx/0xabc',
          createdBy: null,
          entries: [
            { accountName: 'ETH Wallet', direction: 'outflow', amount: 0.002, currency: 'ETH', entryKind: 'eth_network_fee' },
          ],
        },
      ],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const summary = workbook.getWorksheet('Summary');
    const transactions = workbook.getWorksheet('Transactions');
    assert.equal(summary.getCell('B6').value, 2);
    assert.deepEqual(summary.getRow(9).values.slice(1), ['ETH', 0, 0.002, -0.002]);
    assert.deepEqual(summary.getRow(10).values.slice(1), ['USD', 100, 100, 0]);
    assert.equal(transactions.rowCount, 4);
    assert.equal(transactions.getCell('A2').value, '41');
    assert.equal(transactions.getCell('H2').value, -100);
    assert.equal(transactions.getCell('H3').value, 100);
    assert.equal(transactions.getCell('J4').value, 'Eth network fee');
    assert.equal(transactions.autoFilter, 'A1:N1');
  });
});
