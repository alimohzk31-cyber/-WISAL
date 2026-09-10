import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, ArrowLeft } from 'lucide-react';
import { buildDirectorySearchIndex, searchDirectory, getDirectDirectoryMatch } from '../lib/directorySearch';
import { directoryEntryState } from '../lib/directoryNavigation';
import { useServices } from '../context/ServicesContext';
import { useCategories } from '../hooks/useCategories';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';

interface SmartSearchModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * نافذة «البحث الذكي» الصغيرة — تبحث في أقسام التطبيق وخدماته العامة فقط
 * (نفس منطق smartSearch المركزي، بلا أي تكرار). لا يوجد أي وصول إلى الإدارة:
 * الاستعلامات الإدارية محجوبة في طبقة المنطق نفسها (isBlockedAdminQuery).
 */
export default function SmartSearchModal({ open, onClose }: SmartSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { publicServices } = useServices();
  const { categories } = useCategories();
  const { sections, searchServices } = useCategoryDirectory(categories, publicServices);

  // تركيز حقل البحث فور الفتح + تفريغ النص عند الإغلاق
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Escape يغلق النافذة
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const searchIndex = useMemo(() => buildDirectorySearchIndex(sections, searchServices), [sections, searchServices]);
  const results = useMemo(() => open ? searchDirectory(searchIndex, query) : [], [open, searchIndex, query]);

  const trimmed = query.trim();
  // استعلام مكتوب لكن بلا نتائج (يشمل كلمات الإدارة المحجوبة)
  const hasQuery = trimmed.length > 0;
  const noResults = hasQuery && results.length === 0;

  const go = (url: string) => {
    onClose();
    navigate(url, { state: directoryEntryState(location) });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 backdrop-blur-sm px-4 pt-24"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--surface-elevated)] shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            {/* العنوان */}
            <div className="px-5 pt-5 pb-3 text-center">
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
                ابحث عن الخدمة التي تحتاجها
              </h2>
            </div>

            {/* شريط البحث */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-secondary)] pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  dir="rtl"
                  value={query}
                  aria-label="ابحث عن قسم أو تخصص"
                  enterKeyHint="search"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    const direct = getDirectDirectoryMatch(results);
                    if (direct) go(direct.url);
                  }}
                  placeholder="مثال: صيدلية، سباك، كهربائي، بناء بيوت..."
                  className="w-full rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 font-bold pr-12 pl-11 py-3.5 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all"
                />
                {hasQuery && (
                  <button
                    type="button"
                    aria-label="مسح النص"
                    onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] hover:bg-[var(--text-secondary)]/20 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* النتائج */}
            <div className="max-h-[45vh] overflow-y-auto px-3 pb-4 space-y-1.5">
              {results.map(result => {
                const CategoryIcon = result.section.icon;
                return (
                  <button
                    key={result.url}
                    type="button"
                    onClick={() => go(result.url)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[var(--input-bg)] px-4 py-3 text-right hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-soft)] transition-all"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <CategoryIcon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 text-sm font-bold text-[var(--text-primary)]">{result.label}</span>
                    <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors" />
                  </button>
                );
              })}

              {noResults && (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--input-bg)] px-4 py-8 text-center">
                  <Search className="h-7 w-7 text-[var(--text-secondary)]/50" />
                  <p className="text-sm font-bold text-[var(--text-secondary)]">
                    لم يتم العثور على قسم مطابق
                  </p>
                </div>
              )}

              {!hasQuery && (
                <p className="px-2 py-4 text-center text-xs font-bold text-[var(--text-secondary)]/70">
                  اكتب اسم الخدمة أو المهنة — يدعم البحث اللهجة العراقية والعربية الفصحى
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
