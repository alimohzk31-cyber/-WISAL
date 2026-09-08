/**
 * appVersion — المصدر المركزي الوحيد لرقم إصدار التطبيق.
 *
 * القاعدة: لا يُكرَّر رقم الإصدار في أي ملف آخر. أي مكان يريد عرض
 * الإصدار (قائمة ☰، نافذة الإصدار، شاشة "نبذة") يقرأه من هنا فقط.
 *
 * الربط المستقبلي بنظام تحديث:
 * -----------------------------
 * `fetchLatestVersion()` هو النقطة الوحيدة المطلوب تغييرها لاحقًا.
 * حاليًا تُعيد null (لا يوجد مصدر تحديث → يظهر "أنت تستخدم أحدث إصدار").
 * لاحقًا يكفي أن تعيد الإصدار الأحدث من مصدر خارجي (JSON ثابت في
 * Storage/GitHub، أو API، أو سلسلة من Android metadata) بدون تغيير
 * أي شيء آخر في الواجهة.
 */

/** الإصدار الحالي للتطبيق — الوحيد في المشروع كله. */
export const APP_VERSION = '1.0.0';

/** حالة التحقق من التحديث التي تستهلكها الواجهة. */
export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  /** true فقط إذا كان latestVersion أكبر رقميًا من APP_VERSION */
  hasUpdate: boolean;
}

/**
 * مقارنة إصدارات بنمط "X.Y.Z" (أرقام فقط، بدون "-" أو لاحقات).
 * تعيد: > 0 إذا a أحدث من b، و < 0 إذا أقدم، و 0 إذا متساويان.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(part => parseInt(part, 10) || 0);
  const pb = b.split('.').map(part => parseInt(part, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * جلب الإصدار الأحدث من مصدره.
 * — اليوم: لا يوجد مصدر تحديث مفعّل، تُعيد null دائمًا (لا تحذير تحديث).
 * — مستقبلًا: يكفي استبدال جسمها بـ fetch لملف JSON أو Endpoint، مثل:
 *      const res = await fetch(UPDATES_JSON_URL, { cache: 'no-store' });
 *      return (await res.json()).latest_version ?? null;
 *   دون لمس أي شيء آخر (النافذة والBadge يقرآن النتيجة تلقائيًا).
 */
export async function fetchLatestVersion(): Promise<string | null> {
  return null;
}

/**
 * حساب حالة التحديث كاملة في نداء واحد.
 * الواجهة تستدعيها مرة واحدة (مثلاً عند فتح نافذة الإصدار) وتعرض
 * النتيجة كما هي: تحديث متاح أو أحدث إصدار.
 */
export async function getUpdateStatus(): Promise<UpdateStatus> {
  const latest = await fetchLatestVersion();
  return {
    currentVersion: APP_VERSION,
    latestVersion: latest,
    hasUpdate: !!latest && compareVersions(latest, APP_VERSION) > 0,
  };
}
