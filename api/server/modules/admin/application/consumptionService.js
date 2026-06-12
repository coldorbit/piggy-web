import { fn, col } from 'sequelize';
import { getTeamConsumptionModel, getWebUserModel } from '../../../../db.js';
import { clean } from '../../../utils/index.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';

const FIAT_CURRENCY = 'USD';
const CRYPTO_CURRENCIES = ['USDT', 'USDC', 'ETH', 'SOL', 'BTC', 'BNB', 'MATIC', 'AVAX', 'TRX', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK'];
const CHANNELS = ['card', 'crypto', 'bank', 'cash', 'other'];

export async function listConsumptionRecords() {
  const TeamConsumption = getTeamConsumptionModel();
  const WebUser = getWebUserModel();
  const [records, totals] = await Promise.all([
    TeamConsumption.findAll({
      include: [{ model: WebUser, as: 'createdBy', attributes: ['id', 'username'] }],
      order: [['spentAt', 'DESC'], ['id', 'DESC']],
      limit: 500,
    }),
    TeamConsumption.findAll({
      attributes: ['currency', [fn('SUM', col('amount')), 'amount']],
      group: ['currency'],
      order: [['currency', 'ASC']],
    }),
  ]);

  return {
    records: records.map(formatConsumptionRecord),
    totals: totals.map((row) => ({
      currency: row.get('currency'),
      amount: Number(row.get('amount') || 0),
    })),
  };
}

export async function createConsumptionRecord(body, user) {
  const attrs = consumptionAttrsFromBody(body);
  const TeamConsumption = getTeamConsumptionModel();
  const record = await TeamConsumption.create({
    ...attrs,
    createdByUserId: user?.id || null,
  });

  return formatConsumptionRecord(record);
}

export async function updateConsumptionRecord(id, body) {
  const TeamConsumption = getTeamConsumptionModel();
  const record = await TeamConsumption.findByPk(id);
  if (!record) throw new NotFoundError('Consumption record not found');

  await record.update(consumptionAttrsFromBody(body));
  return formatConsumptionRecord(record);
}

export async function deleteConsumptionRecord(id) {
  const TeamConsumption = getTeamConsumptionModel();
  const record = await TeamConsumption.findByPk(id);
  if (!record) throw new NotFoundError('Consumption record not found');

  await record.destroy();
}

function consumptionAttrsFromBody(body = {}) {
  const amount = Number(body.amount);
  const currency = clean(body.currency).toUpperCase();
  const channel = clean(body.channel).toLowerCase();
  const notes = clean(body.notes);
  const spentAt = body.spentAt ? new Date(body.spentAt) : new Date();

  if (!Number.isFinite(amount) || amount <= 0) throw new InputError('Amount must be greater than 0');
  if (!currency || !/^[A-Z0-9]{2,10}$/.test(currency)) throw new InputError('Currency is required');
  if (!channel || !CHANNELS.includes(channel)) throw new InputError('Channel is invalid');
  if (channel !== 'crypto' && currency !== FIAT_CURRENCY) {
    throw new InputError('Non-crypto consumption must use USD');
  }
  if (channel === 'crypto' && !CRYPTO_CURRENCIES.includes(currency)) {
    throw new InputError('Crypto consumption currency is not supported');
  }
  if (Number.isNaN(spentAt.getTime())) throw new InputError('Spent date is invalid');

  return {
    amount,
    currency,
    channel,
    notes,
    spentAt,
  };
}

function formatConsumptionRecord(record) {
  const plain = typeof record.get === 'function' ? record.get({ plain: true }) : record;

  return {
    id: plain.id,
    amount: Number(plain.amount || 0),
    currency: plain.currency,
    channel: plain.channel,
    notes: plain.notes || '',
    spentAt: plain.spentAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    createdBy: plain.createdBy ? {
      id: plain.createdBy.id,
      username: plain.createdBy.username,
    } : null,
  };
}
