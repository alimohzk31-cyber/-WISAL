import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const output = fileURLToPath(new URL('../release/web/', import.meta.url));
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
if (!/<script[^>]+src="\.\/assets\//.test(html)) throw new Error('Expected the split web build. Run npm run release.');
function copyDirectory(source, target) {
  mkdirSync(target, { recursive: true });
  // Remove obsolete generated files only; never recursively delete a directory.
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.isFile() && !existsSync(join(source, entry.name))) unlinkSync(join(target, entry.name));
  }
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory()) copyDirectory(join(source, entry.name), join(target, entry.name));
    else if (entry.isFile()) copyFileSync(join(source, entry.name), join(target, entry.name));
  }
}
copyDirectory(dist, output);
console.log('Wisal 1.1 web release: release/web — upload the entire directory, including assets.');
