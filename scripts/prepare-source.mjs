/**
 * prepare-source.mjs
 * ------------------
 * يتحقق من نقطة دخول Vite قبل التشغيل والبناء، بدون تعديلها.
 * index.html هو المصدر المعتمد؛ index.source.html نسخة مرجعية فقط.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'index.html');

if (!existsSync(target)) {
  console.error('[prepare-source] نقطة دخول Vite غير موجودة: index.html. لم يتم استبدال أي ملف.');
  process.exit(1);
}

const html = readFileSync(target, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const hasRoot = /<div\b[^>]*\bid\s*=\s*(["'])root\1[^>]*>/i.test(html);
const hasEntry = [...html.matchAll(/<script\b[^>]*>/gi)].some(([tag]) =>
  /\btype\s*=\s*(["'])module\1/i.test(tag) &&
  /\bsrc\s*=\s*(["'])(?:\.\/|\/)?src\/main\.tsx\1/i.test(tag)
);

if (!hasRoot || !hasEntry || !existsSync(resolve(root, 'src', 'main.tsx'))) {
  console.error('[prepare-source] يجب أن يحتوي index.html على div#root و script type="module" مرتبط بـ /src/main.tsx الموجود. لم يتم استبدال أي ملف.');
  process.exit(1);
}

console.log('[prepare-source] index.html هو مدخل Vite، وربط src/main.tsx سليم ✅');
