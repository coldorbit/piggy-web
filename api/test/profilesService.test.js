import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Op } from 'sequelize';
import {
  appliedFilterProfileWhere,
  canShareProfileWithUser,
  currentDbUser,
  formatProfile,
  forwardingAliasForProfileName,
  isProfileInUserWorkspace,
  profileAttributesFromBody,
  profileStatusAttributesFromBody,
  sortProfilesForDisplay,
  workspaceProfileWhereForUser,
} from '../server/modules/bidding/application/profilesService.js';
import { ROLES } from '../server/utils/roles.js';

describe('appliedFilterProfileWhere', () => {
  it('limits applied filter profiles to active profiles in the selected category', () => {
    assert.deepEqual(appliedFilterProfileWhere({ profileBadge: 'ml' }), {
      profileStatus: 'active',
      profileBadge: 'ML',
    });
  });

  it('keeps the broad active profile query when no active profile category is available', () => {
    assert.deepEqual(appliedFilterProfileWhere(), { profileStatus: 'active' });
  });

  it('limits applied filter profiles to the user workspace when provided', () => {
    assert.deepEqual(appliedFilterProfileWhere({ profileBadge: 'swe', workspaceId: 42 }), {
      profileStatus: 'active',
      workspaceId: 42,
      profileBadge: 'SWE',
    });
  });

  it('keeps unassigned users scoped to unassigned profiles', () => {
    assert.deepEqual(appliedFilterProfileWhere({ workspaceId: null }), {
      profileStatus: 'active',
      workspaceId: null,
    });
  });
});

describe('profile workspace helpers', () => {
  it('reuses the user row already loaded by authentication', async () => {
    const authUserRow = { id: 17, username: 'authenticated-user' };

    assert.equal(await currentDbUser({ authUserRow }), authUserRow);
  });

  it('matches profiles only inside the same workspace for non-superadmins', () => {
    assert.equal(isProfileInUserWorkspace({ workspaceId: 7 }, { role: ROLES.user, workspaceId: 7 }), true);
    assert.equal(isProfileInUserWorkspace({ workspaceId: 8 }, { role: ROLES.user, workspaceId: 7 }), false);
    assert.equal(isProfileInUserWorkspace({ workspaceId: null }, { role: ROLES.user, workspaceId: 7 }), false);
  });

  it('treats unassigned users as scoped to unassigned profiles only', () => {
    assert.equal(isProfileInUserWorkspace({ workspaceId: null }, { role: ROLES.user, workspaceId: null }), true);
    assert.equal(isProfileInUserWorkspace({ workspaceId: 7 }, { role: ROLES.user, workspaceId: null }), false);
  });

  it('allows superadmins to cross workspace boundaries', () => {
    assert.equal(isProfileInUserWorkspace({ workspaceId: 8 }, { role: ROLES.superadmin, workspaceId: 7 }), true);
    assert.equal(workspaceProfileWhereForUser({ role: ROLES.superadmin, workspaceId: 7 }), undefined);
  });

  it('allows only superadmins to share profiles across workspace boundaries', () => {
    const recipient = { role: ROLES.editableBidder, workspaceId: 8 };
    assert.equal(canShareProfileWithUser({ role: ROLES.superadmin }, recipient, 7), true);
    assert.equal(canShareProfileWithUser({ role: ROLES.admin, workspaceId: 7 }, recipient, 7), false);
    assert.equal(canShareProfileWithUser({ role: ROLES.admin, workspaceId: 7 }, recipient, 8), true);
  });

  it('builds exact workspace filters for non-superadmins', () => {
    assert.deepEqual(workspaceProfileWhereForUser({ role: ROLES.admin, workspaceId: 7 }), { workspaceId: 7 });
    assert.deepEqual(workspaceProfileWhereForUser({ role: ROLES.user, workspaceId: null }), { workspaceId: null });
  });

  it('allows active extra workspace memberships to extend bidder profile access', () => {
    const user = {
      role: ROLES.editableBidder,
      workspaceId: 7,
      workspaceMemberships: [{ workspaceId: 8, status: 'active' }],
    };

    assert.equal(isProfileInUserWorkspace({ workspaceId: 8 }, user), true);
    assert.equal(isProfileInUserWorkspace({ workspaceId: 9 }, user), false);
    assert.deepEqual(workspaceProfileWhereForUser(user), { workspaceId: { [Op.in]: [7, 8] } });
  });

  it('ignores inactive extra workspace memberships', () => {
    const user = {
      role: ROLES.readonlyBidder,
      workspaceId: 7,
      workspaceMemberships: [{ workspaceId: 8, status: 'revoked' }],
    };

    assert.equal(isProfileInUserWorkspace({ workspaceId: 8 }, user), false);
    assert.deepEqual(workspaceProfileWhereForUser(user), { workspaceId: 7 });
  });
});

