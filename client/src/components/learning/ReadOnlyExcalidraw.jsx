import { Box } from '@mui/material';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useEffect, useState } from 'react';
import DiagramNavigationControls from './DiagramNavigationControls.jsx';

const READ_ONLY_UI = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: false,
    loadScene: false,
    saveToActiveFile: false,
    saveAsImage: false,
    toggleTheme: false,
  },
  tools: { image: false },
};

export default function ReadOnlyExcalidraw({ scene, title }) {
  const [api, setApi] = useState(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!api) return undefined;
    const frame = window.requestAnimationFrame(() => api.setActiveTool({ type: 'hand' }));
    return () => window.cancelAnimationFrame(frame);
  }, [api, scene]);

  function changeZoom(factor) {
    if (!api) return;
    const appState = api.getAppState();
    const currentZoom = appState.zoom.value;
    const nextZoom = Math.max(0.1, currentZoom * factor);
    const scrollX = appState.scrollX + (appState.width / (2 * nextZoom)) - (appState.width / (2 * currentZoom));
    const scrollY = appState.scrollY + (appState.height / (2 * nextZoom)) - (appState.height / (2 * currentZoom));
    api.updateScene({ appState: { zoom: { value: nextZoom }, scrollX, scrollY } });
    setZoom(nextZoom);
  }

  function panBy(deltaX, deltaY) {
    if (!api) return;
    const appState = api.getAppState();
    api.updateScene({ appState: {
      scrollX: appState.scrollX + deltaX / appState.zoom.value,
      scrollY: appState.scrollY + deltaY / appState.zoom.value,
    } });
  }

  function fitToView() {
    if (!api) return;
    api.scrollToContent(api.getSceneElements(), { fitToViewport: true, viewportZoomFactor: 0.88, animate: true });
  }

  return (
    <Box
      aria-label={title || 'Excalidraw diagram'}
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: '#fff',
        '& .excalidraw': { '--color-primary': '#0067c0' },
      }}
    >
      <Excalidraw
        initialData={scene}
        excalidrawAPI={setApi}
        viewModeEnabled
        zenModeEnabled
        gridModeEnabled={false}
        autoFocus={false}
        handleKeyboardGlobally={false}
        UIOptions={READ_ONLY_UI}
        validateEmbeddable={() => false}
        renderEmbeddable={() => null}
        onLinkOpen={(_element, event) => event.preventDefault()}
        onScrollChange={(_scrollX, _scrollY, nextZoom) => setZoom(nextZoom.value)}
      />
      <DiagramNavigationControls
        zoom={zoom}
        onZoomIn={() => changeZoom(1.2)}
        onZoomOut={() => changeZoom(1 / 1.2)}
        onReset={fitToView}
        onPanLeft={() => panBy(-80, 0)}
        onPanRight={() => panBy(80, 0)}
        onPanUp={() => panBy(0, -80)}
        onPanDown={() => panBy(0, 80)}
      />
    </Box>
  );
}
