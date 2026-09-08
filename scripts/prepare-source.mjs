/**
 * prepare-source.mjs
 * ------------------
 * يردّ ملف الدخول المصدري إلى مكانه في الجذر قبل أي بناء.
 *
 * لماذا هذا ضروري؟
 *   جذر index.html يُستخدم مرتين:
 *   1) كنقطة دخول المصدر لـ Vite (يشير إلى /src/main.tsx)
 *   2) كملف الإنتاج النهائي single-file (بعد npm run release) ليدعم
 *      الفتح المباشر أو الاستضافة من الجذر (GitHub Pages / أي مضيف ثابت).
 *
 * هذا السكربت يعمل تلقائياً قبل `npm run build` (خطاف prebuild) و
 * `npm run dev` (خطاف predev) ليضمن أن البناء يقرأ المصدر دائماً.
 *
 * يتصل به في الطرف المُقابل سكربت `sync-index.mjs` الذي ينسخ
 * ناتج البناء من dist/index.html إلى الجذر بعد الإصدار.
 */
import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'index.source.html');
const target = resolve(root, 'index.html');

if (!existsSync(source)) {
  console.error('[prepare-source] الملف المصدر index.source.html غير موجود!');
  process.exit(1);
}

copyFileSync(source, target);
console.log('[prepare-source] index.html استُعيد من index.source.html ✅');