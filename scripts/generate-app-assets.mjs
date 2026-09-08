// يولّد أيقونات تطبيق "وصال" وشاشة البداية من صورة الشعار الحقيقية
// (assets/wasal-logo-source.png) باستخدام sharp — ويوزّعها على:
//   1) ملفات المصدر في assets/ (icon-only, icon-foreground, icon-background, splash)
//   2) جميع كثافات mipmap في android/app/src/main/res
//   3) جميع صور splash في drawable* داخل android
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const SOURCE = path.join(assetsDir, 'wasal-logo-source.png');

if (!fs.existsSync(SOURCE)) {
  console.error(`صورة الشعار غير موجودة: ${SOURCE}`);
  process.exit(1);
}

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// كثافات Android: [المجلد, حجم الأيقونة (48dp), حجم طبقات الأيقونة التكيفية (108dp)]
const DENSITIES = [
  ['mipmap-ldpi', 36, 81],
  ['mipmap-mdpi', 48, 108],
  ['mipmap-hdpi', 72, 162],
  ['mipmap-xhdpi', 96, 216],
  ['mipmap-xxhdpi', 144, 324],
  ['mipmap-xxxhdpi', 192, 432],
];

async function main() {
  const meta = await sharp(SOURCE).metadata();
  console.log(`المصدر: ${meta.width}x${meta.height}`);

  // ---------- 1) ملفات المصدر في assets/ ----------

  // الأيقونة الكاملة 1024 — الشعار يملأ المربع (يُقنّع لاحقاً حسب الشكل)
  const iconOnlyBuf = await sharp(SOURCE)
    .resize(1024, 1024, { fit: 'cover' })
    .png()
    .toBuffer();
  await fs.promises.writeFile(path.join(assetsDir, 'icon-only.png'), iconOnlyBuf);
  console.log('icon-only.png OK (1024x1024)');

  // طبقة المقدمة 1024 — الشعار داخل المنطقة الآمنة (~66%) على خلفية شفافة
  const FG = 1024;
  const fgLogoSize = Math.round(FG * 0.66);
  const fgLogo = await sharp(SOURCE)
    .resize(fgLogoSize, fgLogoSize, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  const fgBuf = await sharp({ create: { width: FG, height: FG, channels: 4, background: TRANSPARENT } })
    .composite([{ input: fgLogo, top: Math.round((FG - fgLogoSize) / 2), left: Math.round((FG - fgLogoSize) / 2) }])
    .png()
    .toBuffer();
  await fs.promises.writeFile(path.join(assetsDir, 'icon-foreground.png'), fgBuf);
  console.log('icon-foreground.png OK (1024x1024)');

  // طبقة الخلفية 1024 — أبيض مصمت
  const bgBuf = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: WHITE } })
    .png()
    .toBuffer();
  await fs.promises.writeFile(path.join(assetsDir, 'icon-background.png'), bgBuf);
  console.log('icon-background.png OK (1024x1024)');

  // شاشة البداية 2732 — أبيض + الشعار في المنتصف
  const SPLASH = 2732;
  const spLogoSize = 1100;
  const spLogo = await sharp(SOURCE).resize(spLogoSize, spLogoSize, { fit: 'contain', background: WHITE }).png().toBuffer();
  const splashBuf = await sharp({ create: { width: SPLASH, height: SPLASH, channels: 4, background: WHITE } })
    .composite([{ input: spLogo, top: Math.round((SPLASH - spLogoSize) / 2), left: Math.round((SPLASH - spLogoSize) / 2) }])
    .png()
    .toBuffer();
  await fs.promises.writeFile(path.join(assetsDir, 'splash.png'), splashBuf);
  console.log('splash.png OK (2732x2732)');

  // أيقونة المتصفح (favicon) في public/
  const publicDir = path.join(root, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  await sharp(SOURCE).resize(256, 256, { fit: 'cover' }).png().toFile(path.join(publicDir, 'favicon.png'));
  console.log('public/favicon.png OK (256x256)');

  // ---------- 2) أيقونات mipmap ----------
  for (const [dir, launcherSize, fgSize] of DENSITIES) {
    const out = path.join(resDir, dir);
    fs.mkdirSync(out, { recursive: true });

    // ic_launcher — الأيقونة الكاملة
    await sharp(iconOnlyBuf).resize(launcherSize, launcherSize, { fit: 'cover' }).png()
      .toFile(path.join(out, 'ic_launcher.png'));

    // ic_launcher_round — دائرة بيضاء + الشعار في المنتصف
    const logoIn = Math.round(launcherSize * 0.86);
    const roundLogo = await sharp(iconOnlyBuf).resize(logoIn, logoIn, { fit: 'contain', background: TRANSPARENT }).png().toBuffer();
    const off = Math.round((launcherSize - logoIn) / 2);
    const circleMask = Buffer.from(
      `<svg width="${launcherSize}" height="${launcherSize}"><circle cx="${launcherSize / 2}" cy="${launcherSize / 2}" r="${launcherSize / 2}" fill="#fff"/></svg>`
    );
    await sharp({ create: { width: launcherSize, height: launcherSize, channels: 4, background: TRANSPARENT } })
      .composite([
        { input: circleMask, top: 0, left: 0 },
        { input: roundLogo, top: off, left: off },
      ])
      .png()
      .toFile(path.join(out, 'ic_launcher_round.png'));

    // طبقتا الأيقونة التكيفية (المقدمة من assets، والخلفية أبيض مصمت)
    await sharp(fgBuf).resize(fgSize, fgSize).png().toFile(path.join(out, 'ic_launcher_foreground.png'));
    await sharp({ create: { width: fgSize, height: fgSize, channels: 4, background: WHITE } })
      .png()
      .toFile(path.join(out, 'ic_launcher_background.png'));

    console.log(`${dir} OK (${launcherSize}px / ${fgSize}px)`);
  }

  // ---------- 3) صور splash داخل android (بنفس أبعاد الموجود) ----------
  const splashFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'splash.png') splashFiles.push(p);
    }
  };
  walk(resDir);
  for (const file of splashFiles) {
    const m = await sharp(file).metadata();
    const logoSize = Math.round(Math.min(m.width, m.height) * 0.4);
    const logo = await sharp(SOURCE).resize(logoSize, logoSize, { fit: 'contain', background: WHITE }).png().toBuffer();
    await sharp({ create: { width: m.width, height: m.height, channels: 4, background: WHITE } })
      .composite([{ input: logo, top: Math.round((m.height - logoSize) / 2), left: Math.round((m.width - logoSize) / 2) }])
      .png()
      .toFile(file);
    console.log(`${path.relative(resDir, file)} OK (${m.width}x${m.height})`);
  }

  console.log('تم توليد جميع أصول وصال بنجاح');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});