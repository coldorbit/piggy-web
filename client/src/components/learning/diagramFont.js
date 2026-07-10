import virgilFontUrl from '../../../node_modules/@excalidraw/excalidraw/dist/prod/fonts/Virgil/Virgil-Regular.woff2?url';

export const DIAGRAM_FONT_FAMILY = 'Virgil, "Comic Sans MS", cursive';

export const DIAGRAM_FONT_FACE = {
  fontFamily: 'Virgil',
  fontStyle: 'normal',
  fontWeight: 400,
  fontDisplay: 'swap',
  src: `url("${virgilFontUrl}") format("woff2")`,
};
