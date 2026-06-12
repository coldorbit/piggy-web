import { requireAdmin, requireConsumptionAccess } from '../../../middleware/authMiddleware.js';
import {
  createConsumption,
  createUser,
  deleteConsumption,
  deleteUser,
  getDashboard,
  listConsumption,
  listUsers,
  updateConsumption,
  updateUser,
} from './adminController.js';

export function registerAdminRoutes(app) {
  app.get('/api/admin/dashboard', requireAdmin, getDashboard);
  app.get('/api/admin/consumption', requireConsumptionAccess, listConsumption);
  app.post('/api/admin/consumption', requireConsumptionAccess, createConsumption);
  app.patch('/api/admin/consumption/:id', requireConsumptionAccess, updateConsumption);
  app.delete('/api/admin/consumption/:id', requireConsumptionAccess, deleteConsumption);
  app.get('/api/admin/users', requireAdmin, listUsers);
  app.post('/api/admin/users', requireAdmin, createUser);
  app.patch('/api/admin/users/:id', requireAdmin, updateUser);
  app.delete('/api/admin/users/:id', requireAdmin, deleteUser);
}
