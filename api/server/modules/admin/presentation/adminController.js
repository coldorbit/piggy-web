import { ensureDefaultUsers, hashPassword, publicUser } from '../../../../auth.js';
import { getWebUserModel, repositories } from '../../../../db.js';
import {
  createConsumptionRecord,
  deleteConsumptionRecord,
  listConsumptionRecords,
  updateConsumptionRecord,
} from '../application/consumptionService.js';
import { getDashboardMetrics } from '../application/dashboardService.js';
import { userAttributesFromBody } from '../application/usersService.js';
import { handleInputError, handleUserWriteError } from '../../../utils/errors.js';
import { ADMIN_ROLES, ROLES, canAssignAdminRole, isSuperadmin } from '../../../utils/roles.js';

export async function getDashboard(req, res, next) {
  try {
    const dashboard = await getDashboardMetrics(req.query);
    res.json({ dashboard });
  } catch (error) {
    next(error);
  }
}

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

export async function listUsers(_req, res, next) {
  try {
    await ensureDefaultUsers();
    const users = await repositories.listUsers();
    res.json({ users: users.map(publicUser) });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    await ensureDefaultUsers();
    const attrs = userAttributesFromBody(req.body, { requirePassword: true });
    if (ADMIN_ROLES.includes(attrs.role) && !canAssignAdminRole(req.user)) {
      res.status(403).json({ error: 'Only superadmins can create admin users' });
      return;
    }
    const user = await repositories.createUser({
      username: attrs.username,
      email: attrs.email,
      passwordHash: hashPassword(attrs.password),
      role: attrs.role,
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    handleUserWriteError(error, res, next);
  }
}

export async function updateUser(req, res, next) {
  try {
    await ensureDefaultUsers();
    const WebUser = getWebUserModel();
    const user = await repositories.findUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const attrs = userAttributesFromBody(req.body, { requirePassword: false });
    if (String(user.username) === String(req.user.username)) {
      if (attrs.username !== user.username || attrs.role !== user.role) {
        res.status(400).json({ error: 'You cannot change your own username or role' });
        return;
      }
    }
    if (!isSuperadmin(req.user) && user.role === ROLES.admin && attrs.role !== ROLES.admin) {
      res.status(403).json({ error: 'Only superadmins can change an admin role' });
      return;
    }
    if (!isSuperadmin(req.user) && user.role === ROLES.superadmin && attrs.role !== ROLES.superadmin) {
      res.status(403).json({ error: 'Only superadmins can change a superadmin role' });
      return;
    }
    if (!isSuperadmin(req.user) && ADMIN_ROLES.includes(attrs.role) && attrs.role !== user.role) {
      res.status(403).json({ error: 'Only superadmins can assign admin roles' });
      return;
    }
    if (ADMIN_ROLES.includes(user.role) && !ADMIN_ROLES.includes(attrs.role)) {
      const adminCount = await WebUser.count({ where: { role: ADMIN_ROLES } });
      if (adminCount <= 1) return res.status(400).json({ error: 'At least one admin or superadmin user is required' });
    }

    const updates = {
      username: attrs.username,
      email: attrs.email,
      role: attrs.role,
    };
    if (attrs.password) updates.passwordHash = hashPassword(attrs.password);
    await user.update(updates);
    res.json({ user: publicUser(user) });
  } catch (error) {
    handleUserWriteError(error, res, next);
  }
}

export async function deleteUser(req, res, next) {
  try {
    await ensureDefaultUsers();
    const WebUser = getWebUserModel();
    const user = await repositories.findUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (String(user.username) === String(req.user.username)) {
      res.status(400).json({ error: 'You cannot delete your own user' });
      return;
    }
    if (user.role === ROLES.superadmin && !isSuperadmin(req.user)) {
      res.status(403).json({ error: 'Only superadmins can delete superadmin users' });
      return;
    }
    if (ADMIN_ROLES.includes(user.role)) {
      const adminCount = await WebUser.count({ where: { role: ADMIN_ROLES } });
      if (adminCount <= 1) return res.status(400).json({ error: 'At least one admin or superadmin user is required' });
    }

    await user.destroy();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
