import MarkdownPreview from '@uiw/react-markdown-preview/nohighlight';
import '@uiw/react-markdown-preview/markdown.css';

export default function FaqMarkdownPreview({ source }) {
  return <MarkdownPreview source={source} />;
}
