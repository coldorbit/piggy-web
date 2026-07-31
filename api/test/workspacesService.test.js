import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatWorkspace,
  formatWorkspaceInboxSettings,
  workspaceAttributesFromBody,
  workspaceInboxProfileIdsFromBody,
  workspaceSlug,
} from '../server/modules/admin/application/workspacesService.js';

describe('workspace helpers', () => {
  it('builds a stable slug from workspace names', () => {
    assert.equal(workspaceSlug('Acme Careers, Inc.'), 'acme-careers-inc');
    assert.equal(workspaceSlug('  North America Ops  '), 'north-america-ops');
  });

  it('defaults blank slugs from the workspace name', () => {
    const attrs = workspaceAttributesFromBody({ name: 'Acme Careers', slug: '' });

    assert.deepEqual(attrs, { name: 'Acme Careers', slug: 'acme-careers' });
  });

  it('rejects workspace records without names', () => {
    assert.throws(
      () => workspaceAttributesFromBody({ name: '', slug: 'acme' }),
      /Workspace name is required/,
    );
  });

  it('formats workspace rows with usage counts', () => {
    const workspace = formatWorkspace(
      { id: 1, name: 'Acme', slug: 'acme', createdAt: 'created', updatedAt: 'updated' },
      { membershipCount: 2, profileCount: 4, userCount: 3 },
    );

    assert.equal(workspace.userCount, 3);
    assert.equal(workspace.membershipCount, 2);
    assert.equal(workspace.profileCount, 4);
    assert.equal(workspace.slug, 'acme');
  });

  it('normalizes and validates saved workspace inbox selections', () => {
    assert.deepEqual(workspaceInboxProfileIdsFromBody({ profileIds: [2, '1', '2'] }), ['2', '1']);
    assert.equal(workspaceInboxProfileIdsFromBody({ profileIds: null }), null);
    assert.throws(
      () => workspaceInboxProfileIdsFromBody({ profileIds: ['not-an-id'] }),
      /invalid profile/,
    );
  });

  it('defaults unsaved workspace inbox settings to every available email', () => {
    const settings = formatWorkspaceInboxSettings(
      { id: 4, name: 'Acme', slug: 'acme', inboxProfileIds: null },
      [
        { id: 10, name: 'One', email: 'one@example.com', profileStatus: 'active' },
        { id: 11, name: 'Two', forwardingEmail: 'two@example.com', profileStatus: 'active' },
      ],
    );

    assert.deepEqual(settings.selectedProfileIds, ['10', '11']);
    assert.equal(settings.usesDefaultSelection, true);
  });
});
