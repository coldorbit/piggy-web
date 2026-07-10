import { Box } from '@mui/material';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

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
  return (
    <Box
      role="img"
      aria-label={title || 'Excalidraw diagram'}
      sx={{
        height: { xs: 420, md: 'min(70vh, 720px)' },
        minHeight: 360,
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
        viewModeEnabled
        zenModeEnabled
        gridModeEnabled={false}
        autoFocus={false}
        handleKeyboardGlobally={false}
        UIOptions={READ_ONLY_UI}
        validateEmbeddable={() => false}
        renderEmbeddable={() => null}
        onLinkOpen={(_element, event) => event.preventDefault()}
      />
    </Box>
  );
}
