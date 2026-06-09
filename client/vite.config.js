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

function isPackage(id, packageName) {
  return id.includes(`/node_modules/${packageName}/`) || id.includes(`/node_modules/.pnpm/${packageName.replace('/', '+')}@`);
}

function isPackageFamily(id, packageName) {
  return id.includes(`/node_modules/${packageName}`) || id.includes(`/node_modules/.pnpm/${packageName.replace('/', '+')}`);
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (markdownVendorPackages.some((packageName) => isPackageFamily(id, packageName))) {
            return 'vendor-markdown';
          }
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('@mui/') || id.includes('@emotion/') || isPackage(id, '@popperjs/core') || isPackage(id, 'stylis')) {
            return 'vendor-mui';
          }
          if (id.includes('react') || id.includes('@tanstack/') || id.includes('axios') || isPackage(id, 'scheduler')) return 'vendor-core';
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
