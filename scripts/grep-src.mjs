// بحث نصي شامل (بدون node_modules/.git/android/dist) عن نص معين
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const needle = process.argv[2] || 'صفحة غير متوفرة';
const skip = new Set(['node_modules', '.git', '.kilo', 'android', 'dist', 'tmp', 'public']);
const exts = /\.(html|js|mjs|ts|tsx|json|css)$/;
const walk = (dir) => {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(full));
    else if (exts.test(e.name)) out.push(full);
  }
  return out;
};
const hits = [];
for (const file of walk('.')) {
  try {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes(needle)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 150)}`);
    });
  } catch { /* ملف غير قابل للقراءة */ }
}
console.log(hits.slice(0, 30).join('\n') || 'NO_HITS');
