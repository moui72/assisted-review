import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'dark' | 'light';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
});

function getInitial(): Theme {
  try {
    const stored = localStorage.getItem('ar-theme');
    const theme: Theme =
      stored === 'light'
        ? 'light'
        : stored === 'dark'
          ? 'dark'
          : window.matchMedia('(prefers-color-scheme: light)').matches
            ? 'light'
            : 'dark';
    // Set synchronously to avoid a flash on light-mode loads.
    if (theme === 'light') document.documentElement.dataset.theme = 'light';
    return theme;
  } catch {
    return 'dark';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ar-theme', theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
