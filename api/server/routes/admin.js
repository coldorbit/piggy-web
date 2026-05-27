import { requireAdmin } from '../../auth.js';
import { createUser, deleteUser, listUsers, updateUser } from '../controllers/admin.js';

export function registerAdminRoutes(app) {
  app.get('/api/admin/users', requireAdmin, listUsers);
  app.post('/api/admin/users', requireAdmin, createUser);
  app.patch('/api/admin/users/:id', requireAdmin, updateUser);
  app.delete('/api/admin/users/:id', requireAdmin, deleteUser);
}
