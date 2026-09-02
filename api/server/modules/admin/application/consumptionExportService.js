import ExcelJS from 'exceljs';
import { InputError } from '../../../utils/errors.js';
import { listConsumptionTransactions } from './consumptionService.js';

const EXPORT_PERIODS = new Set(['weekly', 'monthly']);
const HEADER_FILL = 'FF1F4E78';
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

export async function createConsumptionExport(query = {}) {
  const request = consumptionExportRequest(query);
  const transactions = await listConsumptionTransactions({ from: request.from, to: request.to });
  const buffer = await buildConsumptionWorkbook({ ...request, transactions });
  return { buffer, filename: request.filename };
}

export function consumptionExportRequest(query = {}) {
  const period = String(query.period || '').trim().toLowerCase();
  if (!EXPORT_PERIODS.has(period)) throw new InputError('Consumption export period must be weekly or monthly');

  const fromDate = calendarDate(query.from, 'Export start date');
  const toDate = calendarDate(query.to, 'Export end date');
  if (toDate <= fromDate) throw new InputError('Export end date must be after the start date');
  validatePeriodRange(period, fromDate, toDate);

  const from = utcDate(fromDate);
  const to = utcDate(toDate);
  const inclusiveEnd = addUtcDays(to, -1).toISOString().slice(0, 10);
  const suffix = period === 'monthly' ? fromDate.slice(0, 7) : `${fromDate}-to-${inclusiveEnd}`;
  return {
    period,
    from,
    to,
    fromDate,
    toDate,
    filename: `consumption-${period}-${suffix}.xlsx`,
  };
}

export async function buildConsumptionWorkbook({ period, fromDate, toDate, transactions = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ApplyPilot';
  workbook.created = new Date();
  workbook.modified = new Date();

  addSummarySheet(workbook, { period, fromDate, toDate, transactions });
  addTransactionsSheet(workbook, transactions);
  return workbook.xlsx.writeBuffer();
}

function addSummarySheet(workbook, { period, fromDate, toDate, transactions }) {
  const sheet = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 7 }] });
  const inclusiveEnd = addUtcDays(utcDate(toDate), -1).toISOString().slice(0, 10);
  sheet.addRow(['Consumption export']);
  sheet.addRow([]);
  sheet.addRow(['Period', period === 'weekly' ? 'Week' : 'Month']);
  sheet.addRow(['Start date', fromDate]);
  sheet.addRow(['End date', inclusiveEnd]);
  sheet.addRow(['Transactions', transactions.length]);
  sheet.addRow([]);
  sheet.addRow(['Currency', 'Inflow', 'Outflow', 'Net flow']);

  for (const row of currencySummary(transactions)) {
    sheet.addRow([row.currency, row.inflow, row.outflow, row.inflow - row.outflow]);
  }

  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F4E78' } };
  styleHeaderRow(sheet.getRow(8));
  sheet.columns = [
    { width: 22 },
    { width: 18, style: { numFmt: '#,##0.00000000' } },
    { width: 18, style: { numFmt: '#,##0.00000000' } },
    { width: 18, style: { numFmt: '#,##0.00000000;[Red]-#,##0.00000000' } },
  ];
}

function addTransactionsSheet(workbook, transactions) {
  const sheet = workbook.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Transaction ID', key: 'transactionId', width: 16 },
    { header: 'Date', key: 'date', width: 13, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Type', key: 'type', width: 24 },
    { header: 'Spent by', key: 'spentBy', width: 22 },
    { header: 'Account', key: 'account', width: 24 },
    { header: 'Direction', key: 'direction', width: 12 },
    { header: 'Amount', key: 'amount', width: 18, style: { numFmt: '#,##0.00000000' } },
    { header: 'Signed amount', key: 'signedAmount', width: 18, style: { numFmt: '#,##0.00000000;[Red]-#,##0.00000000' } },
    { header: 'Currency', key: 'currency', width: 12 },
    { header: 'Entry kind', key: 'entryKind', width: 24 },
    { header: 'Notes', key: 'notes', width: 42 },
    { header: 'Transaction hash', key: 'transactionHash', width: 32 },
    { header: 'Etherscan URL', key: 'etherscanUrl', width: 42 },
    { header: 'Created by', key: 'createdBy', width: 22 },
  ];

  for (const transaction of transactions) {
    for (const entry of transaction.entries || []) {
      const amount = Number(entry.amount || 0);
      sheet.addRow({
        transactionId: String(transaction.id),
        date: excelDate(transaction.occurredAt),
        type: readableLabel(transaction.type),
        spentBy: transaction.spentBy?.label || 'Team',
        account: entry.accountName || '',
        direction: readableLabel(entry.direction),
        amount,
        signedAmount: entry.direction === 'inflow' ? amount : -amount,
        currency: entry.currency || '',
        entryKind: readableLabel(entry.entryKind),
        notes: transaction.notes || '',
        transactionHash: transaction.txHash || '',
        etherscanUrl: transaction.etherscanUrl || '',
        createdBy: transaction.createdBy?.username || '',
      });
    }
  }

  styleHeaderRow(sheet.getRow(1));
  sheet.autoFilter = { from: 'A1', to: 'N1' };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true };
  });
}

function currencySummary(transactions) {
  const totals = new Map();
  for (const transaction of transactions) {
    for (const entry of transaction.entries || []) {
      const current = totals.get(entry.currency) || { currency: entry.currency, inflow: 0, outflow: 0 };
      current[entry.direction === 'inflow' ? 'inflow' : 'outflow'] += Number(entry.amount || 0);
      totals.set(entry.currency, current);
    }
  }
  return [...totals.values()].sort((left, right) => String(left.currency).localeCompare(String(right.currency)));
}

function validatePeriodRange(period, fromDate, toDate) {
  const from = utcDate(fromDate);
  const to = utcDate(toDate);
  if (period === 'weekly' && addUtcDays(from, 7).getTime() !== to.getTime()) {
    throw new InputError('Weekly consumption exports must cover exactly seven days');
  }
  if (period === 'monthly') {
    const nextMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    if (from.getUTCDate() !== 1 || nextMonth.getTime() !== to.getTime()) {
      throw new InputError('Monthly consumption exports must cover one calendar month');
    }
  }
}

function calendarDate(value, label) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new InputError(`${label} is invalid`);
  const date = utcDate(text);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new InputError(`${label} is invalid`);
  return text;
}

function utcDate(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function excelDate(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? utcDate(date) : null;
}

function readableLabel(value) {
  const text = String(value || '').replace(/_/g, ' ');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : '';
}

function styleHeaderRow(row) {
  row.font = HEADER_FONT;
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: 'middle' };
}
