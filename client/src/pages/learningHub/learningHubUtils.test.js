import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { articleMatchesSearch, buildCompanyDirectories, directoryMatchesSearch } from './learningHubUtils.js';

describe('Learning Hub company directories', () => {
  it('groups articles by their company directory ID and keeps other libraries separate', () => {
    const directories = buildCompanyDirectories(
      [{ id: '7', slug: 'uber', name: 'Uber', description: 'Mobility platform', website: 'https://uber.com', logoUrl: 'https://uber.com/logo.png', updatedAt: '2026-07-12T00:00:00.000Z' }],
      [article({ id: '1', companyId: '7', title: 'Business model', featured: true, tags: ['marketplace'] }), article({ id: '2', companyId: '7', title: 'ML architecture', status: 'draft', tags: ['ranking'] }), article({ id: '3', category: 'geography', companyId: null, title: 'Seattle' })],
    );

    assert.equal(directories.length, 1);
    assert.equal(directories[0].name, 'Uber');
    assert.deepEqual(directories[0].articles.map((item) => item.id), ['1', '2']);
    assert.deepEqual(directories[0].tags, ['marketplace', 'ranking']);
    assert.equal(directories[0].draftCount, 1);
    assert.equal(directories[0].companyWebsite, 'https://uber.com');
    assert.equal(directories[0].companyLogoUrl, 'https://uber.com/logo.png');
    assert.equal(directoryMatchesSearch(directories[0], 'mobility'), true);
  });

  it('matches directory articles through company details and tags', () => {
    const companyArticle = article({ companyName: 'Example Co', companyWebsite: 'https://example.com', tags: ['recommendations'] });
    assert.equal(articleMatchesSearch(companyArticle, 'example'), true);
    assert.equal(articleMatchesSearch(companyArticle, 'recommendations'), true);
    assert.equal(articleMatchesSearch(companyArticle, 'example.com'), true);
    assert.equal(articleMatchesSearch(companyArticle, 'unrelated'), false);
  });
});

function article(overrides = {}) {
  return {
    id: '1', category: 'companies', companyId: '7', companyName: 'Example', title: 'Overview', summary: 'Summary', content: 'Content',
    tags: [], featured: false, status: 'published', publishedAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z', ...overrides,
  };
}
