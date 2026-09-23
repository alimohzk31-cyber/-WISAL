/**
 * المصدر المركزي الوحيد لرقم إصدار التطبيق.
 * لا تكرّر رقم الإصدار في أي ملف آخر — استورده من هنا.
 *
 * الربط المستقبلي بمصدر تحديث (API / ملف JSON / Android):
 * استبدل getLatestVersion() فقط — الواجهة والمنطق جاهزان دون تغيير.
 */

/** الإصدار الحالي المثبَّت لدى المستخدم. */
export const APP_VERSION = '1.2';
/** تاريخ إصدار الواجهة الحالي (قيمة ثابتة مرتبطة بالإصدار، لا يتغير يوميًا). */
export const APP_VERSION_DATE = '23/09/2026';
export const PREVIOUS_APP_VERSION = '1.1';

/**
 * سجل إصدارات وصال — المصدر الوحيد الذي تعرضه نافذة «الإصدار».
 *
 * مصدر التواريخ (موثّق من Git، وليس تخمينًا):
 *  - 1.1: نُقل إليه بتاريخ 14/09/2026 (Commit 450ea17)، والتاريخ المعلن
 *    رسميًا في التطبيق نفسه (APP_VERSION_DATE) هو 15/09/2026.
 *  - 1.0: أول Commit في المستودع بتاريخ 08/09/2026 (Commit 259a8f0
 *    «Initial complete Wisal project»)، وفيه android/app/build.gradle
 *    يُظهر versionName "1.0.0" وappVersion.ts يُظهر APP_VERSION = '1.0.0'.
 *
 * لإضافة إصدار جديد مستقبلًا: أضف سطرًا واحدًا أعلى القائمة فقط:
 *   { version: '1.2', date: 'يوم/شهر/سنة' },
 * والقائمة تبقى مرتبة من الأحدث إلى الأقدم كما هي مكتوبة.
 */
export interface AppRelease {
  /** رقم الإصدار، مثل '1.1'. */
  version: string;
  /** تاريخ نزول الإصدار بصيغة يوم/شهر/سنة، مثل '15/09/2026'. */
  date: string;
}

export const APP_RELEASES: readonly AppRelease[] = [
  { version: '1.2', date: '23/09/2026' },
  { version: '1.1', date: '15/09/2026' },
  { version: '1.0', date: '08/09/2026' },
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
