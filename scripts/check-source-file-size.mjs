import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOTS = ['api', 'client', 'worker'];
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.css']);
const EXCLUDED_DIRECTORIES = new Set(['dist', 'node_modules']);
const MAX_LINES = 1_000;
const MAX_BYTES = 100_000;

const violations = [];

for (const root of ROOTS) await inspectDirectory(root);

if (violations.length) {
  console.error(`Source files must stay below ${MAX_LINES.toLocaleString()} lines and ${MAX_BYTES.toLocaleString()} bytes.`);
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log(`Source file size check passed (${MAX_LINES.toLocaleString()} lines / ${MAX_BYTES.toLocaleString()} bytes maximum).`);
}

async function inspectDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspectDirectory(filePath);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    const source = await readFile(filePath, 'utf8');
    const lines = source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0);
    const bytes = Buffer.byteLength(source, 'utf8');
    if (lines > MAX_LINES || bytes > MAX_BYTES) {
      violations.push(`${filePath}: ${lines.toLocaleString()} lines, ${bytes.toLocaleString()} bytes`);
    }
  }
}
