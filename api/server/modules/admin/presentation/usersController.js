import { ensureDefaultUsers, hashPassword, publicUser } from '../../../../auth.js';
import { ensureDefaultWorkspace, getWebUserModel, getWorkspaceModel, repositories } from '../../../../db.js';
import { userAttributesFromBody } from '../application/usersService.js';
import { InputError, handleUserWriteError } from '../../../utils/errors.js';
import { ADMIN_ROLES, ROLES, canAssignAdminRole, isSuperadmin } from '../../../utils/roles.js';

export async function listUsers(req, res, next) {
  try {
    await ensureDefaultUsers();
    const users = await repositories.listUsers({ workspaceId: workspaceIdFromQuery(req.query?.workspaceId) });
    res.json({ users: users.map(publicUser) });
  } catch (error) {
    handleUserWriteError(error, res, next);
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
    const workspace = await workspaceForUserAttrs(attrs);
    const user = await repositories.createUser({
      username: attrs.username,
      email: attrs.email,
      passwordHash: hashPassword(attrs.password),
      role: attrs.role,
      workspaceId: workspace.id,
      dailyBidGoal: attrs.dailyBidGoal,
      timezone: attrs.timezone,
    });
    user.workspace = workspace;
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

    const workspace = await workspaceForUserAttrs(attrs);
    const updates = {
      username: attrs.username,
      email: attrs.email,
      role: attrs.role,
      workspaceId: workspace.id,
      dailyBidGoal: attrs.dailyBidGoal,
      timezone: attrs.timezone,
    };
    if (attrs.password) updates.passwordHash = hashPassword(attrs.password);
    await user.update(updates);
    await user.reload({ include: [{ model: getWorkspaceModel(), as: 'workspace', required: false }] });
    res.json({ user: publicUser(user) });
  } catch (error) {
    handleUserWriteError(error, res, next);
  }
}

async function workspaceForUserAttrs(attrs) {
  if (!attrs.workspaceId) return ensureDefaultWorkspace();

  const workspace = await getWorkspaceModel().findByPk(attrs.workspaceId);
  if (!workspace) {
    throw new InputError('Workspace not found');
  }
  return workspace;
}

function workspaceIdFromQuery(value) {
  if (!value || value === 'all') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new InputError('Workspace filter is invalid');
  return id;
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
