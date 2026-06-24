import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appliedProfileOptionsForActiveProfile,
  isAppliedProfileFilterValid,
} from './bidPageUtils.js';

describe('appliedProfileOptionsForActiveProfile', () => {
  it('returns active same-category profiles except the current profile', () => {
    const activeProfile = profile({ id: 1, name: 'Data Engineer A', profileBadge: 'DE' });
    const profiles = [
      activeProfile,
      profile({ id: 2, name: 'Data Engineer B', profileBadge: 'DE' }),
      profile({ id: 3, name: 'Software Engineer', profileBadge: 'SWE' }),
      profile({ id: 4, name: 'Closed Data Engineer', profileBadge: 'DE', profileStatus: 'closed' }),
    ];

    assert.deepEqual(
      appliedProfileOptionsForActiveProfile({
        activeProfile,
        activeProfiles: profiles,
      }).map((row) => row.id),
      [2],
    );
  });

  it('uses cross-user applied profiles when available', () => {
    const activeProfile = profile({ id: 1, profileBadge: 'DE' });
    const activeProfiles = [activeProfile, profile({ id: 2, profileBadge: 'DE' })];
    const appliedFilterProfiles = [
      profile({ id: 10, profileBadge: 'DE' }),
      profile({ id: 11, profileBadge: 'ML' }),
    ];

    assert.deepEqual(
      appliedProfileOptionsForActiveProfile({
        activeProfile,
        activeProfiles,
        appliedFilterProfiles,
        canUseCrossUserAppliedFilter: true,
      }).map((row) => row.id),
      [10],
    );
  });
});

describe('isAppliedProfileFilterValid', () => {
  it('accepts empty and all selections', () => {
    assert.equal(isAppliedProfileFilterValid('', []), true);
    assert.equal(isAppliedProfileFilterValid('all', []), true);
  });

  it('rejects selections outside the applied profile options', () => {
    assert.equal(isAppliedProfileFilterValid(2, [profile({ id: 2 })]), true);
    assert.equal(isAppliedProfileFilterValid(3, [profile({ id: 2 })]), false);
  });
});

function profile(values) {
  return { profileStatus: 'active', profileBadge: 'SWE', ...values };
}
