/**
 * المصدر المركزي الوحيد لرقم إصدار التطبيق.
 * لا تكرّر رقم الإصدار في أي ملف آخر — استورده من هنا.
 *
 * الربط المستقبلي بمصدر تحديث (API / ملف JSON / Android):
 * استبدل getLatestVersion() فقط — الواجهة والمنطق جاهزان دون تغيير.
 */

/** الإصدار الحالي المثبَّت لدى المستخدم. */
export const APP_VERSION = '1.1';
export const PREVIOUS_APP_VERSION = '1.0';

/** وصف مصدر التحقق من التحديث (للعرض داخل نافذة الإصدار مستقبلًا). */
export type UpdateCheckSource = 'none' | 'remote' | 'store';

/**
 * يجلب أحدث إصدار متاح.
 * حاليًا: لا يوجد مصدر تحديث بعد → يُعاد null (أنت تستخدم أحدث إصدار).
 * مستقبلًا: اربطه بـ API/JSON يعيد LATEST_VERSION وسيعمل الـ Badge والزر تلقائيًا.
 */
export async function getLatestVersion(): Promise<string | null> {
  return null;
}

/**
 * فحص سريع لوجود تحديث (يُستدعى مرة عند تحميل التطبيق من Layout
 * لإظهار Badge صغير على أيقونة «الإصدار»).
 */
export async function checkForUpdate(): Promise<{ hasUpdate: boolean; latest: string | null }> {
  try {
    const latest = await getLatestVersion();
    return { hasUpdate: latest !== null && isNewerVersion(latest, APP_VERSION), latest };
  } catch {
    return { hasUpdate: false, latest: null };
  }
}

/** مقارنة إصدارات بصيغة semver مبسطة: تُعيد true إذا latest > current. */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(part => parseInt(part, 10) || 0);
  const [l, c] = [parse(latest), parse(current)];
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const li = l[i] ?? 0;
    const ci = c[i] ?? 0;
    if (li !== ci) return li > ci;
  }
  return false;
}
