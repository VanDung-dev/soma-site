export type Theme = 'auto' | 'light' | 'dark';

const themeStorageKey = 'human-atlas-theme';

export function getInitialTheme(): Theme {
  try {
    const theme = window.localStorage.getItem(themeStorageKey);
    return theme === 'light' || theme === 'dark' ? theme : 'auto';
  } catch { return 'auto'; }
}

export function storeTheme(theme: Theme): void {
  try { window.localStorage.setItem(themeStorageKey, theme); } catch {}
}

export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : theme === 'dark' ? 'dark' : 'light';
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
}
