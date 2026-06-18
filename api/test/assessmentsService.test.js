import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assessmentAttributesFromBody,
  assessmentCategoryFromBody,
  canCompleteAssessment,
  ensureAssessmentAccess,
  formatAssessment,
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

describe('canCompleteAssessment', () => {
  it('allows admins, superadmins, assessment creators, and profile owners', () => {
    const assessment = { userId: '10' };
    const profile = { userId: '20' };

    assert.equal(canCompleteAssessment({ role: ROLES.admin, id: '1' }, assessment, profile), true);
    assert.equal(canCompleteAssessment({ role: ROLES.superadmin, id: '2' }, assessment, profile), true);
    assert.equal(canCompleteAssessment({ role: ROLES.user, id: '10' }, assessment, profile), true);
    assert.equal(canCompleteAssessment({ role: ROLES.user, id: '20' }, assessment, profile), true);
  });

  it('rejects non-owner assessment users', () => {
    assert.equal(canCompleteAssessment(
      { role: ROLES.financeManager, id: '30' },
      { userId: '10' },
      { userId: '20' },
    ), false);
  });
});

describe('formatAssessment', () => {
  it('marks completed assessments done before expiry state', () => {
    const row = {
      id: '1',
      profileId: '2',
      userId: '3',
      jobId: null,
      category: 'coding',
      assessmentLink: 'https://example.com/assessment',
      expiresAt: new Date('2020-01-01T00:00:00Z'),
      completedAt: new Date('2026-06-18T12:00:00Z'),
      createdAt: new Date('2026-06-18T10:00:00Z'),
      updatedAt: new Date('2026-06-18T12:00:00Z'),
    };

    const assessment = formatAssessment(row);
    assert.equal(assessment.status, 'done');
    assert.equal(assessment.completedAt, '2026-06-18T12:00:00.000Z');
  });
});
