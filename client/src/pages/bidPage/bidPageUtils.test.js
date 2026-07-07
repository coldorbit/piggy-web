import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appliedProfileOptionsForActiveProfile,
  isAppliedProfileFilterValid,
  isJobVisibleForTab,
} from './bidPageUtils.js';
import { BID_TABS } from '../../components/bids/bidConstants.js';

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

describe('isJobVisibleForTab', () => {
  it('routes static ready bids to tailored instead of todo', () => {
    const job = { bid: { status: 'ready' } };
    const draft = { status: 'ready' };

    assert.equal(isJobVisibleForTab(job, BID_TABS.todo, draft, { isStaticProfile: true }), false);
    assert.equal(isJobVisibleForTab(job, BID_TABS.tailored, draft, { isStaticProfile: true }), true);
  });

  it('routes submitted static bids to done', () => {
    const job = { bid: { status: 'submitted' } };
    const draft = { status: 'submitted' };

    assert.equal(isJobVisibleForTab(job, BID_TABS.tailored, draft, { isStaticProfile: true }), false);
    assert.equal(isJobVisibleForTab(job, BID_TABS.done, draft, { isStaticProfile: true }), true);
  });
});

function profile(values) {
  return { profileStatus: 'active', profileBadge: 'SWE', ...values };
}
