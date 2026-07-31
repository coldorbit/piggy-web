import { ensureWebModels } from '../../../../db.js';
import { handleInputError } from '../../../utils/errors.js';
import {
  forwardingMailboxStatus,
  getForwardedMailboxBootstrap,
  listForwardedInboxMessages,
  listForwardedMailboxNotificationMessages,
  listForwardedMailboxSummary,
  listForwardedProfileMessages,
  markForwardedProfileMessageRead,
  mailboxProfileForRequest,
} from '../application/forwardingMailboxService.js';

export async function getForwardingMailboxBootstrap(req, res, next) {
  try {
    await ensureWebModels();
    res.json(await getForwardedMailboxBootstrap(req, {
      limit: req.query?.limit,
      offset: req.query?.offset,
      workspaceId: req.query?.workspaceId,
    }));
  } catch (error) {
    handleInputError(error, res, next);
  }
}

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
    res.json(await listForwardedInboxMessages(req, {
      limit: req.query?.limit,
      offset: req.query?.offset,
      includeStats: req.query?.includeStats !== 'false',
      workspaceId: req.query?.workspaceId,
    }));
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function getForwardingMailboxSummary(req, res, next) {
  try {
    await ensureWebModels();
    res.json(await listForwardedMailboxSummary(req, { workspaceId: req.query?.workspaceId }));
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listForwardingMailboxNotifications(req, res, next) {
  try {
    await ensureWebModels();
    res.json(await listForwardedMailboxNotificationMessages(req, {
      limit: req.query?.limit,
      workspaceId: req.query?.workspaceId,
    }));
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listProfileForwardedMessages(req, res, next) {
  try {
    await ensureWebModels();
    const { profile } = await mailboxProfileForRequest(req, req.params.id, {
      workspaceId: req.query?.workspaceId,
    });
    res.json(await listForwardedProfileMessages(profile, {
      limit: req.query?.limit,
      offset: req.query?.offset,
      includeStats: req.query?.includeStats !== 'false',
    }));
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function markProfileForwardedMessageRead(req, res, next) {
  try {
    await ensureWebModels();
    const { profile } = await mailboxProfileForRequest(req, req.params.id);
    const message = await markForwardedProfileMessageRead(profile, { messageId: req.body?.messageId });
    res.json({ message });
  } catch (error) {
    handleInputError(error, res, next);
  }
}