describe('profile status helpers', () => {
  it('reports a static resume from metadata without loading the file blob', () => {
    const profile = formatProfile({
      id: 1,
      staticResumeFilename: 'resume.pdf',
      get: () => null,
    });

    assert.equal(profile.hasStaticResume, true);
  });

  it('accepts a profile daily bid goal', () => {
    assert.equal(profileAttributesFromBody({ name: 'SWE', dailyBidGoal: '25' }, { canSetDailyBidGoal: true }).dailyBidGoal, 25);
  });

  it('defaults an empty profile daily bid goal to 60', () => {
    assert.equal(profileAttributesFromBody({ name: 'SWE', dailyBidGoal: '' }, { canSetDailyBidGoal: true }).dailyBidGoal, 60);
  });

  it('defaults new profile daily bid goals to 60', () => {
    assert.equal(profileAttributesFromBody({ name: 'SWE' }).dailyBidGoal, 60);
  });

  it('accepts expanded profile color options', () => {
    assert.equal(profileAttributesFromBody({ name: 'SWE', colorScheme: 'teal' }).colorScheme, 'teal');
  });

  it('defaults forwarding aliases to service plus first name', () => {
    assert.equal(
      profileAttributesFromBody({ name: 'Tiep Nguyen' }).forwardingEmail,
      'service+tiep@co-bounce.com',
    );
  });

  it('preserves explicit forwarding aliases', () => {
    assert.equal(
      profileAttributesFromBody({ name: 'Tiep Nguyen', forwardingEmail: 'service+tiep-nguyen@co-bounce.com' }).forwardingEmail,
      'service+tiep-nguyen@co-bounce.com',
    );
  });

  it('builds forwarding aliases from email-safe first names', () => {
    assert.equal(forwardingAliasForProfileName('Élodie Smith'), 'service+elodie@co-bounce.com');
    assert.equal(forwardingAliasForProfileName('Jean-Luc Picard'), 'service+jeanluc@co-bounce.com');
  });

  it('preserves profile daily bid goals for non-admin updates', () => {
    assert.equal(
      profileAttributesFromBody({ name: 'SWE', dailyBidGoal: '100' }, { currentDailyBidGoal: 42 }).dailyBidGoal,
      42,
    );
  });

  it('accepts static profile resume uploads', () => {
    const attrs = profileAttributesFromBody({
      name: 'Static SWE',
      isStatic: true,
      staticResumeUpload: {
        filename: 'resume.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dataBase64: Buffer.from('resume file').toString('base64'),
      },
    });

    assert.equal(attrs.isStatic, true);
    assert.equal(attrs.staticResumeFilename, 'resume.docx');
    assert.equal(attrs.staticResumeData.toString(), 'resume file');
    assert.equal(attrs.staticResumeContentType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.ok(attrs.staticResumeUploadedAt instanceof Date);
  });

  it('rejects static resume uploads unless the profile is marked static', () => {
    assert.throws(
      () => profileAttributesFromBody({
        name: 'Dynamic SWE',
        staticResumeUpload: {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
          dataBase64: Buffer.from('resume file').toString('base64'),
        },
      }),
      /Mark the profile as static/,
    );
  });

  it('rejects invalid profile daily bid goals', () => {
    assert.throws(
      () => profileAttributesFromBody({ name: 'SWE', dailyBidGoal: '2.5' }, { canSetDailyBidGoal: true }),
      /Daily bid goal/,
    );
  });

  it('accepts legacy profile status without a close reason', () => {
    assert.deepEqual(profileStatusAttributesFromBody({ status: 'legacy' }), {
      profileStatus: 'legacy',
      closedReason: null,
      closedAt: null,
    });
  });

  it('accepts draft profile status without a close reason', () => {
    assert.deepEqual(profileStatusAttributesFromBody({ status: 'draft' }), {
      profileStatus: 'draft',
      closedReason: null,
      closedAt: null,
    });
  });

  it('sorts draft and legacy profiles after active profiles', () => {
    const profiles = [
      profileRow({ id: 1, name: 'Legacy', profileStatus: 'legacy', createdAt: '2024-01-01T00:00:00.000Z' }),
      profileRow({ id: 2, name: 'Active', profileStatus: 'active', createdAt: '2024-02-01T00:00:00.000Z' }),
      profileRow({ id: 3, name: 'Closed', profileStatus: 'closed', createdAt: '2024-03-01T00:00:00.000Z' }),
      profileRow({ id: 4, name: 'Draft', profileStatus: 'draft', createdAt: '2024-01-15T00:00:00.000Z' }),
    ];

    assert.deepEqual(sortProfilesForDisplay(profiles).map((profile) => profile.name), ['Active', 'Closed', 'Draft', 'Legacy']);
  });
});

function profileRow(values) {
  return values;
}
