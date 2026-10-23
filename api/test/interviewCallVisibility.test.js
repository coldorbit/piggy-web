import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Op } from 'sequelize';
import { getBidProfileModel, getInterviewCallModel, getInterviewLogModel, getInterviewModel, getProfileShareRequestModel } from '../db.js';
import { STAFF_WORKSPACE_ROLES } from '../server/utils/roles.js';
import { interviewCallsByInterviewId } from '../server/modules/bidding/presentation/biddingInterviewDomainController.js';
import { accessibleInterviewProfile, accessibleProfile, profilesVisibleForInterviews } from '../server/modules/bidding/application/profilesService.js';
import { calendarInterviewsForUser } from '../server/modules/bidding/presentation/biddingCalendarController.js';

it('returns calls assigned to other users and unassigned calls for every internal staff role', async (t) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
  t.after(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  const calls = [
    { id: 1, interviewId: 10, callerUserId: 200 },
    { id: 2, interviewId: 10, callerUserId: null },
  ];
  const queries = [];
  t.mock.method(getInterviewCallModel(), 'findAll', async ({ where }) => {
    queries.push(where);
    return calls;
  });

  for (const role of STAFF_WORKSPACE_ROLES) {
    const result = await interviewCallsByInterviewId([{ id: 10, callerUserId: 200 }], { id: 100, role });
    assert.deepEqual(result.get('10'), calls, role);
    assert.deepEqual(queries.at(-1), { interviewId: [10] }, role);
  }

  await interviewCallsByInterviewId([{ id: 10, callerUserId: 200 }], { id: 100, role: 'caller' });
  assert.deepEqual(queries.at(-1)[Op.or], [{ callerUserId: 100 }]);
});

it('lets internal staff discover and read interviews and calendar calls across owners and workspaces', async (t) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
  t.after(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  const profile = { id: 10, userId: 200, workspaceId: 2 };
  const interview = {
    id: 20, profileId: 10, userId: 200, callerUserId: 300, profile,
    setDataValue(key, value) { this[key] = value; },
  };
  const call = { id: 30, interviewId: 20, callerUserId: 300 };
  const profileList = t.mock.method(getBidProfileModel(), 'findAll', async () => [profile]);
  t.mock.method(getBidProfileModel(), 'findByPk', async () => profile);
  t.mock.method(getProfileShareRequestModel(), 'findOne', async () => null);
  const interviewList = t.mock.method(getInterviewModel(), 'findAll', async () => [interview]);
  t.mock.method(getInterviewLogModel(), 'findAll', async () => []);
  t.mock.method(getInterviewCallModel(), 'findAll', async () => [call]);

  for (const role of STAFF_WORKSPACE_ROLES) {
    const user = { id: 100, role, workspaceId: 1 };
    assert.deepEqual(await profilesVisibleForInterviews(user), [profile]);
    assert.equal(profileList.mock.calls.at(-1).arguments[0].where, undefined, role);
    assert.equal(await accessibleInterviewProfile({ authUserRow: user }, '10'), profile, role);
    const result = await calendarInterviewsForUser(user);
    assert.deepEqual(interviewList.mock.calls.at(-1).arguments[0].include[0].where, {}, role);
    assert.deepEqual(result[0].calls, [call], role);
  }

  // Broad interview reads must not grant access to the ordinary profile workspace.
  await assert.rejects(
    accessibleProfile({ authUserRow: { id: 100, role: 'internal', workspaceId: 1 } }, '10'),
    /Profile not found/,
  );
  await assert.rejects(
    accessibleInterviewProfile({ authUserRow: { id: 100, role: 'bidder', workspaceId: 1 } }, '10'),
    /Profile not found/,
  );

  await calendarInterviewsForUser({ id: 100, role: 'internal', workspaceId: 1 }, { workspaceId: 2 });
  assert.deepEqual(interviewList.mock.calls.at(-1).arguments[0].include[0].where, { workspaceId: 2 });
  await calendarInterviewsForUser({ id: 100, role: 'caller', workspaceId: 1 });
  assert.deepEqual(interviewList.mock.calls.at(-1).arguments[0].include[0].where, { workspaceId: 1 });
});
