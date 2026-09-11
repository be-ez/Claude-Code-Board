import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';

/** User-facing choice. `auto` follows the operating system. */
export type ThemePreference = 'light' | 'dark' | 'auto';
/** What is actually painted right now. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'auto'];
export const THEME_STORAGE_KEY = 'ccb-theme';

interface ThemeContextType {
  /** The stored choice, including `auto`. */
  theme: ThemePreference;
  /** The theme `auto` currently resolves to. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isPreference = (value: unknown): value is ThemePreference =>
  THEME_PREFERENCES.includes(value as ThemePreference);

const readStoredTheme = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'auto';
  } catch {
    // Private mode / blocked storage: fall back to following the system.
    return 'auto';
  }
};

const systemQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const systemTheme = (): ResolvedTheme => (systemQuery()?.matches ? 'dark' : 'light');

export const resolveTheme = (theme: ThemePreference): ResolvedTheme =>
  theme === 'auto' ? systemTheme() : theme;

/** Paints the theme. Kept in sync with the pre-hydration script in index.html. */
const applyTheme = (resolved: ResolvedTheme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredTheme()));

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    if (theme !== 'auto') return;

    // Only `auto` tracks the OS, and it has to keep tracking it live.
    const query = systemQuery();
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => {
      const next: ResolvedTheme = event.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyTheme(next);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference just won't survive a reload; the session still switches.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
