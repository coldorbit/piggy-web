import { ensureDefaultUsers, hashPassword, publicUser } from '../../../../auth.js';
import { ensureDefaultWorkspace, getBidProfileModel, getSequelize, getUserWorkspaceMembershipModel, getWebUserModel, getWorkspaceModel, repositories } from '../../../../db.js';
import { transferOwnedProfiles, userAttributesFromBody } from '../application/usersService.js';
import { InputError, handleUserWriteError } from '../../../utils/errors.js';
import { ADMIN_ROLES, BIDDER_ROLES, ROLES, canAssignAdminRole, isSuperadmin } from '../../../utils/roles.js';

export async function listUsers(req, res, next) {
  try {
    await ensureDefaultUsers();
    const requestedWorkspaceId = workspaceIdFromQuery(req.query?.workspaceId);
    const workspaceId = isSuperadmin(req.user) ? requestedWorkspaceId : req.user.workspaceId;
    const users = await repositories.listUsers({ workspaceId });
    const profileCounts = await profileCountsByUserId(users.map((user) => user.id));
    for (const user of users) user.setDataValue('profileCount', profileCounts.get(String(user.id)) || 0);
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
    if (attrs.workspaceMembershipIds.length && !isSuperadmin(req.user)) {
      res.status(403).json({ error: 'Only superadmins can share bidders between workspaces' });
      return;
    }
    const workspace = await workspaceForUserAttrs(attrs, req.user);
    if (!isSuperadmin(req.user) && String(workspace.id) !== String(req.user.workspaceId)) {
      res.status(403).json({ error: 'Only superadmins can create users in another workspace' });
      return;
    }
    await ensureMembershipWorkspacesExist(attrs);
    const user = await repositories.createUser({
      username: attrs.username,
      email: attrs.email,
      passwordHash: hashPassword(attrs.password),
      role: attrs.role,
      workspaceId: workspace.id,
      dailyBidGoal: attrs.dailyBidGoal,
      timezone: attrs.timezone,
      profileHubAccess: attrs.role === ROLES.admin && isSuperadmin(req.user) ? attrs.profileHubAccess : false,
    });
    await setUserWorkspaceMemberships(user, attrs, req.user);
    await user.reload(userReloadOptions());
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
    if (!isSuperadmin(req.user) && String(user.workspaceId ?? '') !== String(req.user.workspaceId ?? '')) {
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
    if (attrs.workspaceMembershipIds.length && !isSuperadmin(req.user)) {
      res.status(403).json({ error: 'Only superadmins can share bidders between workspaces' });
      return;
    }

    const workspace = await workspaceForUserAttrs(attrs, req.user);
    const workspaceChanged = String(user.workspaceId ?? '') !== String(workspace.id ?? '');
    if (workspaceChanged && !isSuperadmin(req.user)) {
      res.status(403).json({ error: 'Only superadmins can transfer users between workspaces' });
      return;
    }
    await ensureMembershipWorkspacesExist(attrs);
    const updates = {
      username: attrs.username,
      email: attrs.email,
      role: attrs.role,
      workspaceId: workspace.id,
      dailyBidGoal: attrs.dailyBidGoal,
      timezone: attrs.timezone,
      profileHubAccess: attrs.role === ROLES.admin
        ? (isSuperadmin(req.user) ? attrs.profileHubAccess : Boolean(user.profileHubAccess))
        : false,
    };
    if (attrs.password) updates.passwordHash = hashPassword(attrs.password);
    let transferredProfileCount = 0;
    await getSequelize().transaction(async (transaction) => {
      await user.update(updates, { transaction });
      if (workspaceChanged) {
        transferredProfileCount = await transferOwnedProfiles({
          Profile: getBidProfileModel(),
          transaction,
          userId: user.id,
          workspaceId: workspace.id,
        });
      }
      await setUserWorkspaceMemberships(user, attrs, req.user, transaction);
    });
    await user.reload(userReloadOptions());
    user.setDataValue('profileCount', await getBidProfileModel().count({ where: { userId: user.id } }));
    res.json({
      user: publicUser(user),
      transfer: workspaceChanged ? { profileCount: transferredProfileCount, workspaceId: workspace.id } : null,
    });
  } catch (error) {
    handleUserWriteError(error, res, next);
  }
}

async function ensureMembershipWorkspacesExist(attrs) {
  const requestedIds = [...new Set((attrs.workspaceMembershipIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    .filter((workspaceId) => String(workspaceId) !== String(attrs.workspaceId));
  if (!requestedIds.length) return;
  const workspaces = await getWorkspaceModel().findAll({ where: { id: requestedIds } });
  if (workspaces.length !== requestedIds.length) {
    throw new InputError('One or more additional workspaces were not found');
  }
}

async function setUserWorkspaceMemberships(user, attrs, actor, transaction = undefined) {
  const Membership = getUserWorkspaceMembershipModel();
  if (!BIDDER_ROLES.includes(attrs.role)) {
    await Membership.destroy({ where: { userId: user.id }, transaction });
    return;
  }

  const requestedIds = [...new Set((attrs.workspaceMembershipIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    .filter((workspaceId) => String(workspaceId) !== String(attrs.workspaceId));
  if (requestedIds.length && !isSuperadmin(actor)) {
    throw new InputError('Only superadmins can share bidders between workspaces');
  }

  const existing = await Membership.findAll({ where: { userId: user.id }, transaction });
  const requestedIdSet = new Set(requestedIds.map(String));
  await Promise.all(existing.map(async (membership) => {
    if (!requestedIdSet.has(String(membership.workspaceId))) {
      await membership.destroy({ transaction });
    }
  }));

  const existingByWorkspaceId = new Map(existing.map((membership) => [String(membership.workspaceId), membership]));
  await Promise.all(requestedIds.map(async (workspaceId) => {
    const existingMembership = existingByWorkspaceId.get(String(workspaceId));
    const attrsForMembership = {
      userId: user.id,
      workspaceId,
      accessRole: attrs.role,
      status: 'active',
      createdByUserId: actor?.id || null,
    };
    if (existingMembership) {
      await existingMembership.update(attrsForMembership, { transaction });
      return;
    }
    await Membership.create(attrsForMembership, { transaction });
  }));
}

function userReloadOptions() {
  return {
    include: [
      { model: getWorkspaceModel(), as: 'workspace', required: false },
      {
        model: getUserWorkspaceMembershipModel(),
        as: 'workspaceMemberships',
        required: false,
        where: { status: 'active' },
        include: [{ model: getWorkspaceModel(), as: 'workspace', required: false }],
      },
    ],
  };
}

async function workspaceForUserAttrs(attrs, actor = null) {
  if (!attrs.workspaceId && actor?.workspaceId) {
    const actorWorkspace = await getWorkspaceModel().findByPk(actor.workspaceId);
    if (actorWorkspace) return actorWorkspace;
  }
  if (!attrs.workspaceId) return ensureDefaultWorkspace();

  const workspace = await getWorkspaceModel().findByPk(attrs.workspaceId);
  if (!workspace) {
    throw new InputError('Workspace not found');
  }
  return workspace;
}

async function profileCountsByUserId(userIds) {
  if (!userIds.length) return new Map();
  const rows = await getBidProfileModel().findAll({
    attributes: ['userId', [getSequelize().fn('COUNT', getSequelize().col('id')), 'profileCount']],
    where: { userId: userIds },
    group: ['userId'],
    raw: true,
  });
  return new Map(rows.map((row) => [String(row.userId), Number(row.profileCount || 0)]));
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
    if (!isSuperadmin(req.user) && String(user.workspaceId ?? '') !== String(req.user.workspaceId ?? '')) {
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
