import MarkdownPreview from '@uiw/react-markdown-preview/nohighlight';
import '@uiw/react-markdown-preview/markdown.css';
import { memo } from 'react';

function FaqMarkdownPreview({ source, ...previewProps }) {
  return <MarkdownPreview source={source} {...previewProps} />;
}

export default memo(FaqMarkdownPreview);
