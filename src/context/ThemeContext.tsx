import React, { createContext, useContext, useState, useEffect } from 'react';

// 'dark' is kept in the union ONLY for type-compatibility with many existing
// component checks (`theme === dark`). It is never selectable, never saved
// and never applied.
// لإضافة ثيم جديد مستقبلاً: أضف معرّفه هنا + ألوانه في PRIMARY_COLORS
// + كتلة [data-theme='id'] في src/index.css + عنصر في THEME_OPTIONS بـ ThemeToggle.
export type Theme = 'light' | 'dark' | 'royal' | 'red' | 'blue' | 'green' | 'pink' | 'maroon';

export const PRIMARY_COLORS: Record<Theme, string> = {
  light: '#6D5ACF', // calm purple (المظهر الفاتح)
  royal: '#6D5ACF', // calm purple (المظهر الملكي)
  red: '#D90429', // red (المظهر الأبيض والأحمر)
  blue: '#087CFF',
  green: '#20E7AD',
  pink: '#FF4EAC',
  maroon: '#FF2C91',
  dark: '#6D5ACF', // unreachable fallback (dark mode is disabled)
};

// الثيمات القابلة للاختيار (قابلة للتوسعة — أضف هنا عند إضافة ثيم جديد)
export const SELECTABLE_THEMES: Theme[] = ['light', 'royal', 'red', 'blue', 'green', 'pink', 'maroon'];

export function getPrimaryColor(theme: Theme): string {
  return PRIMARY_COLORS[theme];
}

const BROWSE_STORAGE_KEY = 'saleen_app_theme';


interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  adminTheme: Theme;
  setAdminTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getStoredTheme(key: string, fallback: Theme): Theme {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(key);
    if (SELECTABLE_THEMES.includes(stored as Theme)) return stored as Theme;
  }
  return fallback;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme(BROWSE_STORAGE_KEY, 'light'));


  useEffect(() => {
    window.localStorage.setItem(BROWSE_STORAGE_KEY, theme);
    const root = window.document.documentElement;
    // Dark mode is disabled — the 'dark' class is never added.
    root.classList.remove('dark');
    root.setAttribute('data-theme', theme);
  }, [theme]);


  const setTheme = (next: Theme) => setThemeState(next);
  // Compatibility API for existing admin components; it updates the shared theme.
  const adminTheme = theme;
  const setAdminTheme = (next: Theme) => setThemeState(next);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, adminTheme, setAdminTheme }}>
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
