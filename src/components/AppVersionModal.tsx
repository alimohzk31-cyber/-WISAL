import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PackageCheck, PartyPopper, RefreshCw, X } from 'lucide-react';
import { APP_VERSION, PREVIOUS_APP_VERSION, getLatestVersion, isNewerVersion } from '../lib/appVersion';

interface AppVersionModalProps {
  open: boolean;
  onClose: () => void;
  /** نتيجة فحص التحديث الأولي من Layout (اختياري — يُحسب داخليًا إن لم يُمرَّر). */
  hasUpdate?: boolean;
  /** يُستدعى عند قبول المستخدم التحديث — نقطة ربط مستقبلية لنظام التحديث الفعلي. */
  onUpdateAccepted?: () => void;
}

/**
 * نافذة «إصدار تطبيق وصال» الصغيرة.
 * APP_VERSION هو المصدر الوحيد لرقم الإصدار (من lib/appVersion).
 * منطق التحديث جاهز للربط مستقبلًا بمصدر خارجي (API / JSON / Android)
 * دون تغيير هذه النافذة — يكفي تنفيذ getLatestVersion().
 */
export default function AppVersionModal({ open, onClose, hasUpdate, onUpdateAccepted }: AppVersionModalProps) {
  // latest === null → لا يوجد مصدر تحديث بعد (أنت تستخدم أحدث إصدار)
  const [latest, setLatest] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChecking(true);
    getLatestVersion()
      .then((version) => { if (!cancelled) setLatest(version); })
      .catch(() => { if (!cancelled) setLatest(null); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [open]);

  // Escape يغلق النافذة
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const updateAvailable = hasUpdate ?? (latest !== null && isNewerVersion(latest, APP_VERSION));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex min-w-0 items-center justify-center bg-black/40 px-2 backdrop-blur-sm sm:px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative w-full min-w-0 max-w-xs rounded-3xl border border-[var(--border-color)] bg-[var(--surface-elevated)] p-4 text-center shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="إغلاق"
              onClick={onClose}
              className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] hover:bg-[var(--text-secondary)]/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <PackageCheck className="h-6 w-6" />
            </div>

            <h2 className="text-base font-extrabold text-[var(--text-primary)]">إصدار تطبيق وصال</h2>
            <p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">
              الإصدار الحالي: <span className="text-[var(--accent-primary)]" dir="ltr">{APP_VERSION}</span>
            </p>
            <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">الإصدار السابق: <span dir="ltr">{PREVIOUS_APP_VERSION}</span></p>

            <div className="mt-4">
              {checking ? (
                <p className="text-xs font-bold text-[var(--text-secondary)]">جارٍ التحقق من التحديث...</p>
              ) : updateAvailable ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-amber-500/10 px-4 py-3">
                    <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">يتوفر تحديث جديد</p>
                    <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">
                      الإصدار الجديد: <span dir="ltr">{latest}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // نقطة الربط المستقبلية: تنفيذ التحديث الفعلي (متجر / APK / reload داخلي)
                      onUpdateAccepted?.();
                      onClose();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
                  >
                    <RefreshCw className="h-4 w-4" />
                    تحديث التطبيق
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-4">
                  <PartyPopper className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    أنت تستخدم أحدث إصدار
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
