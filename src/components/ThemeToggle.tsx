import { Palette, Check } from 'lucide-react';
import { useTheme, Theme, SELECTABLE_THEMES } from '../context/ThemeContext';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ThemeOption {
  id: Theme;
  label: string;
  swatch: string;
}

// قائمة الثيمات المعروضة في أيقونة الألوان (قابلة للتوسعة — أضف الثيم هنا فقط
// بعد إضافة كتلة CSS الخاصة به في index.css وألوانه في PRIMARY_COLORS)
const THEME_LABELS: Record<string, string> = {
  light: 'Light',
  royal: 'Royal Purple',
  red: '🔴 الأبيض والأحمر',
};

const THEME_SWATCHES: Record<string, string> = {
  light: '#DAD7D2',
  royal: '#6A0DAD',
  red: '#D90429',
};

const THEME_OPTIONS: ThemeOption[] = SELECTABLE_THEMES.map((id) => ({
  id,
  label: THEME_LABELS[id] ?? id,
  swatch: THEME_SWATCHES[id] ?? '#888888',
}));

interface ThemeToggleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export default function ThemeToggle({ open, onOpenChange, hideTrigger = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Controlled ↔ uncontrolled pattern: when `open`/`onOpenChange` are
  // supplied the parent owns the state; otherwise the component is
  // self-contained (backward compatible with existing standalone usage).
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {!hideTrigger && (
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="p-2 rounded-xl transition-colors border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
          title="ألوان التطبيق"
          aria-label="ألوان التطبيق"
        >
          <Palette className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={
              hideTrigger
                ? "w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] z-50 overflow-hidden"
                : "absolute left-0 mt-2 w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] z-50 overflow-hidden"
            }
          >
            <div className="p-2 space-y-1">
              {THEME_OPTIONS.map((item) => {
                const isActive = theme === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTheme(item.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-5 h-5 rounded-full border border-[var(--border)]"
                        style={{ backgroundColor: item.swatch }}
                      />
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    {isActive && (
                      <Check className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

