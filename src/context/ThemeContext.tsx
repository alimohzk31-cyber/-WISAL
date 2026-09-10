import React, { createContext, useContext, useState, useEffect } from 'react';

// 'dark' is kept in the union ONLY for type-compatibility with many existing
// component checks (`theme === dark`). It is never selectable, never saved
// and never applied.
// لإضافة ثيم جديد مستقبلاً: أضف معرّفه هنا + ألوانه في PRIMARY_COLORS
// + كتلة [data-theme='id'] في src/index.css + عنصر في THEME_OPTIONS بـ ThemeToggle.
export type Theme = 'light' | 'dark' | 'royal' | 'red';

export const PRIMARY_COLORS: Record<Theme, string> = {
  light: '#6D5ACF', // calm purple (المظهر الفاتح)
  royal: '#6D5ACF', // calm purple (المظهر الملكي)
  red: '#D90429', // red (المظهر الأبيض والأحمر)
  dark: '#6D5ACF', // unreachable fallback (dark mode is disabled)
};

// الثيمات القابلة للاختيار (قابلة للتوسعة — أضف هنا عند إضافة ثيم جديد)
export const SELECTABLE_THEMES: Theme[] = ['light', 'royal', 'red'];

export function getPrimaryColor(theme: Theme): string {
  return PRIMARY_COLORS[theme];
}

const STORAGE_KEY = 'saleen_app_theme';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (SELECTABLE_THEMES.includes(stored as Theme)) return stored as Theme;
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // Persist the choice so it survives a refresh.
    window.localStorage.setItem(STORAGE_KEY, theme);
    const root = window.document.documentElement;
    // Dark mode is disabled — the 'dark' class is never added.
    root.classList.remove('dark');
    root.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
