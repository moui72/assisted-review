import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'dark' | 'light';

// Curated color palettes. Each is a full token set defined for both modes in
// web/src/index.css under [data-palette='<slug>'][data-theme='<mode>'].
const PALETTES = ['blueprint', 'paper', 'neon', 'mono', 'aubergine'] as const;
export type Palette = (typeof PALETTES)[number];

function isPalette(v: string | null): v is Palette {
  return v !== null && (PALETTES as readonly string[]).includes(v);
}

const ThemeContext = createContext<{
  theme: Theme;
  palette: Palette;
  toggle: () => void;
  setPalette: (p: Palette) => void;
}>({
  theme: 'dark',
  palette: 'blueprint',
  toggle: () => {},
  setPalette: () => {},
});

// Both getInitial* helpers set their root attribute synchronously (during the
// useState initializer) to avoid a flash before the first effect runs — the
// CSS needs BOTH data-palette and data-theme present for the explicit
// [data-palette][data-theme] blocks to match.
function getInitialTheme(): Theme {
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
    document.documentElement.dataset.theme = theme;
    return theme;
  } catch {
    return 'dark';
  }
}

function getInitialPalette(): Palette {
  try {
    const stored = localStorage.getItem('ar-palette');
    const palette: Palette = isPalette(stored) ? stored : 'blueprint';
    document.documentElement.dataset.palette = palette;
    return palette;
  } catch {
    return 'blueprint';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [palette, setPaletteState] = useState<Palette>(getInitialPalette);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ar-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    localStorage.setItem('ar-palette', palette);
  }, [palette]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const setPalette = (p: Palette) => setPaletteState(p);

  return (
    <ThemeContext.Provider value={{ theme, palette, toggle, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { PALETTES };
