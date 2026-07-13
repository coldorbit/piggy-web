import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { articleMatchesSearch, buildCompanyDirectories } from './learningHubUtils.js';

describe('Learning Hub company directories', () => {
  it('groups company articles case-insensitively and keeps other libraries separate', () => {
    const directories = buildCompanyDirectories([
      article({ id: '1', companyName: 'Uber', title: 'Business model', featured: true, tags: ['marketplace'] }),
      article({ id: '2', companyName: ' uber ', title: 'ML architecture', status: 'draft', tags: ['ranking'] }),
      article({ id: '3', category: 'geography', companyName: '', title: 'Seattle' }),
    ]);

    assert.equal(directories.length, 1);
    assert.equal(directories[0].name, 'Uber');
    assert.deepEqual(directories[0].articles.map((item) => item.id), ['1', '2']);
    assert.deepEqual(directories[0].tags, ['marketplace', 'ranking']);
    assert.equal(directories[0].draftCount, 1);
  });

  it('matches directory articles through company details and tags', () => {
    const companyArticle = article({ companyName: 'Example Co', tags: ['recommendations'] });
    assert.equal(articleMatchesSearch(companyArticle, 'example'), true);
    assert.equal(articleMatchesSearch(companyArticle, 'recommendations'), true);
    assert.equal(articleMatchesSearch(companyArticle, 'unrelated'), false);
  });
});

function article(overrides = {}) {
  return {
    id: '1', category: 'companies', companyName: 'Example', title: 'Overview', summary: 'Summary', content: 'Content',
    tags: [], featured: false, status: 'published', publishedAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z', ...overrides,
  };
}
