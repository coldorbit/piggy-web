import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const INITIAL_JAVASCRIPT_BUDGET_BYTES = 200 * 1024;
const distDirectory = resolve('dist');
const html = readFileSync(resolve(distDirectory, 'index.html'), 'utf8');
const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.js)"/g)]
  .map((match) => match[1]);
const uniqueAssetPaths = [...new Set(assetPaths)];
const compressedBytes = uniqueAssetPaths.reduce((total, assetPath) => (
  total + gzipSync(readFileSync(resolve(distDirectory, assetPath.slice(1)))).byteLength
), 0);

if (compressedBytes > INITIAL_JAVASCRIPT_BUDGET_BYTES) {
  throw new Error(
    `Initial JavaScript is ${(compressedBytes / 1024).toFixed(1)} KiB gzip; budget is ${INITIAL_JAVASCRIPT_BUDGET_BYTES / 1024} KiB.`,
  );
}

console.log(`Initial JavaScript budget passed: ${(compressedBytes / 1024).toFixed(1)} KiB gzip.`);
