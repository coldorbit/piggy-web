import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { learningCompanyAttributesFromBody, learningCompanySlug } from '../server/modules/learning/application/learningCompanyService.js';

describe('learning company validation', () => {
  it('accepts complete company directory information', () => {
    const attrs = learningCompanyAttributesFromBody({
      name: 'Uber',
      description: 'A mobility, delivery, and freight technology platform.',
      website: 'https://www.uber.com/',
      logoUrl: 'https://example.com/uber.png',
      industry: 'Technology platform',
      headquarters: 'San Francisco, CA',
    });
    assert.equal(attrs.slug, 'uber');
    assert.equal(attrs.name, 'Uber');
    assert.equal(attrs.website, 'https://www.uber.com/');
    assert.equal(attrs.headquarters, 'San Francisco, CA');
  });

  it('requires core directory fields and safe web URLs', () => {
    const valid = { name: 'Example', description: 'Company description', website: 'https://example.com', logoUrl: 'https://example.com/logo.png' };
    assert.throws(() => learningCompanyAttributesFromBody({ ...valid, description: '' }), /description is required/);
    assert.throws(() => learningCompanyAttributesFromBody({ ...valid, website: 'javascript:alert(1)' }), /valid HTTP or HTTPS/);
    assert.throws(() => learningCompanyAttributesFromBody({ ...valid, logoUrl: 'data:image/png;base64,abc' }), /valid HTTP or HTTPS/);
  });

  it('builds stable URL-safe slugs', () => {
    assert.equal(learningCompanySlug('  Example & Company  '), 'example-company');
  });
});
