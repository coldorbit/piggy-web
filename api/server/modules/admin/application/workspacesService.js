import { clean } from '../../../utils/index.js';
import { InputError } from '../../../utils/errors.js';

export function workspaceAttributesFromBody(body = {}) {
  const name = clean(body.name);
  const slug = workspaceSlug(body.slug || name);

  if (!name) throw new InputError('Workspace name is required');
  if (!slug) throw new InputError('Workspace slug is required');

  return { name, slug };
}

export function workspaceSlug(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatWorkspace(row, { membershipCount = null, profileCount = null, userCount = null } = {}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    userCount,
    membershipCount,
    profileCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
