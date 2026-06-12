import {
  createConsumptionRecord,
  deleteConsumptionRecord,
  listConsumptionRecords,
  updateConsumptionRecord,
} from '../application/consumptionService.js';
import { handleInputError } from '../../../utils/errors.js';

export async function listConsumption(_req, res, next) {
  try {
    const consumption = await listConsumptionRecords();
    res.json({ consumption });
  } catch (error) {
    next(error);
  }
}

export async function createConsumption(req, res, next) {
  try {
    const record = await createConsumptionRecord(req.body, req.user);
    res.status(201).json({ record });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateConsumption(req, res, next) {
  try {
    const record = await updateConsumptionRecord(req.params.id, req.body);
    res.json({ record });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteConsumption(req, res, next) {
  try {
    await deleteConsumptionRecord(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    handleInputError(error, res, next);
  }
}
