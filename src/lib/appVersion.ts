/**
 * المصدر المركزي الوحيد لرقم إصدار التطبيق.
 * لا تكرّر رقم الإصدار في أي ملف آخر — استورده من هنا.
 *
 * الربط المستقبلي بمصدر تحديث (API / ملف JSON / Android):
 * استبدل getLatestVersion() فقط — الواجهة والمنطق جاهزان دون تغيير.
 */

/** الإصدار الحالي المثبَّت لدى المستخدم. */
export const APP_VERSION = '1.5';
/** تاريخ إصدار الواجهة الحالي (قيمة ثابتة مرتبطة بالإصدار، لا يتغير يوميًا). */
export const APP_VERSION_DATE = '01/10/2026';
export const APP_VERSION_DAY = 'الخميس';
export const PREVIOUS_APP_VERSION = '1.4';

/**
 * سجل إصدارات وصال — المصدر الوحيد الذي تعرضه نافذة «الإصدار».
 *
 * تواريخ السجل معتمدة من سجل إصدارات وصال، والقائمة مرتبة من الأقدم إلى الأحدث.
 * لإضافة إصدار جديد مستقبلًا: أضف سطرًا واحدًا في نهاية القائمة.
 */
export interface AppRelease {
  /** رقم الإصدار، مثل '1.1'. */
  version: string;
  day: string;
  /** تاريخ نزول الإصدار بصيغة يوم/شهر/سنة، مثل '15/09/2026'. */
  date: string;
}

export const APP_RELEASES: readonly AppRelease[] = [
  { version: '1.0', day: 'السبت', date: '20/12/2025' },
  { version: '1.1', day: 'الجمعة', date: '10/07/2026' },
  { version: '1.2', day: 'الثلاثاء', date: '08/09/2026' },
  { version: '1.3', day: 'الثلاثاء', date: '15/09/2026' },
  { version: '1.4', day: 'الأربعاء', date: '23/09/2026' },
  { version: '1.5', day: 'الخميس', date: '01/10/2026' },
] as const;

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
