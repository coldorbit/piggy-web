import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SESSION_COOKIE_NAME, createSessionToken, publicUser, readSession, sessionCookieOptions } from '../auth.js';

describe('session auth', () => {
  it('reads valid sessions from the HttpOnly cookie', () => {
    const token = createSessionToken(sessionUser());
    const session = readSession({
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
      query: {},
    });

    assert.equal(session.username, 'admin');
    assert.equal(session.role, 'admin');
    assert.equal(session.activeSessionId, 'session-1');
  });

  it('keeps bearer token support for API clients', () => {
    const token = createSessionToken(sessionUser());
    const session = readSession({
      headers: { authorization: `Bearer ${token}` },
      query: {},
    });

    assert.equal(session.username, 'admin');
    assert.equal(session.activeSessionId, 'session-1');
  });

  it('does not authenticate query-string tokens', () => {
    const token = createSessionToken(sessionUser());
    const session = readSession({
      headers: {},
      query: { token },
    });

    assert.equal(session, null);
  });

  it('marks browser session cookies HttpOnly and same-site strict', () => {
    assert.deepEqual(
      sessionCookieOptions(),
      {
        httpOnly: true,
        maxAge: 604800000,
        path: '/',
        sameSite: 'strict',
        secure: false,
      },
    );
  });

  it('includes workspace identity in public users', () => {
    const user = publicUser({
      id: 7,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      workspaceId: 3,
      workspace: { id: 3, name: 'ApplyPilot', slug: 'default' },
      workspaceMemberships: [
        {
          id: 11,
          userId: 7,
          workspaceId: 4,
          accessRole: 'editable_bidder',
          status: 'active',
          workspace: { id: 4, name: 'Client B', slug: 'client-b' },
        },
      ],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    assert.equal(user.workspaceId, 3);
    assert.deepEqual(user.workspace, { id: 3, name: 'ApplyPilot', slug: 'default' });
    assert.deepEqual(user.workspaceMemberships, [
      {
        id: 11,
        userId: 7,
        workspaceId: 4,
        accessRole: 'editable_bidder',
        status: 'active',
        workspace: { id: 4, name: 'Client B', slug: 'client-b' },
      },
    ]);
  });
});

function sessionUser() {
  return {
    username: 'admin',
    role: 'admin',
    activeSessionId: 'session-1',
  };
}
