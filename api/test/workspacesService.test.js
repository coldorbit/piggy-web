import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatWorkspace, workspaceAttributesFromBody, workspaceSlug } from '../server/modules/admin/application/workspacesService.js';

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
      { membershipCount: 2, userCount: 3 },
    );

    assert.equal(workspace.userCount, 3);
    assert.equal(workspace.membershipCount, 2);
    assert.equal(workspace.slug, 'acme');
  });
});
