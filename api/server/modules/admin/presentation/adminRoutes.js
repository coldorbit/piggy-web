import { requireAdmin, requireConsumptionAccess, requireSuperadmin } from '../../../middleware/authMiddleware.js';
import {
  createConsumption,
  createUser,
  createWorkspace,
  deleteConsumption,
  deleteUser,
  deleteWorkspace,
  getDashboard,
  exportConsumption,
  getWorkspaceInboxSettings,
  listConsumption,
  listUsers,
  listWorkspaceOptions,
  listWorkspaces,
  updateConsumption,
  updateUser,
  updateWorkspace,
  updateWorkspaceInboxSettings,
} from './adminController.js';

export function registerAdminRoutes(app) {
  app.get('/api/admin/dashboard', requireAdmin, getDashboard);
  app.get('/api/admin/consumption', requireConsumptionAccess, listConsumption);
  app.get('/api/admin/consumption/export', requireConsumptionAccess, exportConsumption);
  app.post('/api/admin/consumption', requireConsumptionAccess, createConsumption);
  app.patch('/api/admin/consumption/:id', requireConsumptionAccess, updateConsumption);
  app.delete('/api/admin/consumption/:id', requireConsumptionAccess, deleteConsumption);
  app.get('/api/admin/users', requireAdmin, listUsers);
  app.post('/api/admin/users', requireAdmin, createUser);
  app.patch('/api/admin/users/:id', requireAdmin, updateUser);
  app.delete('/api/admin/users/:id', requireAdmin, deleteUser);
  app.get('/api/admin/workspace-options', requireAdmin, listWorkspaceOptions);
  app.get('/api/admin/workspaces', requireAdmin, listWorkspaces);
  app.get('/api/admin/workspaces/:id/inbox-settings', requireSuperadmin, getWorkspaceInboxSettings);
  app.post('/api/admin/workspaces', requireSuperadmin, createWorkspace);
  app.patch('/api/admin/workspaces/:id/inbox-settings', requireSuperadmin, updateWorkspaceInboxSettings);
  app.patch('/api/admin/workspaces/:id', requireSuperadmin, updateWorkspace);
  app.delete('/api/admin/workspaces/:id', requireSuperadmin, deleteWorkspace);
}
