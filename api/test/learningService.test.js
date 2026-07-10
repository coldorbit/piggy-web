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

  it('accepts read-only Excalidraw scene JSON and Mermaid source', () => {
    const attrs = learningArticleAttributesFromBody({
      category: 'machine_learning',
      title: 'Feature platform architecture',
      summary: 'A visual guide to the feature platform.',
      content: '## Architecture\n\nReview the diagrams.',
      excalidrawData: JSON.stringify({
        type: 'excalidraw',
        version: 2,
        elements: [{ id: 'service-a', type: 'rectangle' }],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      }),
      mermaidScript: 'flowchart LR\n  Client --> API',
      status: 'draft',
    });

    assert.equal(attrs.excalidrawData.type, 'excalidraw');
    assert.equal(attrs.excalidrawData.elements[0].id, 'service-a');
    assert.equal(attrs.mermaidScript, 'flowchart LR\n  Client --> API');
  });

  it('rejects malformed or oversized diagram sources and supports clearing them', () => {
    const base = {
      category: 'companies', title: 'Architecture', summary: 'Company architecture.', content: 'Article content.', status: 'draft',
    };
    assert.throws(() => learningArticleAttributesFromBody({ ...base, excalidrawData: '{bad json' }), /valid scene JSON/);
    assert.throws(() => learningArticleAttributesFromBody({ ...base, excalidrawData: { type: 'excalidraw' } }), /elements array/);
    assert.throws(() => learningArticleAttributesFromBody({ ...base, mermaidScript: 'x'.repeat(50_001) }), /50,000/);

    const attrs = learningArticleAttributesFromBody(
      { ...base, excalidrawData: null, mermaidScript: '' },
      { excalidrawData: { elements: [{ id: 'old' }] }, mermaidScript: 'flowchart LR\nA --> B' },
    );
    assert.equal(attrs.excalidrawData, null);
    assert.equal(attrs.mermaidScript, null);
  });

  it('validates required content, categories, and source protocols', () => {
    assert.throws(() => learningArticleAttributesFromBody({}), /Choose companies/);
    assert.throws(
      () => learningArticleAttributesFromBody({ category: 'geography', title: 'Seattle', summary: 'City guide', content: 'Content', sourceLinks: ['javascript:alert(1)'] }),
      /HTTP or HTTPS/,
    );
  });
});
