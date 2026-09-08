/**
 * sync-index.mjs
 * --------------
 * بعد بناء ناجح، ينسخ ناتج الإنتاج (dist/index.html) إلى جذر المشروع
 * (index.html) ليكون جاهزاً للاستضافة المباشرة أو الفتح بالمتصفح
 * بدون خادم builds (نمط single-file).
 *
 * الاستخدام: npm run release
 */
import { copyFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist', 'index.html');
const target = resolve(root, 'index.html');

if (!existsSync(dist)) {
  console.error('[sync-index] dist/index.html غير موجود! شغّل npm run build أولاً.');
  process.exit(1);
}

// Reject split builds: copying only their HTML leaves missing JS/CSS in the root.
const html = readFileSync(dist, 'utf8');
if (/<script\b[^>]*\bsrc\s*=/i.test(html) || /<link\b[^>]*\brel=["'](?:stylesheet|modulepreload)["']/i.test(html)) {
  console.error('[sync-index] شغّل npm run release لإنشاء نسخة مدمجة قابلة للفتح مباشرة.');
  process.exit(1);
}

// Vite does not inline public assets (including the header logo).
const publicDir = resolve(root, 'public');
function copyPublicEntry(source, destination) {
  if (statSync(source).isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source)) {
      copyPublicEntry(resolve(source, entry), resolve(destination, entry));
    }
  } else {
    copyFileSync(source, destination);
  }
}
for (const entry of readdirSync(publicDir)) {
  copyPublicEntry(resolve(root, 'dist', entry), resolve(root, entry));
}
copyFileSync(dist, target);
const bytes = statSync(dist).size;
const sizeMB = (bytes / (1024 * 1024)).toFixed(2);
console.log(`[sync-index] نُسخ dist/index.html إلى جذر index.html ✅ (${sizeMB} MB — جاهز للإصدار)`);
