import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Op } from 'sequelize';
import { getInterviewCallModel } from '../db.js';
import { STAFF_WORKSPACE_ROLES } from '../server/utils/roles.js';
import { interviewCallsByInterviewId } from '../server/modules/bidding/presentation/biddingInterviewDomainController.js';

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
