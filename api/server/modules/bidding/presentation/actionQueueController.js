import { getActionQueue } from '../application/actionQueueService.js';
import { handleInputError } from '../../../utils/errors.js';

export async function listActionQueue(req, res, next) {
  try {
    const queue = await getActionQueue(req);
    res.json({ queue });
  } catch (error) {
    handleInputError(error, res, next);
  }
}
