import { Alert, Box, CircularProgress } from '@mui/material';
import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;
let renderSequence = 0;

function initializeMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    maxTextSize: 50_000,
    maxEdges: 500,
    suppressErrorRendering: true,
  });
  mermaidInitialized = true;
}

export default function MermaidDiagram({ source, title }) {
  const reactId = useId();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    renderSequence += 1;
    const diagramId = `learning-mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}-${renderSequence}`;
    setSvg('');
    setError('');
    initializeMermaid();

    mermaid.render(diagramId, source)
      .then((result) => {
        if (active) setSvg(result.svg);
      })
      .catch((renderError) => {
        if (active) setError(renderError?.message || 'The Mermaid diagram could not be rendered.');
      });

    return () => { active = false; };
  }, [reactId, source]);

  if (error) return <Alert severity="error">Invalid Mermaid diagram: {error}</Alert>;
  if (!svg) return <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>;

  return (
    <Box
      role="img"
      aria-label={title || 'Mermaid diagram'}
      sx={{
        overflow: 'auto',
        p: { xs: 1, md: 2 },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: '#fff',
        '& svg': { display: 'block', maxWidth: '100%', height: 'auto', mx: 'auto' },
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
