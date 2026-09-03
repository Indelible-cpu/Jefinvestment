import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'storesight-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDOM(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

// Initial setup on module load
const initialStored = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) as ThemeMode : null) || 'light';
const initialResolved = initialStored === 'system' ? getSystemTheme() : initialStored;
applyThemeToDOM(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => {
  // Listen for system theme changes if set to 'system'
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (get().theme === 'system') {
        const newResolved = e.matches ? 'dark' : 'light';
        applyThemeToDOM(newResolved);
        set({ resolvedTheme: newResolved });
      }
    });
  }

  return {
    theme: initialStored,
    resolvedTheme: initialResolved,
    setTheme: (theme: ThemeMode) => {
      const resolved = theme === 'system' ? getSystemTheme() : theme;
      localStorage.setItem(STORAGE_KEY, theme);
      applyThemeToDOM(resolved);
      set({ theme, resolvedTheme: resolved });
    },
    toggleTheme: () => {
      const current = get().resolvedTheme;
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      applyThemeToDOM(next);
      set({ theme: next, resolvedTheme: next });
    },
  };
});
