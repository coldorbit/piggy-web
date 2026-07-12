import MarkdownPreview from '@uiw/react-markdown-preview/nohighlight';
import '@uiw/react-markdown-preview/markdown.css';
import { memo } from 'react';

function FaqMarkdownPreview({ source }) {
  return <MarkdownPreview source={source} />;
}

export default memo(FaqMarkdownPreview);
