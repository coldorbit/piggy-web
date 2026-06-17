import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assessmentAttributesFromBody,
  assessmentCategoryFromBody,
  ensureAssessmentAccess,
} from '../server/modules/assessments/application/assessmentsService.js';
import { ForbiddenError } from '../server/utils/errors.js';
import { ROLES } from '../server/utils/roles.js';

describe('assessmentAttributesFromBody', () => {
  it('accepts required assessment fields with optional job and expiry time', () => {
    const attrs = assessmentAttributesFromBody({
      profileId: '42',
      category: 'Take Home',
      assessmentLink: 'https://example.com/assessment',
      jobId: 'J0000001',
      expiresAt: '2026-06-18T12:30:00.000Z',
    });

    assert.equal(attrs.profileId, '42');
    assert.equal(attrs.category, 'take_home');
    assert.equal(attrs.assessmentLink, 'https://example.com/assessment');
    assert.equal(attrs.jobId, 'J0000001');
    assert.equal(attrs.expiresAt.toISOString(), '2026-06-18T12:30:00.000Z');
  });

  it('rejects invalid assessment links', () => {
    assert.throws(
      () => assessmentAttributesFromBody({ profileId: 1, category: 'coding', assessmentLink: 'not-a-url' }),
      /valid http or https assessment link/,
    );
  });

  it('rejects invalid expiry times', () => {
    assert.throws(
      () => assessmentAttributesFromBody({ profileId: 1, category: 'coding', assessmentLink: 'https://example.com', expiresAt: 'soon' }),
      /valid date and time/,
    );
  });
});

describe('assessmentCategoryFromBody', () => {
  it('normalizes supported categories', () => {
    assert.equal(assessmentCategoryFromBody('Take Home'), 'take_home');
    assert.equal(assessmentCategoryFromBody('technical'), 'technical');
  });

  it('rejects unknown categories', () => {
    assert.throws(() => assessmentCategoryFromBody('mystery'), /valid assessment category/);
  });
});

describe('ensureAssessmentAccess', () => {
  it('allows users, finance managers, admins, and superadmins', () => {
    for (const role of [ROLES.user, ROLES.financeManager, ROLES.admin, ROLES.superadmin]) {
      assert.doesNotThrow(() => ensureAssessmentAccess({ role }));
    }
  });

  it('rejects roles outside assessment access', () => {
    assert.throws(() => ensureAssessmentAccess({ role: ROLES.caller }), ForbiddenError);
  });
});
