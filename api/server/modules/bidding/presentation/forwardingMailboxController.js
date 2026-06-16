import { ensureWebModels } from '../../../../db.js';
import { handleInputError } from '../../../utils/errors.js';
import {
  currentMailboxAdmin,
  forwardingMailboxStatus,
  listForwardedInboxMessages,
  listForwardedProfileMessages,
  mailboxProfileForRequest,
} from '../application/forwardingMailboxService.js';

export async function getForwardingMailboxStatus(_req, res, next) {
  try {
    await ensureWebModels();
    res.json(forwardingMailboxStatus());
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listForwardingMailboxMessages(req, res, next) {
  try {
    await ensureWebModels();
    await currentMailboxAdmin(req);
    res.json(await listForwardedInboxMessages({ limit: req.query?.limit }));
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listProfileForwardedMessages(req, res, next) {
  try {
    await ensureWebModels();
    const { profile } = await mailboxProfileForRequest(req, req.params.id);
    res.json(await listForwardedProfileMessages(profile, { limit: req.query?.limit, offset: req.query?.offset }));
  } catch (error) {
    handleInputError(error, res, next);
  }
}
