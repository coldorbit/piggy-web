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

export function workspaceInboxProfileIdsFromBody(body = {}) {
  const rawProfileIds = Object.prototype.hasOwnProperty.call(body, 'profileIds')
    ? body.profileIds
    : body.inboxProfileIds;
  if (rawProfileIds === null) return null;
  if (!Array.isArray(rawProfileIds)) throw new InputError('Inbox emails must be an array');

  const profileIds = rawProfileIds.map((profileId) => clean(profileId));
  if (profileIds.some((profileId) => !/^\d+$/.test(profileId))) {
    throw new InputError('Inbox email selection contains an invalid profile');
  }
  return [...new Set(profileIds)];
}

export function formatWorkspaceInboxSettings(workspace, profiles) {
  const availableProfileIds = profiles.map((profile) => String(profile.id));
  const configuredProfileIds = workspace.inboxProfileIds;
  const usesDefaultSelection = configuredProfileIds === null || configuredProfileIds === undefined;
  const selectedProfileIds = usesDefaultSelection
    ? availableProfileIds
    : (Array.isArray(configuredProfileIds) ? configuredProfileIds : [])
        .map(String)
        .filter((profileId) => availableProfileIds.includes(profileId));

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name || '',
      email: profile.email || null,
      forwardingEmail: profile.forwardingEmail || null,
      profileStatus: profile.profileStatus || 'active',
    })),
    selectedProfileIds,
    usesDefaultSelection,
  };
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
