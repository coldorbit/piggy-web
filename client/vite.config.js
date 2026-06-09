import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const markdownVendorPackages = [
  '@codemirror',
  '@lezer',
  '@uiw',
  'character-entities',
  'character-entities-legacy',
  'character-reference-invalid',
  'codemirror',
  'commands',
  'comma-separated-tokens',
  'css-selector-parser',
  'decode-named-character-reference',
  'devlop',
  'direction',
  'entities',
  'hast-util',
  'hastscript',
  'highlight.js',
  'html-url-attributes',
  'html-void-elements',
  'inline-style-parser',
  'is-alphabetical',
  'is-alphanumerical',
  'is-decimal',
  'is-hexadecimal',
  'lowlight',
  'markdown-table',
  'mdast-util',
  'mermaid',
  'micromark',
  'parse-entities',
  'parse-numeric-range',
  'parse5',
  'property-information',
  'react-markdown',
  'refractor',
  'rehype',
  'remark',
  'space-separated-tokens',
  'stringify-entities',
  'style-to-js',
  'style-to-object',
  'unified',
  'unist-util',
  'vfile',
  'vfile-location',
  'vfile-message',
  'web-namespaces',
  'zwitch',
];

const coreVendorPackages = ['@tanstack', 'axios', 'hoist-non-react-statics', 'react', 'react-dom', 'react-router', 'scheduler'];
const chartVendorPackages = [
  '@reduxjs/toolkit',
  'd3',
  'decimal.js-light',
  'internmap',
  'react-redux',
  'recharts',
  'redux',
  'redux-thunk',
  'victory-vendor',
];
const muiVendorPackages = ['@emotion', '@mui', '@popperjs/core', 'react-transition-group', 'stylis'];

function isPackageFamily(id, packageName) {
  return id.includes(`/node_modules/${packageName}`) || id.includes(`/node_modules/.pnpm/${packageName.replace('/', '+')}`);
}

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (coreVendorPackages.some((packageName) => isPackageFamily(id, packageName))) {
            return 'vendor-core';
          }
          if (muiVendorPackages.some((packageName) => isPackageFamily(id, packageName))) {
            return 'vendor-mui';
          }
          if (markdownVendorPackages.some((packageName) => isPackageFamily(id, packageName))) {
            return 'vendor-markdown';
          }
          if (chartVendorPackages.some((packageName) => isPackageFamily(id, packageName))) {
            return 'vendor-charts';
          }
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
});
