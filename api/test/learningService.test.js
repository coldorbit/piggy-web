import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { learningArticleAttributesFromBody } from '../server/modules/learning/application/learningService.js';

describe('learning article validation', () => {
  it('accepts structured company content with sources and tags', () => {
    const attrs = learningArticleAttributesFromBody({
      category: 'companies',
      title: 'Example company interview brief',
      summary: 'How the company operates and what its ML organization values.',
      content: '## Company overview\n\nEvidence-backed notes.',
      companyName: 'Example Co',
      tags: 'marketplace, ranking, staff+',
      sourceLinks: ['https://example.com/engineering'],
      featured: true,
      status: 'published',
    });

    assert.equal(attrs.companyName, 'Example Co');
    assert.deepEqual(attrs.tags, ['marketplace', 'ranking', 'staff+']);
    assert.equal(attrs.sourceLinks[0].url, 'https://example.com/engineering');
    assert.equal(attrs.featured, true);
  });

  it('keeps only category-relevant structured fields', () => {
    const attrs = learningArticleAttributesFromBody({
      category: 'machine_learning',
      title: 'Ranking systems',
      summary: 'An advanced guide to production ranking systems.',
      content: '## Objectives\n\nLearning-to-rank design.',
      companyName: 'Should be removed',
      city: 'Seattle',
      difficulty: 'staff_plus',
      status: 'draft',
    });

    assert.equal(attrs.companyName, null);
    assert.equal(attrs.city, null);
    assert.equal(attrs.difficulty, 'staff_plus');
  });

  it('validates required content, categories, and source protocols', () => {
    assert.throws(() => learningArticleAttributesFromBody({}), /Choose companies/);
    assert.throws(
      () => learningArticleAttributesFromBody({ category: 'geography', title: 'Seattle', summary: 'City guide', content: 'Content', sourceLinks: ['javascript:alert(1)'] }),
      /HTTP or HTTPS/,
    );
  });
});
