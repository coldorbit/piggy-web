import { Alert, Box, CircularProgress } from '@mui/material';
import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import DiagramNavigationControls from './DiagramNavigationControls.jsx';

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
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

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

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function changeZoom(factor) {
    setZoom((current) => Math.max(0.5, current * factor));
  }

  function startPan(event) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offset };
  }

  function continuePan(event) {
    if (drag.current?.pointerId !== event.pointerId) return;
    setOffset({
      x: drag.current.offset.x + event.clientX - drag.current.x,
      y: drag.current.offset.y + event.clientY - drag.current.y,
    });
  }

  function stopPan(event) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  if (error) return <Alert severity="error">Invalid Mermaid diagram: {error}</Alert>;
  if (!svg) return <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>;

  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: 500, md: 'min(70vh, 680px)' },
        minHeight: 500,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: '#fff',
      }}
      onPointerDown={startPan}
      onPointerMove={continuePan}
      onPointerUp={stopPan}
      onPointerCancel={stopPan}
      onWheel={(event) => {
        event.preventDefault();
        changeZoom(event.deltaY < 0 ? 1.1 : 1 / 1.1);
      }}
    >
      <Box
        role="img"
        aria-label={title || 'Mermaid diagram'}
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          p: { xs: 1, md: 2 },
          cursor: drag.current ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          '& svg': { display: 'block', maxWidth: '100%', maxHeight: '100%', height: 'auto' },
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <DiagramNavigationControls
        zoom={zoom}
        onZoomIn={() => changeZoom(1.2)}
        onZoomOut={() => changeZoom(1 / 1.2)}
        onReset={resetView}
        onPanLeft={() => setOffset((current) => ({ ...current, x: current.x - 80 }))}
        onPanRight={() => setOffset((current) => ({ ...current, x: current.x + 80 }))}
        onPanUp={() => setOffset((current) => ({ ...current, y: current.y - 80 }))}
        onPanDown={() => setOffset((current) => ({ ...current, y: current.y + 80 }))}
      />
    </Box>
  );
}
