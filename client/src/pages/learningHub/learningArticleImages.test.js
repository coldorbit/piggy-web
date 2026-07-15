import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { insertLearningImage, normalizeLearningImageUrl } from './learningArticleImages.js';

describe('Learning article images', () => {
  it('accepts HTTP and HTTPS URLs and rejects unsafe protocols', () => {
    assert.equal(normalizeLearningImageUrl(' https://example.com/diagram.png '), 'https://example.com/diagram.png');
    assert.equal(normalizeLearningImageUrl('http://example.com/image.jpg'), 'http://example.com/image.jpg');
    assert.throws(() => normalizeLearningImageUrl('javascript:alert(1)'), /HTTP or HTTPS/);
  });

  it('inserts a standalone Markdown image at the editor selection', () => {
    const result = insertLearningImage(
      '## Overview\n\nBeforeAfter',
      { alt: 'System architecture', url: 'https://example.com/architecture.png' },
      { start: 19, end: 19 },
    );

    assert.equal(result.content, '## Overview\n\nBefore\n\n![System architecture](<https://example.com/architecture.png>)\n\nAfter');
    assert.equal(result.content[result.cursor], '\n');
  });

  it('requires accessible alternative text', () => {
    assert.throws(
      () => insertLearningImage('', { alt: ' ', url: 'https://example.com/image.png' }),
      /description for accessibility/,
    );
  });
});
