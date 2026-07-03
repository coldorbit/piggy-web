import { fn, col } from 'sequelize';
import { getUserWorkspaceMembershipModel, getWebUserModel, getWorkspaceModel } from '../../../../db.js';
import { InputError, handleInputError } from '../../../utils/errors.js';
import { formatWorkspace, workspaceAttributesFromBody } from '../application/workspacesService.js';

export async function listWorkspaces(_req, res, next) {
  try {
    const Workspace = getWorkspaceModel();
    const WebUser = getWebUserModel();
    const Membership = getUserWorkspaceMembershipModel();
    const rows = await Workspace.findAll({
      attributes: {
        include: [[fn('COUNT', col('users.id')), 'userCount']],
      },
      include: [{ model: WebUser, as: 'users', attributes: [], required: false }],
      group: ['Workspace.id'],
      order: [['name', 'ASC']],
    });
    const membershipRows = await Membership.findAll({
      attributes: ['workspaceId', [fn('COUNT', col('id')), 'membershipCount']],
      where: { status: 'active' },
      group: ['workspaceId'],
      raw: true,
    });
    const membershipCountByWorkspaceId = new Map(
      membershipRows.map((row) => [String(row.workspaceId), Number(row.membershipCount || 0)]),
    );

    res.json({
      workspaces: rows.map((row) => formatWorkspace(row, {
        membershipCount: membershipCountByWorkspaceId.get(String(row.id)) || 0,
        userCount: Number(row.get('userCount') || 0),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function createWorkspace(req, res, next) {
  try {
    const Workspace = getWorkspaceModel();
    const attrs = workspaceAttributesFromBody(req.body);
    const workspace = await Workspace.create(attrs);
    res.status(201).json({ workspace: formatWorkspace(workspace, { membershipCount: 0, userCount: 0 }) });
  } catch (error) {
    handleWorkspaceError(error, res, next);
  }
}

export async function updateWorkspace(req, res, next) {
  try {
    const Workspace = getWorkspaceModel();
    const workspace = await Workspace.findByPk(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const attrs = workspaceAttributesFromBody(req.body);
    await workspace.update(attrs);
    const [userCount, membershipCount] = await workspaceUsageCounts(workspace.id);
    res.json({ workspace: formatWorkspace(workspace, { membershipCount, userCount }) });
  } catch (error) {
    handleWorkspaceError(error, res, next);
  }
}

export async function deleteWorkspace(req, res, next) {
  try {
    const Workspace = getWorkspaceModel();
    const workspace = await Workspace.findByPk(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const [userCount, membershipCount] = await workspaceUsageCounts(workspace.id);
    if (userCount > 0) {
      throw new InputError('Move or delete workspace users before deleting this workspace');
    }
    if (membershipCount > 0) {
      throw new InputError('Remove bidder workspace memberships before deleting this workspace');
    }

    await workspace.destroy();
    res.json({ ok: true });
  } catch (error) {
    handleWorkspaceError(error, res, next);
  }
}

function workspaceUsageCounts(workspaceId) {
  return Promise.all([
    getWebUserModel().count({ where: { workspaceId } }),
    getUserWorkspaceMembershipModel().count({ where: { workspaceId, status: 'active' } }),
  ]);
}

function handleWorkspaceError(error, res, next) {
  if (error.name === 'SequelizeUniqueConstraintError') {
    res.status(409).json({ error: 'A workspace with that slug already exists' });
    return;
  }
  handleInputError(error, res, next);
}
